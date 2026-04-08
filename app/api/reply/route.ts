import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { subject, from, body } = await request.json();

    if (!subject || !body) {
      return NextResponse.json(
        { error: "Missing data" },
        { status: 400 }
      );
    }

    const prompt = `
You are an assistant that writes short, professional email replies.

Email received:
From: ${from}
Subject: ${subject}
Body: ${body}

Write a concise reply.
Tone: professional, simple, friendly.
Do not repeat the original message.
`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You write email replies." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    const data = await res.json();

    const reply =
      data?.choices?.[0]?.message?.content || "Failed to generate reply";

    return NextResponse.json({ reply });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate reply" },
      { status: 500 }
    );
  }
}
