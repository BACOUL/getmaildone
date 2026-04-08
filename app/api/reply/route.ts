import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { from, subject, body } = await request.json();

    if (!subject || !body) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const prompt = `
You are a professional email assistant.

Write a short, clear, natural reply to this email.

Sender: ${from || "Unknown sender"}
Subject: ${subject}
Email body: ${body}

Rules:
- Keep the reply concise
- Be polite and professional
- Do not over-explain
- Do not repeat the original email
- Return only the reply text
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You write short professional email replies.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.4,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "OpenAI request failed" },
        { status: 500 }
      );
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    return NextResponse.json({
      reply: reply || "No reply generated.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate reply" },
      { status: 500 }
    );
  }
}
