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

type ReplyVariant = {
  type: "short" | "balanced" | "detailed";
  text: string;
};

function buildStyleInstructions(styleProfile?: StyleProfile) {
  if (!styleProfile) {
    return `
No strong personal style profile is available yet.
Write like a natural human: short, clear, polite, practical.
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

function normalizeReplies(raw: any): ReplyVariant[] {
  if (!Array.isArray(raw)) return [];

  const validTypes: Array<ReplyVariant["type"]> = ["short", "balanced", "detailed"];

  const cleaned = raw
    .map((item) => {
      const type = validTypes.includes(item?.type) ? item.type : null;
      const text = typeof item?.text === "string" ? item.text.trim() : "";

      if (!type || !text) return null;

      return { type, text } as ReplyVariant;
    })
    .filter(Boolean) as ReplyVariant[];

  const byType = new Map<ReplyVariant["type"], ReplyVariant>();
  for (const reply of cleaned) {
    if (!byType.has(reply.type)) {
      byType.set(reply.type, reply);
    }
  }

  return validTypes
    .map((type) => byType.get(type))
    .filter(Boolean) as ReplyVariant[];
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
        replies: [],
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
Generate 3 realistic reply options that the user could actually send.

Reply types:
1. short = very concise, direct
2. balanced = best default option, natural and practical
3. detailed = more complete, more reassuring, still human

Rules:
- Return STRICT JSON only
- Do not mention AI
- Do not explain your reasoning
- Do not repeat the original email
- Do not sound overly corporate unless the style profile clearly suggests it
- If the email is a simple question, answer directly
- If the email suggests commercial interest, keep the answer useful and practical
- If details are missing, ask one short clarifying question instead of inventing

Expected JSON format:
{
  "replies": [
    { "type": "short", "text": "..." },
    { "type": "balanced", "text": "..." },
    { "type": "detailed", "text": "..." }
  ]
}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write realistic email replies in the user's personal style. Return only valid JSON.",
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

    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: "No reply generated." },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON returned by model." },
        { status: 500 }
      );
    }

    const replies = normalizeReplies(parsed?.replies);

    if (!replies.length) {
      return NextResponse.json(
        { error: "No valid replies generated." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      replies,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate reply" },
      { status: 500 }
    );
  }
      }
