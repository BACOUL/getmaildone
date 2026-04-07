import { cookies } from "next/headers";
import { google } from "googleapis";

export async function GET() {
  try {
    const cookieStore = cookies();
    const tokenCookie = cookieStore.get("google_tokens");

    if (!tokenCookie) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const tokens = JSON.parse(tokenCookie.value);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: 5,
    });

    return Response.json({
      messages: res.data.messages || [],
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
