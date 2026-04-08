import { cookies } from "next/headers";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

function toBase64Url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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

    const tokens = JSON.parse(tokenCookie.value);

    const { to, subject, reply, threadId } = await request.json();

    if (!to || !subject || !reply) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const rawMessage = [
      `To: ${to}`,
      `Subject: Re: ${subject}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      reply,
    ].join("\n");

    const encodedMessage = toBase64Url(rawMessage);

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
        threadId: threadId || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      id: response.data.id,
      threadId: response.data.threadId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
