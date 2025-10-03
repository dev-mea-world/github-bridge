import { verifyHmacRaw, verifyJwtOptional, isRepoAllowed, ipFromRequest, checkRateLimit, getIdempotent, setIdempotent } from "@/lib/auth";
import { env } from "@/lib/env";
import { logger, withRequest } from "@/lib/logger";
import { executeSchema, payloads } from "@/lib/schemas";
import { addLabels, commentIssue, createIssue, createBranch, getFileUtf8, listPrs, mergePr, openPr, putFileUtf8, searchCode } from "@/lib/github";

export const runtime = "nodejs";

type ErrorShape = { error: { code: string; message: string; details?: any } };

function errorResponse(status: number, code: string, message: string, details?: any) {
  const body: ErrorShape = { error: { code, message, ...(details ? { details } : {}) } };
  return Response.json(body, { status });
}

function mapOctokitError(e: any): { status: number; code: string; message: string; details?: any } {
  const status = e?.status ?? 500;
  const message = e?.message || "Unexpected error";
  const details = e?.response?.data || undefined;
  let code = "INTERNAL";
  if (status === 400) code = "BAD_REQUEST";
  if (status === 401) code = "UNAUTHORIZED";
  else if (status === 403) code = "FORBIDDEN";
  else if (status === 404) code = "NOT_FOUND";
  else if (status === 422) code = "VALIDATION_FAILED";
  else if (status === 429) code = "RATE_LIMITED";
  return { status, code, message, details };
}

export async function POST(request: Request) {
  const reqId = request.headers.get("x-request-id") || undefined;
  const log = withRequest(logger, { requestId: reqId, action: "agent:execute" });

  // Read raw body once
  const rawAb = await request.arrayBuffer();
  const raw = Buffer.from(rawAb);

  // HMAC verification first
  const signature = request.headers.get("x-signature");
  const { ok: hmacOk } = verifyHmacRaw(raw, signature, env.AGENT_SHARED_SECRET);
  if (!hmacOk) {
    return errorResponse(401, "UNAUTHORIZED", "Invalid HMAC signature");
  }

  // Parse JSON after HMAC validated
  let body: any;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return errorResponse(400, "BAD_REQUEST", "Invalid JSON");
  }

  // Validate request
  const parsed = executeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(422, "VALIDATION_FAILED", "Invalid payload", parsed.error.flatten());
  }
  const data = parsed.data as typeof parsed.data & { payload: any };

  const ip = ipFromRequest(request);
  const rateKey = `${data.agentId}|${ip}`;
  const rate = checkRateLimit(rateKey);
  if (!rate.ok) {
    return errorResponse(429, "RATE_LIMITED", "Too many requests", { resetAt: rate.resetAt });
  }

  // Optional JWT
  if (request.headers.has("authorization") && env.AGENT_JWT_SECRET) {
    const v = verifyJwtOptional(request.headers.get("authorization"), env.AGENT_JWT_SECRET);
    if (!v.valid) {
      return errorResponse(401, "UNAUTHORIZED", v.reason || "JWT invalid");
    }
  }

  // Repo allowlist
  if (!isRepoAllowed(data.repo)) {
    return errorResponse(403, "FORBIDDEN", "Repository not allowed");
  }

  const logWithCtx = withRequest(log, { agentId: data.agentId, action: data.action, repo: data.repo });

  try {
    // Optional Idempotency for PUT_FILE and OPEN_PR
    const idemKey = request.headers.get("idempotency-key");
    const isIdemAction = data.action === "PUT_FILE" || data.action === "OPEN_PR";
    if (idemKey && isIdemAction) {
      const cached = getIdempotent(idemKey);
      if (cached) {
        return new Response(JSON.stringify(cached.body), { status: cached.status, headers: cached.headers });
      }
    }

    let result: any;
    let status = 200;
    switch (data.action) {
      case "GET_FILE": {
        const p = payloads.GET_FILE.parse(data.payload);
        const out = await getFileUtf8({ repoFull: data.repo, path: p.path, ref: p.ref });
        result = out;
        break;
      }
      case "PUT_FILE": {
        const p = payloads.PUT_FILE.parse(data.payload);
        const out = await putFileUtf8({ repoFull: data.repo, path: p.path, content: p.content, message: p.message, branch: p.branch, baseRef: p.baseRef });
        status = out.status === 201 ? 201 : 200;
        result = { branch: out.branch, path: out.path, sha: out.sha, commitUrl: out.commitUrl };
        break;
      }
      case "CREATE_BRANCH": {
        const p = payloads.CREATE_BRANCH.parse(data.payload);
        const out = await createBranch(data.repo, p.branch, p.fromRef);
        status = 201;
        result = out;
        break;
      }
      case "OPEN_PR": {
        const p = payloads.OPEN_PR.parse(data.payload);
        const out = await openPr(data.repo, { head: p.head, base: p.base, title: p.title, body: p.body });
        status = 201;
        result = { number: out.number, url: out.url };
        break;
      }
      case "LIST_PRS": {
        const p = payloads.LIST_PRS.parse(data.payload);
        const out = await listPrs(data.repo, p.state);
        result = out;
        break;
      }
      case "MERGE_PR": {
        const p = payloads.MERGE_PR.parse(data.payload);
        const out = await mergePr(data.repo, p.number, p.method);
        result = out;
        break;
      }
      case "CREATE_ISSUE": {
        const p = payloads.CREATE_ISSUE.parse(data.payload);
        const out = await createIssue(data.repo, { title: p.title, body: p.body, labels: p.labels });
        status = 201;
        result = out;
        break;
      }
      case "COMMENT_ISSUE": {
        const p = payloads.COMMENT_ISSUE.parse(data.payload);
        const out = await commentIssue(data.repo, { number: p.number, body: p.body });
        result = out;
        break;
      }
      case "ADD_LABELS": {
        const p = payloads.ADD_LABELS.parse(data.payload);
        const out = await addLabels(data.repo, { number: p.number, labels: p.labels });
        result = out;
        break;
      }
      case "SEARCH_CODE": {
        const p = payloads.SEARCH_CODE.parse(data.payload);
        const out = await searchCode(data.repo, p.q);
        result = out;
        break;
      }
      default: {
        return errorResponse(400, "BAD_REQUEST", "Unknown action");
      }
    }

    if (request.headers.has("idempotency-key") && (data.action === "PUT_FILE" || data.action === "OPEN_PR")) {
      const k = request.headers.get("idempotency-key")!;
      setIdempotent(k, status, result, { "content-type": "application/json" });
    }

    return Response.json(result, { status });
  } catch (e: any) {
    const mapped = mapOctokitError(e);
    logWithCtx.error({ code: mapped.code, status: mapped.status }, "execute failed");
    return errorResponse(mapped.status, mapped.code, mapped.message, mapped.details);
  }
}
