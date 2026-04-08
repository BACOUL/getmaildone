import { cookies } from "next/headers";
import { google } from "googleapis";
import { NextResponse } from "next/server";

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

  return cleaned.slice(0, 800);
}

type EmailCategory =
  | "reply_needed"
  | "important_info"
  | "transactional"
  | "promotional"
  | "ignore";

function classifyEmail(
  from: string,
  subject: string,
  body: string,
  snippet: string
): {
  category: EmailCategory;
  needsReply: boolean;
  priorityScore: number;
  reason: string;
} {
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

  if (hasReplySignal) priorityScore += 60;
  if (hasImportantInfo) priorityScore += 35;
  if (hasTransactional) priorityScore += 15;
  if (hasPromotional) priorityScore -= 60;
  if (hasNoReply) priorityScore -= 40;

  if (hasPromotional && !hasReplySignal) {
    return {
      category: "promotional",
      needsReply: false,
      priorityScore: Math.max(priorityScore, 0),
      reason: "Promotional or newsletter-like email detected",
    };
  }

  if (hasNoReply && !hasReplySignal) {
    return {
      category: "ignore",
      needsReply: false,
      priorityScore: Math.max(priorityScore, 0),
      reason: "No-reply or system notification detected",
    };
  }

  if (hasReplySignal) {
    return {
      category: "reply_needed",
      needsReply: true,
      priorityScore: Math.min(priorityScore, 100),
      reason: "Direct question or explicit reply intent detected",
    };
  }

  if (hasTransactional) {
    return {
      category: "transactional",
      needsReply: false,
      priorityScore: Math.min(priorityScore, 100),
      reason: "Transactional email detected",
    };
  }

  if (hasImportantInfo) {
    return {
      category: "important_info",
      needsReply: false,
      priorityScore: Math.min(priorityScore, 100),
      reason: "Important informational email detected",
    };
  }

  return {
    category: "ignore",
    needsReply: false,
    priorityScore: Math.max(priorityScore, 0),
    reason: "No clear reply intent detected",
  };
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

        const classification = classifyEmail(
          from,
          subject,
          cleanedBody,
          cleanedSnippet
        );

        return {
          id: msg.id,
          threadId: msg.threadId,
          subject: decodeHtml(subject),
          from: decodeHtml(from),
          snippet: cleanedSnippet,
          body: cleanedBody,
          category: classification.category,
          needsReply: classification.needsReply,
          priorityScore: classification.priorityScore,
          reason: classification.reason,
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
