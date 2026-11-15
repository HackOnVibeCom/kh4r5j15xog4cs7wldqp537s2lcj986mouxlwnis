import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { VERDICTS, type CheckResult } from "./schema";

const SEPARATOR = "~";

/** SHARE_SECRET if set; otherwise derived from the AI key so a deploy needs one secret, not two. */
export function signingSecret(): string {
  if (process.env.SHARE_SECRET) return process.env.SHARE_SECRET;
  const aiKey = process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (aiKey) {
    return createHash("sha256").update(`share-links:${aiKey}`).digest("hex");
  }
  if (process.env.NODE_ENV !== "production") return "local-development-only";
  throw new Error("No secret available to sign warning links.");
}

function mac(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest().subarray(0, 16);
}

/** Only what a warning page needs, trimmed so the link stays a reasonable length. */
function forSharing(result: CheckResult): CheckResult {
  return {
    ...result,
    message: result.message.slice(0, 1500),
    flags: result.flags.slice(0, 8).map((flag) => ({ ...flag, quote: flag.quote.slice(0, 200), reason: flag.reason.slice(0, 300) })),
    advice: result.advice.slice(0, 4),
    links: result.links.slice(0, 5),
  };
}

/**
 * Packs a verdict into a signed, compressed link token. Nothing is stored on a server:
 * the warning lives in the link, and the signature stops anyone forging a "no red flags" card.
 */
export function signShare(result: CheckResult, secret = signingSecret()): string {
  const data = deflateRawSync(Buffer.from(JSON.stringify(forSharing(result)))).toString("base64url");
  return `${data}${SEPARATOR}${mac(data, secret).toString("base64url")}`;
}

export function verifyShare(token: string, secret = signingSecret()): CheckResult | null {
  const [data, signature, ...rest] = decodeURIComponent(token).split(SEPARATOR);
  if (!data || !signature || rest.length) return null;

  const given = Buffer.from(signature, "base64url");
  const expected = mac(data, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const parsed = JSON.parse(inflateRawSync(Buffer.from(data, "base64url"), { maxOutputLength: 64_000 }).toString("utf8"));
    if (!VERDICTS.includes(parsed?.verdict) || typeof parsed.headline !== "string" || !Array.isArray(parsed.flags)) {
      return null;
    }
    return parsed as CheckResult;
  } catch {
    return null;
  }
}
