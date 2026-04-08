import { cookies } from "next/headers";
import { google } from "googleapis";
import { NextResponse } from "next/server";

type EmailCategory =
  | "reply_needed"
  | "important_info"
  | "transactional"
  | "promotional"
  | "ignore";

type SuggestedAction = "reply" | "read" | "archive" | "ignore";

type ClassificationResult = {
  category: EmailCategory;
  needsReply: boolean;
  priorityScore: number;
  confidence: number;
  reason: string;
  suggestedAction: SuggestedAction;
};

function decodeHtml(value: string) {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function extractBodyFromPayload(payload: any): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }

    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }

    for (const part of payload.parts) {
      const nested = extractBodyFromPayload(part);
      if (nested) return nested;
    }
  }

  return "";
}

function cleanEmailBody(text: string) {
  if (!text) return "";

  let cleaned = decodeHtml(text);

  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, " ");
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, " ");
  cleaned = cleaned.replace(/<[^>]*>/g, " ");
  cleaned = cleaned.replace(/https?:\/\/\S+/gi, " ");
  cleaned = cleaned.replace(/\S+@\S+\.\S+/g, " ");
  cleaned = cleaned.replace(/&nbsp;/gi, " ");
  cleaned = cleaned.replace(/\[image:.*?\]/gi, " ");
  cleaned = cleaned.replace(
    /\b(?:facebook|instagram|twitter|linkedin|youtube|tiktok)\b/gi,
    " "
  );
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned.slice(0, 1200);
}

function isHumanLikeEmail(
  from: string,
  subject: string,
  body: string,
  snippet: string
) {
  const text = `${from} ${subject} ${body} ${snippet}`.toLowerCase();

  const humanSignals = [
    "bonjour",
    "bonsoir",
    "salut",
    "hello",
    "hi ",
    "merci",
    "je ",
    "j'ai",
    "j aimerais",
    "je voudrais",
    "vous ",
    "tu ",
    "disponible",
    "prix",
    "rendez-vous",
    "meeting",
    "intéressé",
    "interesse",
    "acheteur",
    "vendeur",
    "leboncoin",
    "marketplace",
    "?",
  ];

  const machineSignals = [
    "unsubscribe",
    "désabonner",
    "view in browser",
    "voir dans le navigateur",
    "privacy policy",
    "conditions générales",
    "terms of service",
    "newsletter",
    "promotion",
    "promotions",
    "promo",
    "marketing",
    "campaign",
    "mailchimp",
    "hubspot",
    "tracking number",
    "commande confirmée",
    "order confirmed",
    "invoice",
    "facture",
    "receipt",
    "receipts",
    "no-reply",
    "noreply",
    "do-not-reply",
    "notification@",
    "notifications@",
  ];

  let score = 0;

  for (const signal of humanSignals) {
    if (text.includes(signal)) score += 1;
  }

  for (const signal of machineSignals) {
    if (text.includes(signal)) score -= 2;
  }

  const shortNaturalMessage =
    body.length > 0 && body.length < 500 && /[?.!]/.test(body);
  if (shortNaturalMessage) score += 1;

  const hasRealQuestion =
    text.includes("?") ||
    text.includes("pouvez-vous") ||
    text.includes("pourriez-vous") ||
    text.includes("can you") ||
    text.includes("could you");

  if (hasRealQuestion) score += 2;

  return {
    isHuman: score > 0,
    score,
  };
}

function heuristicClassifyEmail(
  from: string,
  subject: string,
  body: string,
  snippet: string
): ClassificationResult {
  const haystack = `${from} ${subject} ${body} ${snippet}`.toLowerCase();

  const promotionalPatterns = [
    "newsletter",
    "promo",
    "promotion",
    "promotions",
    "discount",
    "soldes",
    "offre spéciale",
    "special offer",
    "unsubscribe",
    "désabonner",
    "manage preferences",
    "view in browser",
    "voir dans le navigateur",
    "mailchimp",
    "hubspot",
    "marketing",
    "campaign",
  ];

  const transactionalPatterns = [
    "receipt",
    "receipts",
    "invoice",
    "facture",
    "order confirmed",
    "commande confirmée",
    "shipping confirmation",
    "tracking number",
    "numéro de suivi",
    "your order",
    "votre commande",
    "payment received",
    "paiement reçu",
    "password reset",
    "réinitialisation",
    "security alert",
  ];

  const autoNoReplyPatterns = [
    "noreply",
    "no-reply",
    "do-not-reply",
    "donotreply",
    "notification@",
    "notifications@",
  ];

  const replySignals = [
    "?",
    "pouvez-vous",
    "pourriez-vous",
    "merci de",
    "merci par avance",
    "can you",
    "could you",
    "please",
    "let me know",
    "available",
    "disponible",
    "price",
    "prix",
    "still available",
    "toujours disponible",
    "i am interested",
    "je suis intéressé",
    "je suis interesse",
    "when can",
    "quand pouvez-vous",
    "rendez-vous",
    "meeting",
    "call me",
    "appelez-moi",
    "répondez-moi",
    "reply",
    "leboncoin",
    "marketplace",
  ];

  const importantInfoSignals = [
    "confirmed",
    "confirmé",
    "confirmed booking",
    "reservation",
    "rappel",
    "appointment",
    "meeting scheduled",
    "payment",
    "virement",
    "contract",
    "contrat",
    "document attached",
    "pièce jointe",
  ];

  let priorityScore = 0;

  const hasPromotional = promotionalPatterns.some((pattern) =>
    haystack.includes(pattern)
  );
  const hasTransactional = transactionalPatterns.some((pattern) =>
    haystack.includes(pattern)
  );
  const hasNoReply = autoNoReplyPatterns.some((pattern) =>
    haystack.includes(pattern)
  );
  const hasReplySignal = replySignals.some((pattern) =>
    haystack.includes(pattern)
  );
  const hasImportantInfo = importantInfoSignals.some((pattern) =>
    haystack.includes(pattern)
  );

  const humanCheck = isHumanLikeEmail(from, subject, body, snippet);

  if (hasReplySignal) priorityScore += 60;
  if (hasImportantInfo) priorityScore += 35;
  if (hasTransactional) priorityScore += 15;
  if (hasPromotional) priorityScore -= 60;
  if (hasNoReply) priorityScore -= 40;
  if (humanCheck.isHuman) priorityScore += 15;
  if (!humanCheck.isHuman) priorityScore -= 30;

  if (!humanCheck.isHuman && !hasReplySignal && !hasImportantInfo) {
    return {
      category: "ignore",
      needsReply: false,
      priorityScore: Math.max(priorityScore, 0),
      confidence: 0.82,
      reason: "Detected as automated or low human-intent email",
      suggestedAction: "ignore",
    };
  }

  if (hasPromotional && !hasReplySignal) {
    return {
      category: "promotional",
      needsReply: false,
      priorityScore: Math.max(priorityScore, 0),
      confidence: 0.72,
      reason: "Promotional or newsletter-like email detected",
      suggestedAction: "ignore",
    };
  }

  if (hasNoReply && !hasReplySignal) {
    return {
      category: "ignore",
      needsReply: false,
      priorityScore: Math.max(priorityScore, 0),
      confidence: 0.8,
      reason: "No-reply or system notification detected",
      suggestedAction: "ignore",
    };
  }

  if (hasReplySignal) {
    return {
      category: "reply_needed",
      needsReply: true,
      priorityScore: Math.min(priorityScore, 100),
      confidence: humanCheck.isHuman ? 0.8 : 0.74,
      reason: humanCheck.isHuman
        ? "Human-like message with direct reply intent detected"
        : "Direct question or explicit reply intent detected",
      suggestedAction: "reply",
    };
  }

  if (hasTransactional) {
    return {
      category: "transactional",
      needsReply: false,
      priorityScore: Math.min(priorityScore, 100),
      confidence: 0.76,
      reason: "Transactional email detected",
      suggestedAction: "archive",
    };
  }

  if (hasImportantInfo) {
    return {
      category: "important_info",
      needsReply: false,
      priorityScore: Math.min(priorityScore, 100),
      confidence: 0.68,
      reason: "Important informational email detected",
      suggestedAction: "read",
    };
  }

  return {
    category: "ignore",
    needsReply: false,
    priorityScore: Math.max(priorityScore, 0),
    confidence: 0.55,
    reason: humanCheck.isHuman
      ? "Human-like email but no clear reply intent detected"
      : "No clear reply intent detected",
    suggestedAction: "ignore",
  };
}

async function aiClassifyEmail(input: {
  from: string;
  subject: string;
  body: string;
  snippet: string;
  heuristic: ClassificationResult;
}): Promise<ClassificationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const prompt = `
Classify this email for a productivity assistant.

Return STRICT JSON only with this exact shape:
{
  "category": "reply_needed" | "important_info" | "transactional" | "promotional" | "ignore",
  "needsReply": boolean,
  "priorityScore": number,
  "confidence": number,
  "reason": string,
  "suggestedAction": "reply" | "read" | "archive" | "ignore"
}

Rules:
- reply_needed = a human reply is likely expected
- important_info = important to read, but no reply clearly needed
- transactional = system/order/invoice/receipt-like message
- promotional = newsletter, marketing, commercial campaign
- ignore = low-value system noise or irrelevant message
- give extra attention to whether this looks like a real human message or not

Priority score must be between 0 and 100.
Confidence must be between 0 and 1.

Heuristic result:
${JSON.stringify(input.heuristic)}

Email:
From: ${input.from}
Subject: ${input.subject}
Snippet: ${input.snippet}
Body: ${input.body.slice(0, 1500)}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You classify emails for actionability. Return only valid JSON.",
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
    return null;
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content);

    const validCategories: EmailCategory[] = [
      "reply_needed",
      "important_info",
      "transactional",
      "promotional",
      "ignore",
    ];

    const validActions: SuggestedAction[] = [
      "reply",
      "read",
      "archive",
      "ignore",
    ];

    if (
      !validCategories.includes(parsed.category) ||
      !validActions.includes(parsed.suggestedAction)
    ) {
      return null;
    }

    return {
      category: parsed.category,
      needsReply: Boolean(parsed.needsReply),
      priorityScore: Math.max(
        0,
        Math.min(100, Number(parsed.priorityScore) || 0)
      ),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reason: String(parsed.reason || "AI classification"),
      suggestedAction: parsed.suggestedAction,
    };
  } catch {
    return null;
  }
}

function mergeClassifications(
  heuristic: ClassificationResult,
  ai: ClassificationResult | null
): ClassificationResult {
  if (!ai) return heuristic;

  const useAi =
    ai.confidence >= 0.72 ||
    (heuristic.category === "ignore" && ai.category === "reply_needed") ||
    (heuristic.category === "promotional" && ai.category === "reply_needed");

  if (!useAi) {
    return heuristic;
  }

  return ai;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("google_tokens");

    if (!tokenCookie) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const tokens = JSON.parse(tokenCookie.value);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: 30,
    });

    const messages = list.data.messages || [];

    const detailedMessages = await Promise.all(
      messages.map(async (msg) => {
        const full = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        });

        const headers = full.data.payload?.headers || [];

        const subject =
          headers.find((h) => h.name === "Subject")?.value || "";

        const from = headers.find((h) => h.name === "From")?.value || "";

        const rawBody = extractBodyFromPayload(full.data.payload);
        const cleanedBody = cleanEmailBody(rawBody);
        const cleanedSnippet = decodeHtml(full.data.snippet || "");

        const safeSubject = decodeHtml(subject);
        const safeFrom = decodeHtml(from);

        const heuristic = heuristicClassifyEmail(
          safeFrom,
          safeSubject,
          cleanedBody,
          cleanedSnippet
        );

        const ai = await aiClassifyEmail({
          from: safeFrom,
          subject: safeSubject,
          body: cleanedBody,
          snippet: cleanedSnippet,
          heuristic,
        });

        const classification = mergeClassifications(heuristic, ai);

        return {
          id: msg.id,
          threadId: msg.threadId,
          subject: safeSubject,
          from: safeFrom,
          snippet: cleanedSnippet,
          body: cleanedBody,
          category: classification.category,
          needsReply: classification.needsReply,
          priorityScore: classification.priorityScore,
          confidence: classification.confidence,
          reason: classification.reason,
          suggestedAction: classification.suggestedAction,
        };
      })
    );

    const sortedMessages = detailedMessages
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 10);

    return NextResponse.json({
      messages: sortedMessages,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load emails" },
      { status: 500 }
    );
  }
  }
