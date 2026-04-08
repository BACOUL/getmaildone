import { cookies } from "next/headers";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

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
  cleaned = cleaned.replace(/\[image:.*?\]/gi, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned.slice(0, 1500);
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("google_tokens");

    if (!tokenCookie) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { threadId } = await request.json();

    if (!threadId) {
      return NextResponse.json(
        { error: "Missing threadId" },
        { status: 400 }
      );
    }

    const tokens = JSON.parse(tokenCookie.value);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const threadResponse = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const messages = threadResponse.data.messages || [];

    const cleanedThread = messages.map((message) => {
      const headers = message.payload?.headers || [];

      const from =
        headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";

      const subject =
        headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";

      const date =
        headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";

      const rawBody = extractBodyFromPayload(message.payload);
      const body = cleanText(rawBody);
      const snippet = cleanText(message.snippet || "");

      return {
        id: message.id || "",
        threadId: message.threadId || threadId,
        from: decodeHtml(from),
        subject: decodeHtml(subject),
        date,
        snippet,
        body,
      };
    });

    return NextResponse.json({
      threadId,
      messageCount: cleanedThread.length,
      thread: cleanedThread,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load thread" },
      { status: 500 }
    );
  }
}
