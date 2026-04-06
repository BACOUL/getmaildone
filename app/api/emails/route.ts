import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message:
      "OAuth is working. Next step: store tokens so we can fetch Gmail messages.",
  });
}
