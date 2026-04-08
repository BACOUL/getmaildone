import { NextRequest, NextResponse } from "next/server";

type LearningExample = {
  id: string;
  originalReply: string;
  editedReply: string;
  emailContext: {
    from?: string;
    subject?: string;
    body?: string;
    category?: string;
  };
  createdAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __learningMemory__: LearningExample[] | undefined;
}

function getLearningMemory() {
  if (!global.__learningMemory__) {
    global.__learningMemory__ = [];
  }

  return global.__learningMemory__;
}

export async function POST(request: NextRequest) {
  try {
    const { originalReply, editedReply, emailContext } = await request.json();

    if (!originalReply || !editedReply) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const memory = getLearningMemory();

    const example: LearningExample = {
      id: crypto.randomUUID(),
      originalReply: String(originalReply).trim(),
      editedReply: String(editedReply).trim(),
      emailContext: {
        from: emailContext?.from || "",
        subject: emailContext?.subject || "",
        body: emailContext?.body || "",
        category: emailContext?.category || "",
      },
      createdAt: new Date().toISOString(),
    };

    memory.unshift(example);

    global.__learningMemory__ = memory.slice(0, 50);

    return NextResponse.json({
      success: true,
      saved: true,
      count: global.__learningMemory__.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save learning example" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const memory = getLearningMemory();

    return NextResponse.json({
      examples: memory.slice(0, 10),
      total: memory.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load learning examples" },
      { status: 500 }
    );
  }
}
