import { cookies } from "next/headers";
import { google } from "googleapis";
import { NextResponse } from "next/server";

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

    // 1. Liste des messages
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: 5,
    });

    const messages = list.data.messages || [];

    // 2. Détail de chaque message
    const detailedMessages = await Promise.all(
      messages.map(async (msg) => {
        const full = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
        });

        const headers = full.data.payload?.headers || [];

        const subject =
          headers.find((h) => h.name === "Subject")?.value || "";

        const from =
          headers.find((h) => h.name === "From")?.value || "";

        return {
          id: msg.id,
          threadId: msg.threadId,
          subject,
          from,
          snippet: full.data.snippet,
        };
      })
    );

    return NextResponse.json({
      messages: detailedMessages,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load emails" },
      { status: 500 }
    );
  }
}
