import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";

describe("github webhook signature", () => {
  beforeAll(() => {
    process.env.GITHUB_MODE = "PAT";
    process.env.GH_TOKEN = "test_token";
    process.env.GH_WEBHOOK_SECRET = "whsec";
    process.env.AGENT_SHARED_SECRET = "secret";
    process.env.REPO_ALLOWLIST = "foo/bar";
  });

  it("verifyGithubWebhook() true/false", async () => {
    const { verifyGithubWebhook } = await import("../src/lib/auth");
    const raw = Buffer.from(JSON.stringify({ hook: "ok" }));
    const sig =
      "sha256=" + crypto.createHmac("sha256", process.env.GH_WEBHOOK_SECRET!).update(raw).digest("hex");
    expect(verifyGithubWebhook(raw, sig, process.env.GH_WEBHOOK_SECRET!)).toBe(true);
    expect(verifyGithubWebhook(raw, "sha256=badsignature", process.env.GH_WEBHOOK_SECRET!)).toBe(false);
  });
});

