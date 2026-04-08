import { NextRequest, NextResponse } from "next/server";

type StyleProfile = {
  tone?: string;
  formality?: string;
  averageLength?: string;
  averageWords?: number;
  greetingStyle?: string;
  closingStyle?: string;
  commonPhrases?: string[];
  decisionNotes?: {
    conciseReplies?: boolean;
    oftenSuggestsNextStep?: boolean;
    consistentlyPolite?: boolean;
  };
  sampleCount?: number;
};

function buildStyleInstructions(styleProfile?: StyleProfile) {
  if (!styleProfile) {
    return `
No strong personal style profile is available yet.
Write like a natural human, short, clear, polite, and practical.
`;
  }

  const commonPhrases =
    styleProfile.commonPhrases && styleProfile.commonPhrases.length > 0
      ? styleProfile.commonPhrases.join(", ")
      : "none";

  return `
Write in the user's style.

User style profile:
- Tone: ${styleProfile.tone || "neutral"}
- Formality: ${styleProfile.formality || "neutral"}
- Typical reply length: ${styleProfile.averageLength || "short"}
- Average words: ${styleProfile.averageWords || 40}
- Greeting style: ${styleProfile.greetingStyle || "none"}
- Closing style: ${styleProfile.closingStyle || "none"}
- Common phrases: ${commonPhrases}
- Usually concise: ${styleProfile.decisionNotes?.conciseReplies ? "yes" : "no"}
- Often suggests next step: ${
    styleProfile.decisionNotes?.oftenSuggestsNextStep ? "yes" : "no"
  }
- Consistently polite: ${
    styleProfile.decisionNotes?.consistentlyPolite ? "yes" : "no"
  }

Important:
- Match the user's style, not a generic assistant tone
- If the user is concise, stay concise
- If the user is direct, stay direct
- If the user usually suggests a next step, do it naturally
`;
}

export async function POST(request: NextRequest) {
  try {
    const {
      from,
      subject,
      body,
      category,
      needsReply,
      suggestedAction,
      styleProfile,
    } = await request.json();

    if (!subject || !body) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    if (needsReply === false || suggestedAction === "ignore") {
      return NextResponse.json({
        reply: "",
        skipped: true,
        reason: "This email does not appear to require a reply.",
      });
    }

    const styleInstructions = buildStyleInstructions(styleProfile);

    const prompt = `
You are helping a user reply to an email.

${styleInstructions}

Email metadata:
- Sender: ${from || "Unknown sender"}
- Subject: ${subject}
- Category: ${category || "unknown"}
- Suggested action: ${suggestedAction || "unknown"}

Email body:
${body}

Your task:
Write a short, natural reply that the user would realistically send.

Rules:
- Return only the reply text
- Do not mention AI
- Do not explain your reasoning
- Do not repeat the original email
- Do not sound overly corporate unless the style profile clearly suggests it
- If the email is a simple question, answer directly
- If the email suggests commercial interest, keep the answer useful and practical
- If details are missing, ask one short clarifying question instead of inventing
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content:
              "You write realistic email replies in the user's personal style.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "OpenAI request failed" },
        { status: 500 }
      );
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    return NextResponse.json({
      reply: reply || "No reply generated.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate reply" },
      { status: 500 }
    );
  }
}
