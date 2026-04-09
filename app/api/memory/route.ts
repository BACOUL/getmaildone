import { NextRequest, NextResponse } from "next/server";

type UserMemory = {
  preferredTone: "direct" | "friendly" | "professional" | "neutral";
  preferredFormality: "casual" | "neutral" | "formal";
  usualAvailability: string[];
  defaultMeetingArea: string;
  sellingPreferences: {
    negotiationAllowed: boolean;
    preferredPaymentMethods: string[];
    preferredHandoverType: string;
  };
  signaturePreference: string;
  extraInstructions: string;
  updatedAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __userMemory__: UserMemory | undefined;
}

function getDefaultMemory(): UserMemory {
  return {
    preferredTone: "neutral",
    preferredFormality: "neutral",
    usualAvailability: [],
    defaultMeetingArea: "",
    sellingPreferences: {
      negotiationAllowed: true,
      preferredPaymentMethods: [],
      preferredHandoverType: "",
    },
    signaturePreference: "",
    extraInstructions: "",
    updatedAt: new Date().toISOString(),
  };
}

function getMemory(): UserMemory {
  if (!global.__userMemory__) {
    global.__userMemory__ = getDefaultMemory();
  }

  return global.__userMemory__;
}

function sanitizeString(value: unknown, maxLength = 300) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizeStringArray(value: unknown, maxItems = 10, maxLength = 120) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeString(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

export async function GET() {
  try {
    const memory = getMemory();

    return NextResponse.json({
      memory,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load memory" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentMemory = getMemory();

    const nextMemory: UserMemory = {
      preferredTone: (
        ["direct", "friendly", "professional", "neutral"].includes(
          body?.preferredTone
        )
          ? body.preferredTone
          : currentMemory.preferredTone
      ) as UserMemory["preferredTone"],

      preferredFormality: (
        ["casual", "neutral", "formal"].includes(body?.preferredFormality)
          ? body.preferredFormality
          : currentMemory.preferredFormality
      ) as UserMemory["preferredFormality"],

      usualAvailability:
        body?.usualAvailability !== undefined
          ? sanitizeStringArray(body.usualAvailability, 12, 120)
          : currentMemory.usualAvailability,

      defaultMeetingArea:
        body?.defaultMeetingArea !== undefined
          ? sanitizeString(body.defaultMeetingArea, 200)
          : currentMemory.defaultMeetingArea,

      sellingPreferences: {
        negotiationAllowed:
          body?.sellingPreferences?.negotiationAllowed !== undefined
            ? sanitizeBoolean(
                body.sellingPreferences.negotiationAllowed,
                currentMemory.sellingPreferences.negotiationAllowed
              )
            : currentMemory.sellingPreferences.negotiationAllowed,

        preferredPaymentMethods:
          body?.sellingPreferences?.preferredPaymentMethods !== undefined
            ? sanitizeStringArray(
                body.sellingPreferences.preferredPaymentMethods,
                8,
                60
              )
            : currentMemory.sellingPreferences.preferredPaymentMethods,

        preferredHandoverType:
          body?.sellingPreferences?.preferredHandoverType !== undefined
            ? sanitizeString(body.sellingPreferences.preferredHandoverType, 120)
            : currentMemory.sellingPreferences.preferredHandoverType,
      },

      signaturePreference:
        body?.signaturePreference !== undefined
          ? sanitizeString(body.signaturePreference, 200)
          : currentMemory.signaturePreference,

      extraInstructions:
        body?.extraInstructions !== undefined
          ? sanitizeString(body.extraInstructions, 1000)
          : currentMemory.extraInstructions,

      updatedAt: new Date().toISOString(),
    };

    global.__userMemory__ = nextMemory;

    return NextResponse.json({
      success: true,
      memory: nextMemory,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save memory" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    global.__userMemory__ = getDefaultMemory();

    return NextResponse.json({
      success: true,
      memory: global.__userMemory__,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to reset memory" },
      { status: 500 }
    );
  }
}
