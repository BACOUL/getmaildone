import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthClient } from "../../../../../lib/google";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { error: "Missing OAuth code" },
        { status: 400 }
      );
    }

    const oauth2Client = getGoogleOAuthClient();

    const { tokens } = await oauth2Client.getToken(code);

    console.log("TOKENS:", tokens);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    );
  } catch (error: any) {
    console.error("OAUTH ERROR:", error);

    return NextResponse.json(
      { error: error.message || "OAuth failed" },
      { status: 500 }
    );
  }
}
