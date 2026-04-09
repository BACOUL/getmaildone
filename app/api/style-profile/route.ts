import { cookies } from "next/headers";
import { google } from "googleapis";
import { NextResponse } from "next/server";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function extractBody(payload: any): string {
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
  }

  return "";
}

function clean(text: string) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
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

    // 🔥 On prend TES emails envoyés
    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: 20,
      q: "in:sent",
    });

    const messages = res.data.messages || [];

    const samples: string[] = [];

    for (const msg of messages.slice(0, 10)) {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });

      const body = clean(extractBody(full.data.payload));

      if (body.length > 20) {
        samples.push(body);
      }
    }

    if (samples.length === 0) {
      return NextResponse.json({
        profile: null,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    const prompt = `
Analyze how this person writes emails.

Samples:
${samples.join("\n\n---\n\n")}

Return STRICT JSON:
{
  "tone": "",
  "formality": "",
  "averageLength": "",
  "averageWords": number,
  "greetingStyle": "",
  "closingStyle": "",
  "commonPhrases": [],
  "decisionNotes": {
    "conciseReplies": boolean,
    "oftenSuggestsNextStep": boolean,
    "consistentlyPolite": boolean
  },
  "sampleCount": number
}
`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content: "You analyze writing style. Return only JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content;

    let profile = null;

    try {
      profile = JSON.parse(content);
    } catch {
      profile = null;
    }

    return NextResponse.json({
      profile,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to build style profile" },
      { status: 500 }
    );
  }
}
