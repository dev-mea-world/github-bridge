import { verifyGithubWebhook } from "@/lib/auth";
import { logger, withRequest } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const reqId = request.headers.get("x-request-id") || undefined;
  const log = withRequest(logger, { requestId: reqId, action: "github:webhook" });

  const rawAb = await request.arrayBuffer();
  const raw = Buffer.from(rawAb);
  const sig = request.headers.get("x-hub-signature-256");

  const webhookSecret = process.env.GH_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json(
      { error: { code: "CONFIG_ERROR", message: "GH_WEBHOOK_SECRET not configured" } },
      { status: 500 }
    );
  }

  const ok = verifyGithubWebhook(raw, sig, webhookSecret);
  if (!ok) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Invalid webhook signature" } }, { status: 401 });
  }

  const event = request.headers.get("x-github-event") || "unknown";
  // Best-effort safe log (no payload dump)
  log.info({ event }, "webhook received");

  return Response.json({ ok: true });
}
