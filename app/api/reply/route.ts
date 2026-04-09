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

type ThreadMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
};

type LearningExample = {
  id: string;
  originalReply: string;
  editedReply: string;
  emailContext?: {
    from?: string;
    subject?: string;
    body?: string;
    category?: string;
  };
  createdAt?: string;
};

function buildStyleInstructions(styleProfile?: StyleProfile) {
  if (!styleProfile) {
    return `
No strong personal style profile is available yet.
Write like a natural human: short, clear, polite, practical.
Prefer simple and direct sentences.
Avoid formal letter language unless clearly needed.
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
- Keep the wording realistic, simple and human
- Prefer simple, direct sentences
- Avoid long formal email structures unless clearly appropriate
- Avoid "Bonjour, merci pour votre message" unless it feels natural
- Write like a quick real message, not a stiff formal letter
`;
}

function normalizeReplies(raw: unknown): ReplyVariant[] {
  if (!Array.isArray(raw)) return [];

  const validTypes: Array<ReplyVariant["type"]> = [
    "short",
    "balanced",
    "detailed",
  ];

  const cleaned = raw
    .map((item) => {
      const type = validTypes.includes((item as any)?.type)
        ? ((item as any).type as ReplyVariant["type"])
        : null;
      const text =
        typeof (item as any)?.text === "string" ? (item as any).text.trim() : "";

      if (!type || !text) return null;

      return { type, text } satisfies ReplyVariant;
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

function formatThreadForPrompt(thread: ThreadMessage[]) {
  if (!thread.length) {
    return "No previous thread context available.";
  }

  return thread
    .map((message, index) => {
      const safeBody = (message.body || message.snippet || "").slice(0, 1200);

      return `
Message ${index + 1}
From: ${message.from || "Unknown sender"}
Subject: ${message.subject || "(No subject)"}
Date: ${message.date || "Unknown date"}
Content: ${safeBody}
`.trim();
    })
    .join("\n\n---\n\n");
}

function buildDecisionInstructions(category?: string, suggestedAction?: string) {
  return `
Decision guidance:
- Category: ${category || "unknown"}
- Suggested action: ${suggestedAction || "unknown"}

Behavior rules:
- If the email is a simple question, answer directly in the first sentence
- If the email is from a buyer or shows commercial interest, be useful and move the conversation forward
- If a next step makes sense, suggest one naturally
- If information is missing, ask one short clarifying question instead of guessing
- Avoid generic filler like "Thank you for your message" unless it feels natural
- Avoid repeating information already present in the thread
- Keep the answer practical and specific
- Prioritize usefulness over politeness
- If negotiation or buying is involved, be practical
- If a meeting or pickup is possible, propose a clear next step
- If the sender asks multiple things, answer the most important one first
`;
}

function formatLearningExamples(examples: LearningExample[]) {
  if (!examples.length) {
    return "No user correction examples available yet.";
  }

  return examples
    .slice(0, 5)
    .map((example, index) => {
      const ctx = example.emailContext || {};

      return `
Example ${index + 1}
Context:
- From: ${ctx.from || "Unknown sender"}
- Subject: ${ctx.subject || "(No subject)"}
- Category: ${ctx.category || "unknown"}

AI original reply:
${example.originalReply || ""}

User final edited reply:
${example.editedReply || ""}
`.trim();
    })
    .join("\n\n---\n\n");
}

function detectScenario(subject: string, body: string, thread: ThreadMessage[]) {
  const text = `${subject} ${body} ${thread
    .map((m) => `${m.subject} ${m.body} ${m.snippet}`)
    .join(" ")}`.toLowerCase();

  const marketplaceSignals = [
    "leboncoin",
    "marketplace",
    "disponible",
    "prix",
    "vendredi",
    "samedi",
    "passer",
    "venir",
    "voir",
    "achat",
    "vendre",
    "pickup",
    "cash",
    "combien",
  ];

  const appointmentSignals = [
    "rendez-vous",
    "meeting",
    "appointment",
    "créneau",
    "horaire",
    "heure",
    "disponible",
    "vendredi",
    "demain",
  ];

  const supportSignals = [
    "support",
    "problem",
    "issue",
    "bug",
    "help",
    "aide",
    "problème",
    "erreur",
  ];

  const hasMarketplace = marketplaceSignals.some((s) => text.includes(s));
  const hasAppointment = appointmentSignals.some((s) => text.includes(s));
  const hasSupport = supportSignals.some((s) => text.includes(s));

  if (hasMarketplace) return "marketplace";
  if (hasSupport) return "support";
  if (hasAppointment) return "appointment";
  return "general";
}

function buildScenarioInstructions(scenario: string) {
  switch (scenario) {
    case "marketplace":
      return `
Scenario: marketplace / buyer-seller conversation

Marketplace rules:
- Be concrete and efficient
- Prefer proposing a clear next step
- If availability is known, reuse it
- If date or time is being discussed, anchor the reply around that
- Do not sound corporate
- Do not over-explain
- If price, pickup, condition or availability matters, address it directly
`;
    case "appointment":
      return `
Scenario: appointment / scheduling conversation

Scheduling rules:
- Confirm availability clearly
- Offer one or two concrete options when possible
- Ask for the exact time only if needed
- Keep it practical and light
`;
    case "support":
      return `
Scenario: support / issue conversation

Support rules:
- Acknowledge the issue briefly
- Focus on the next useful step
- Ask only one clarifying question if needed
- Stay calm and practical
`;
    default:
      return `
Scenario: general conversation

General rules:
- Reply naturally
- Move the conversation forward
- Keep the message useful and specific
`;
  }
}

async function loadThread(
  appUrl: string,
  cookieHeader: string,
  threadId?: string
): Promise<ThreadMessage[]> {
  if (!threadId) return [];

  try {
    const threadResponse = await fetch(`${appUrl}/api/thread`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ threadId }),
      cache: "no-store",
    });

    const threadData = await threadResponse.json();

    if (threadResponse.ok && Array.isArray(threadData?.thread)) {
      return threadData.thread;
    }

    return [];
  } catch {
    return [];
  }
}

async function loadLearningExamples(
  appUrl: string,
  cookieHeader: string
): Promise<LearningExample[]> {
  try {
    const learnResponse = await fetch(`${appUrl}/api/learn`, {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
      },
      cache: "no-store",
    });

    const learnData = await learnResponse.json();

    if (learnResponse.ok && Array.isArray(learnData?.examples)) {
      return learnData.examples;
    }

    return [];
  } catch {
    return [];
  }
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
      threadId,
    } = await request.json();

    if (!subject || !body) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    if (!appUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_APP_URL" },
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

    const cookieHeader = request.headers.get("cookie") || "";

    const [thread, learningExamples] = await Promise.all([
      loadThread(appUrl, cookieHeader, threadId),
      loadLearningExamples(appUrl, cookieHeader),
    ]);

    const styleInstructions = buildStyleInstructions(styleProfile);
    const decisionInstructions = buildDecisionInstructions(
      category,
      suggestedAction
    );
    const threadContext = formatThreadForPrompt(thread);
    const learningContext = formatLearningExamples(learningExamples);
    const scenario = detectScenario(subject, body, thread);
    const scenarioInstructions = buildScenarioInstructions(scenario);

    const prompt = `
You are helping a user reply to an email.

${styleInstructions}

${decisionInstructions}

${scenarioInstructions}

Past user correction examples:
${learningContext}

Email metadata:
- Sender: ${from || "Unknown sender"}
- Subject: ${subject}
- Category: ${category || "unknown"}
- Suggested action: ${suggestedAction || "unknown"}
- Scenario: ${scenario}

Current email body:
${body}

Conversation thread context:
${threadContext}

Your task:
Generate 3 realistic reply options that the user could actually send.

Before writing, understand:
- What does the sender want?
- What is the user's likely objective?
- What is the most useful next step?
- What information is already known in the thread?
- What information is still missing?

Reply types:
1. short = very concise, direct
2. balanced = best default option, natural and practical
3. detailed = more complete, more reassuring, still human

Critical rules:
- Use the thread context to avoid repeating or contradicting previous messages
- If the user already answered something in the thread, stay consistent with it
- Learn from the correction examples:
  - move closer to the user's edited replies
  - avoid patterns the user tends to rewrite
  - reuse the user's natural style when appropriate
- Make the reply feel like it was written in 10 seconds by a real human
- Prioritize usefulness over politeness
- Do not give vague generic replies
- If a concrete next step is possible, include it
- If details are missing, ask one short precise question instead of inventing
- Keep replies believable and actionable
- Return STRICT JSON only
- Do not mention AI
- Do not explain your reasoning
- Do not repeat the original email
- Do not sound overly corporate unless the style profile clearly suggests it

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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write realistic, useful email replies in the user's personal style. Use prior user corrections when available. Return only valid JSON.",
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
      threadUsed: thread.length > 0,
      threadMessageCount: thread.length,
      learningExamplesUsed: learningExamples.slice(0, 5).length,
      scenario,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate reply" },
      { status: 500 }
    );
  }
      }
