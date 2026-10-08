import { NextRequest, NextResponse } from "next/server";
import { generateSpeakingTemplate } from "@/lib/ai/claude-client";
import { checkRateLimit } from "@/lib/rate-limit";
import { withErrorHandler, ValidationError, NotFoundError, RateLimitError } from "@/lib/api-error-handler";

const VALID_TONES = new Set(["professional", "assertive"]);

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "unknown"
  );
}

/**
 * POST /api/local/template
 * Body: { agendaItemTitle, agendaItemDescription, tone: "professional" | "assertive" }
 *
 * Stricter rate limit: 5 requests per hour per IP because each call
 * invokes Claude Sonnet (expensive API credits).
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const ip = getClientIP(request);
  const { allowed, retryAfter } = await checkRateLimit(
    `ai-template:${ip}`,
    5,     // 5 requests
    3600   // per hour
  );
  if (!allowed) {
    throw new RateLimitError("Too many requests. Please try again later.", { retryAfter });
  }

  const body = await request.json();
  const { agendaItemTitle, agendaItemDescription, tone } = body;

  if (
    !agendaItemTitle ||
    typeof agendaItemTitle !== "string" ||
    agendaItemTitle.length > 500 ||
    !tone ||
    !VALID_TONES.has(tone)
  ) {
    throw new ValidationError("agendaItemTitle (max 500 chars) and tone ('professional' or 'assertive') are required");
  }

  const template = await generateSpeakingTemplate({
    agendaItemTitle: agendaItemTitle.trim(),
    agendaItemDescription:
      typeof agendaItemDescription === "string"
        ? agendaItemDescription.trim().slice(0, 2000)
        : "",
    tone,
  });

  return NextResponse.json({ template });
}, { route: "POST /api/local/template" });
