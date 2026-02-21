import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface GeminiGenerationOptions {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
}

interface GenerateBody {
  prompt?: unknown;
  options?: unknown;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 25;
const rateLimitBuckets = new Map<string, RateLimitBucket>();
const UPSTREAM_TIMEOUT_MS = 55000;
const UPSTREAM_RETRIES = 4;

function readApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Gemini API key is missing. Set GEMINI_API_KEY on the server.");
  }
  return key;
}

function readModel(): string {
  return process.env.GEMINI_MODEL || "gemini-flash-latest";
}

function readModelCandidates(): string[] {
  const primary = readModel();
  const fromEnv = (process.env.GEMINI_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  // Secondary fallback model improves resilience when one model is quota-limited.
  const candidates = [primary, ...fromEnv, "gemini-1.5-flash-latest"];
  return Array.from(new Set(candidates));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(headerValue: string | null): number {
  if (!headerValue) return 0;
  const n = Number(headerValue.trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(20, Math.max(1, Math.floor(n)));
}

function readClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    if (first?.trim()) return first.trim();
  }
  return "unknown";
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = rateLimitBuckets.get(key);
  if (!existing || now >= existing.resetAt) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  rateLimitBuckets.set(key, existing);
  return {
    allowed: true,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

function sanitizeOptions(input: unknown): GeminiGenerationOptions {
  if (!input || typeof input !== "object") return {};
  const obj = input as Record<string, unknown>;

  const temperature = typeof obj.temperature === "number" ? obj.temperature : undefined;
  const maxOutputTokens = typeof obj.maxOutputTokens === "number" ? obj.maxOutputTokens : undefined;
  const responseMimeType = typeof obj.responseMimeType === "string" ? obj.responseMimeType : undefined;

  return {
    temperature:
      temperature !== undefined
        ? Math.max(0, Math.min(2, temperature))
        : undefined,
    maxOutputTokens:
      maxOutputTokens !== undefined
        ? Math.max(128, Math.min(8192, Math.floor(maxOutputTokens)))
        : undefined,
    responseMimeType:
      responseMimeType && responseMimeType.length <= 64
        ? responseMimeType
        : undefined,
  };
}

export async function POST(req: NextRequest) {
  const ip = readClientIp(req);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a few minutes." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
        },
      }
    );
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
  }
  if (prompt.length > 12000) {
    return NextResponse.json({ error: "Prompt is too long." }, { status: 400 });
  }

  const options = sanitizeOptions(body.options);
  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.7,
    maxOutputTokens: options.maxOutputTokens ?? 2048,
  };
  if (options.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }

  try {
    const apiKey = readApiKey();
    const modelCandidates = readModelCandidates();
    let lastStatus = 0;
    let lastDetails = "";

    for (const model of modelCandidates) {
      for (let attempt = 0; attempt < UPSTREAM_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig,
              }),
            }
          );

          if (!res.ok) {
            lastStatus = res.status;
            lastDetails = (await res.text()).slice(0, 500);
            const retryable = [429, 500, 502, 503, 504].includes(res.status);
            const shouldRetry = attempt < UPSTREAM_RETRIES - 1 && retryable;
            if (shouldRetry) {
              const retryAfter =
                res.status === 429
                  ? parseRetryAfterSeconds(res.headers.get("retry-after"))
                  : 0;
              const backoffMs = retryAfter > 0
                ? retryAfter * 1000
                : Math.min(10000, 1200 * (attempt + 1));
              await sleep(backoffMs);
              continue;
            }
            // Model unsupported or exhausted; move to next model candidate.
            if ([404, 429, 500, 502, 503, 504].includes(res.status)) {
              break;
            }
            return NextResponse.json(
              { error: `Gemini upstream error (${res.status})`, details: lastDetails },
              { status: 502 }
            );
          }

          const data = await res.json();
          const parts = data?.candidates?.[0]?.content?.parts;
          const text: string = Array.isArray(parts)
            ? parts
                .map((p: unknown) => {
                  if (!p || typeof p !== "object") return "";
                  const t = (p as { text?: unknown }).text;
                  return typeof t === "string" ? t : "";
                })
                .join("")
                .trim()
            : "";
          if (!text) {
            lastStatus = 502;
            lastDetails = "Gemini returned empty text payload.";
            const shouldRetry = attempt < UPSTREAM_RETRIES - 1;
            if (shouldRetry) {
              await sleep(Math.min(10000, 1200 * (attempt + 1)));
              continue;
            }
            break;
          }

          return NextResponse.json({ text });
        } catch (err) {
          if ((err as Error).name === "AbortError") {
            if (attempt < UPSTREAM_RETRIES - 1) {
              await sleep(Math.min(10000, 1200 * (attempt + 1)));
              continue;
            }
            lastStatus = 504;
            lastDetails = `Timeout at model ${model}`;
            break;
          }
          if (attempt < UPSTREAM_RETRIES - 1) {
            await sleep(Math.min(10000, 1200 * (attempt + 1)));
            continue;
          }
          lastStatus = 500;
          lastDetails = (err as Error).message || "Unknown upstream error.";
          break;
        } finally {
          clearTimeout(timeout);
        }
      }
    }

    return NextResponse.json(
      { error: `Gemini upstream error (${lastStatus || 500})`, details: lastDetails || "Unknown upstream failure." },
      { status: 502 }
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || "AI request failed." }, { status: 500 });
  }
}
