import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";

describe("auth utils", () => {
  beforeAll(() => {
    process.env.GITHUB_MODE = "PAT"; // to satisfy env schema
    process.env.GH_TOKEN = "test_token";
    process.env.GH_WEBHOOK_SECRET = "whsec";
    process.env.AGENT_SHARED_SECRET = "secret";
    process.env.REPO_ALLOWLIST = "foo/bar,acme/app";
  });

  it("verifyHmacRaw ok + mismatch", async () => {
    const { verifyHmacRaw } = await import("../src/lib/auth");
    const raw = Buffer.from(JSON.stringify({ a: 1 }));
    const expected =
      "sha256=" + crypto.createHmac("sha256", process.env.AGENT_SHARED_SECRET!).update(raw).digest("hex");
    const ok = verifyHmacRaw(raw, expected, process.env.AGENT_SHARED_SECRET!);
    expect(ok.ok).toBe(true);
    const bad = verifyHmacRaw(raw, "sha256=deadbeef", process.env.AGENT_SHARED_SECRET!);
    expect(bad.ok).toBe(false);
  });

  it("isRepoAllowed honors CSV", async () => {
    const { isRepoAllowed } = await import("../src/lib/auth");
    expect(isRepoAllowed("foo/bar")).toBe(true);
    expect(isRepoAllowed("acme/app")).toBe(true);
    expect(isRepoAllowed("nope/repo")).toBe(false);
  });
});

