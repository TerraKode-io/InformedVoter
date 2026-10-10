import { prisma } from "@/lib/db";
import { resend, EMAIL_FROM } from "@/lib/resend";
import { buildVerificationEmail } from "@/lib/email/verification-template";
import { withErrorHandler, ValidationError, NotFoundError } from "@/lib/api-error-handler";

// ─────────────────────────────────────────────
// POST /api/subscribe
// Body: { email: string, stateAbbr: string }
// ─────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

export const POST = withErrorHandler(async (request: Request) => {
    const body = await request.json();
    const email = (body.email as string)?.trim().toLowerCase();
    const stateAbbr = (body.stateAbbr as string)?.trim().toUpperCase();

    if (!email || !EMAIL_RE.test(email)) {
      throw new ValidationError("Please enter a valid email address.");
    }

    if (email.length > 254) {
      throw new ValidationError("Email address is too long.");
    }

    if (!stateAbbr || !VALID_STATES.has(stateAbbr)) {
      throw new ValidationError("Please select a valid US state.");
    }

    // Upsert: if already verified, silently succeed (no enumeration leak)
    // If unverified, regenerate token and re-send
    const existing = await prisma.subscriber.findUnique({
      where: { email },
      select: { verified: true },
    });

    if (existing?.verified) {
      // Already subscribed — respond identically to prevent enumeration
      return Response.json({
        success: true,
        message: "Check your email to confirm your subscription.",
      });
    }

    const subscriber = await prisma.subscriber.upsert({
      where: { email },
      create: { email, stateAbbr },
      update: {
        stateAbbr,
        verificationToken: crypto.randomUUID(),
      },
    });

    // Send verification email
    if (resend) {
      const { subject, html } = buildVerificationEmail(
        stateAbbr,
        subscriber.verificationToken
      );
      await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject,
        html,
      });
    }

    // Never leak profileToken for unverified subscribers.
    // The token is only exposed after email verification.
    return Response.json({
      success: true,
      message: "Check your email to confirm your subscription.",
    });
}, { route: "POST /api/subscribe" });
