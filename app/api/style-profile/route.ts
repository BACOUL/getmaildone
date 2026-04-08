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

function cleanText(text: string) {
  if (!text) return "";

  let cleaned = decodeHtml(text);

  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, " ");
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, " ");
  cleaned = cleaned.replace(/<[^>]*>/g, " ");
  cleaned = cleaned.replace(/https?:\/\/\S+/gi, " ");
  cleaned = cleaned.replace(/\S+@\S+\.\S+/g, " ");
  cleaned = cleaned.replace(/&nbsp;/gi, " ");
  cleaned = cleaned.replace(/\r/g, " ");
  cleaned = cleaned.replace(/\t/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

function normalizeSnippet(text: string) {
  return cleanText(text).slice(0, 500);
}

function average(numbers: number[]) {
  if (!numbers.length) return 0;
  return Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length);
}

function countWords(text: string) {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function startsWithAny(text: string, values: string[]) {
  const lower = text.toLowerCase();
  return values.some((value) => lower.startsWith(value));
}

function includesAny(text: string, values: string[]) {
  const lower = text.toLowerCase();
  return values.some((value) => lower.includes(value));
}

function classifyLength(avgWords: number) {
  if (avgWords <= 20) return "very_short";
  if (avgWords <= 50) return "short";
  if (avgWords <= 120) return "medium";
  return "long";
}

function detectFormality(samples: string[]) {
  let formalScore = 0;
  let casualScore = 0;

  for (const text of samples) {
    const lower = text.toLowerCase();

    if (
      includesAny(lower, [
        "bonjour",
        "bonsoir",
        "madame",
        "monsieur",
        "cordialement",
        "bien cordialement",
        "sincerely",
        "best regards",
        "kind regards",
        "dear ",
      ])
    ) {
      formalScore += 2;
    }

    if (
      includesAny(lower, [
        "salut",
        "hello",
        "hi ",
        "merci",
        "à bientôt",
        "a bientot",
        "see you",
        "thanks",
        "ok",
      ])
    ) {
      casualScore += 1;
    }

    if (includesAny(lower, ["vous ", " votre ", " vos "])) {
      formalScore += 1;
    }

    if (includesAny(lower, [" tu ", " ton ", " ta ", " tes "])) {
      casualScore += 1;
    }
  }

  if (formalScore >= casualScore + 3) return "formal";
  if (casualScore >= formalScore + 3) return "casual";
  return "neutral";
}

function detectGreetingStyle(samples: string[]) {
  const greetings = [
    "bonjour",
    "bonsoir",
    "salut",
    "hello",
    "hi",
    "dear",
    "cher",
    "chère",
  ];

  const found = samples
    .map((text) => {
      const lower = text.toLowerCase().trim();
      return greetings.find((greeting) => lower.startsWith(greeting));
    })
    .filter(Boolean) as string[];

  const counts: Record<string, number> = {};
  for (const value of found) {
    counts[value] = (counts[value] || 0) + 1;
  }

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "none";
}

function detectClosingStyle(samples: string[]) {
  const closings = [
    "cordialement",
    "bien cordialement",
    "merci",
    "merci beaucoup",
    "best regards",
    "kind regards",
    "thanks",
    "à bientôt",
    "a bientot",
  ];

  const found: string[] = [];

  for (const text of samples) {
    const lower = text.toLowerCase();
    for (const closing of closings) {
      if (lower.includes(closing)) {
        found.push(closing);
      }
    }
  }

  const counts: Record<string, number> = {};
  for (const value of found) {
    counts[value] = (counts[value] || 0) + 1;
  }

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "none";
}

function extractCommonPhrases(samples: string[]) {
  const phraseCandidates = [
    "merci pour votre message",
    "merci pour ton message",
    "je vous confirme",
    "je te confirme",
    "je reviens vers vous",
    "je reviens vers toi",
    "n'hésitez pas",
    "n’hesitez pas",
    "let me know",
    "thank you for your message",
    "i confirm",
    "i will get back to you",
    "bien cordialement",
    "cordialement",
  ];

  const hits: Record<string, number> = {};

  for (const sample of samples) {
    const lower = sample.toLowerCase();
    for (const phrase of phraseCandidates) {
      if (lower.includes(phrase)) {
        hits[phrase] = (hits[phrase] || 0) + 1;
      }
    }
  }

  return Object.entries(hits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);
}

function detectDecisionNotes(samples: string[]) {
  let concise = 0;
  let suggestive = 0;
  let polite = 0;

  for (const sample of samples) {
    const lower = sample.toLowerCase();

    if (countWords(sample) <= 40) concise += 1;

    if (
      includesAny(lower, [
        "dites-moi",
        "dis-moi",
        "let me know",
        "n'hésitez pas",
        "n’hesitez pas",
        "feel free",
      ])
    ) {
      suggestive += 1;
    }

    if (
      includesAny(lower, [
        "merci",
        "cordialement",
        "best regards",
        "kind regards",
        "s'il vous plaît",
        "please",
      ])
    ) {
      polite += 1;
    }
  }

  return {
    conciseReplies: concise >= Math.max(3, Math.floor(samples.length * 0.4)),
    oftenSuggestsNextStep:
      suggestive >= Math.max(2, Math.floor(samples.length * 0.25)),
    consistentlyPolite:
      polite >= Math.max(3, Math.floor(samples.length * 0.4)),
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

    const sentList = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["SENT"],
      maxResults: 30,
    });

    const sentMessages = sentList.data.messages || [];

    if (!sentMessages.length) {
      return NextResponse.json({
        profile: {
          tone: "neutral",
          formality: "neutral",
          averageLength: "medium",
          averageWords: 0,
          greetingStyle: "none",
          closingStyle: "none",
          commonPhrases: [],
          decisionNotes: {
            conciseReplies: false,
            oftenSuggestsNextStep: false,
            consistentlyPolite: false,
          },
          sampleCount: 0,
        },
      });
    }

    const samples = await Promise.all(
      sentMessages.map(async (msg) => {
        const full = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        });

        const rawBody = extractBodyFromPayload(full.data.payload);
        const cleanedBody = cleanText(rawBody);
        const snippet = normalizeSnippet(full.data.snippet || "");

        const finalText =
          cleanedBody && cleanedBody.length >= 20 ? cleanedBody : snippet;

        return finalText;
      })
    );

    const usableSamples = samples
      .filter(Boolean)
      .map((sample) => sample.trim())
      .filter((sample) => sample.length >= 15)
      .slice(0, 20);

    const wordCounts = usableSamples.map(countWords);
    const avgWords = average(wordCounts);

    const formality = detectFormality(usableSamples);
    const greetingStyle = detectGreetingStyle(usableSamples);
    const closingStyle = detectClosingStyle(usableSamples);
    const commonPhrases = extractCommonPhrases(usableSamples);
    const decisionNotes = detectDecisionNotes(usableSamples);

    const tone =
      formality === "formal"
        ? "professional"
        : formality === "casual"
        ? "friendly"
        : "neutral";

    return NextResponse.json({
      profile: {
        tone,
        formality,
        averageLength: classifyLength(avgWords),
        averageWords: avgWords,
        greetingStyle,
        closingStyle,
        commonPhrases,
        decisionNotes,
        sampleCount: usableSamples.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to build style profile" },
      { status: 500 }
    );
  }
    }
