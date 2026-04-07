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

    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: 5,
    });

    return NextResponse.json({
      messages: res.data.messages || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load emails" },
      { status: 500 }
    );
  }
}
