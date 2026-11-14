import { z } from "zod";
import { AnalysisError, IMAGE_TYPES } from "@/lib/analyze";
import { runCheck } from "@/lib/check";
import { createRateLimiter } from "@/lib/ratelimit";
import { signShare } from "@/lib/token";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT = 5000;
const MAX_IMAGE_BASE64 = 5_500_000; // about 4 MB of image

const BodySchema = z
  .object({
    text: z.string().max(MAX_TEXT).optional(),
    image: z
      .object({ data: z.string().max(MAX_IMAGE_BASE64), mediaType: z.enum(IMAGE_TYPES) })
      .optional(),
    uiLanguage: z.string().max(35).optional(),
  })
  .refine((body) => (body.text && body.text.trim().length > 0) || body.image, {
    message: "Paste a message or add a screenshot.",
  });

const allow = createRateLimiter({ limit: 12, windowMs: 10 * 60 * 1000 });

const FRIENDLY: Record<AnalysisError["kind"], { status: number; error: string }> = {
  config: { status: 503, error: "The checker isn't set up yet. Please try again later." },
  busy: { status: 503, error: "Lots of people are checking messages right now. Please try again in a minute." },
  refused: { status: 422, error: "We couldn't check this one. Don't act on the message until you've verified it another way." },
  failed: { status: 502, error: "Something went wrong while checking. Please try again." },
};

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(ip)) {
    return Response.json({ error: "You've checked a lot of messages in a short time. Please wait a few minutes." }, { status: 429 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await runCheck({
      text: body.text?.trim() || undefined,
      image: body.image,
      uiLanguage: body.uiLanguage || "en",
    });
    return Response.json({ result, token: signShare(result) });
  } catch (error) {
    if (error instanceof AnalysisError) {
      console.error(`check failed: ${error.kind}: ${error.message}`);
      const { status, error: message } = FRIENDLY[error.kind];
      return Response.json({ error: message }, { status });
    }
    console.error("check failed", error);
    return Response.json({ error: FRIENDLY.failed.error }, { status: 500 });
  }
}
