import { NextResponse } from "next/server";
import { getGoogleOAuthClient } from "../../../../lib/google";

export async function GET() {
  const oauth2Client = getGoogleOAuthClient();

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ],
  });

  return NextResponse.redirect(url);
}
