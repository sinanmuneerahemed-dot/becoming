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
    const model = readModel();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

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
        const errText = await res.text();
        return NextResponse.json(
          { error: `Gemini upstream error (${res.status})`, details: errText.slice(0, 500) },
          { status: 502 }
        );
      }

      const data = await res.json();
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) {
        return NextResponse.json({ error: "Gemini returned an empty response." }, { status: 502 });
      }

      return NextResponse.json({ text });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return NextResponse.json({ error: "AI request timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: (err as Error).message || "AI request failed." }, { status: 500 });
  }
}
