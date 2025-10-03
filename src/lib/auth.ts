import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "@/lib/env";

type VerifyHmacResult = {
  ok: boolean;
  expected: string;
  received?: string;
  raw: Buffer;
};

export async function verifyHmac(request: Request, secret: string): Promise<VerifyHmacResult> {
  const rawAb = await request.arrayBuffer();
  const raw = Buffer.from(rawAb);
  const received = request.headers.get("x-signature") || request.headers.get("X-Signature") || undefined;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const ok = received ? timingSafeEqual(expected, received) : false;
  return { ok, expected, received, raw };
}

export function verifyHmacRaw(raw: Buffer, providedSignature: string | null | undefined, secret: string): { ok: boolean; expected: string; received?: string } {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const ok = providedSignature ? timingSafeEqual(expected, providedSignature) : false;
  return { ok, expected, received: providedSignature ?? undefined };
}

export function verifyGithubWebhook(raw: Buffer, signatureHeader: string | null, secret: string): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return signatureHeader ? timingSafeEqual(expected, signatureHeader) : false;
}

export function timingSafeEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

export function verifyJwtOptional(authorizationHeader: string | null, secret?: string): { valid: boolean; payload?: any; reason?: string } {
  if (!authorizationHeader) return { valid: true };
  const m = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return { valid: false, reason: "Invalid Authorization format" };
  if (!secret) return { valid: false, reason: "JWT secret not configured" };
  try {
    const payload = jwt.verify(m[1], secret);
    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, reason: err?.message || "JWT verification failed" };
  }
}

export function isRepoAllowed(repo: string): boolean {
  const list = env.REPO_ALLOWLIST.split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(repo);
}

// Simple in-memory rate limiter
type RateEntry = { count: number; resetAt: number };
const rateMap = new Map<string, RateEntry>();

export function checkRateLimit(key: string, limit = 60, windowMs = 5 * 60 * 1000): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    const next: RateEntry = { count: 1, resetAt: now + windowMs };
    rateMap.set(key, next);
    return { ok: true, remaining: limit - 1, resetAt: next.resetAt };
  }
  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { ok: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export function ipFromRequest(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") || "";
  return xf.split(",")[0].trim() || "unknown";
}

// Optional simple in-memory Idempotency-Key cache (5 minutes)
type IdemEntry = { storedAt: number; expireAt: number; status: number; body: any; headers: Record<string, string> };
const idemCache = new Map<string, IdemEntry>();

export function getIdempotent(key: string): IdemEntry | undefined {
  const val = idemCache.get(key);
  if (!val) return undefined;
  if (Date.now() > val.expireAt) {
    idemCache.delete(key);
    return undefined;
  }
  return val;
}

export function setIdempotent(key: string, status: number, body: any, headers: Record<string, string> = {}, ttlMs = 5 * 60 * 1000): void {
  idemCache.set(key, { storedAt: Date.now(), expireAt: Date.now() + ttlMs, status, body, headers });
}

