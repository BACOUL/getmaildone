import { google } from "googleapis";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    console.log("CALLBACK URL:", request.url);
    console.log("CALLBACK SEARCH:", new URL(request.url).search);

    console.log("CALLBACK GOOGLE_CLIENT_ID exists:", Boolean(clientId));
    console.log("CALLBACK GOOGLE_CLIENT_SECRET exists:", Boolean(clientSecret));
    console.log("CALLBACK GOOGLE_REDIRECT_URI exists:", Boolean(redirectUri));
    console.log("CALLBACK NEXT_PUBLIC_APP_URL exists:", Boolean(appUrl));

    if (!clientId || !clientSecret || !redirectUri || !appUrl) {
      throw new Error(
        `Missing envs in callback: GOOGLE_CLIENT_ID=${Boolean(
          clientId
        )}, GOOGLE_CLIENT_SECRET=${Boolean(
          clientSecret
        )}, GOOGLE_REDIRECT_URI=${Boolean(
          redirectUri
        )}, NEXT_PUBLIC_APP_URL=${Boolean(appUrl)}`
      );
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    console.log("CALLBACK CODE:", code);
    console.log("CALLBACK ERROR:", error);

    if (!code) {
      throw new Error(`Missing OAuth code. Google returned error=${error}`);
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);

    console.log("CALLBACK TOKENS RECEIVED:", Boolean(tokens?.access_token));

    const cookieStore = await cookies();
    cookieStore.set("google_tokens", JSON.stringify(tokens), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.redirect(`${appUrl}/dashboard`);
  } catch (error: any) {
    console.error("CALLBACK OAUTH ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "OAuth callback failed",
      },
      { status: 500 }
    );
  }
}
