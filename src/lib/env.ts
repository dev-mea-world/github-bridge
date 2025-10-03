import { z } from "zod";

const EnvSchema = z
  .object({
    GITHUB_MODE: z.enum(["PAT", "APP"]),
    GH_TOKEN: z.string().optional(),
    GH_APP_ID: z.string().optional(),
    GH_APP_PRIVATE_KEY: z.string().optional(), // base64-encoded PEM
    GH_APP_INSTALLATION_ID: z.string().optional(),
    // Make webhook secret optional at schema-level so build does not fail
    GH_WEBHOOK_SECRET: z.string().optional(),

    AGENT_SHARED_SECRET: z.string(),
    AGENT_JWT_SECRET: z.string().optional(),

    REPO_ALLOWLIST: z.string(),

    NODE_ENV: z
      .enum(["development", "test", "production"]) // default inferred below
      .optional(),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]) // default inferred below
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.GITHUB_MODE === "PAT") {
      if (!val.GH_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GH_TOKEN is required when GITHUB_MODE=PAT",
          path: ["GH_TOKEN"],
        });
      }
    } else if (val.GITHUB_MODE === "APP") {
      if (!val.GH_APP_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GH_APP_ID is required when GITHUB_MODE=APP",
          path: ["GH_APP_ID"],
        });
      }
      if (!val.GH_APP_PRIVATE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GH_APP_PRIVATE_KEY (base64) is required when GITHUB_MODE=APP",
          path: ["GH_APP_PRIVATE_KEY"],
        });
      }
      if (!val.GH_APP_INSTALLATION_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GH_APP_INSTALLATION_ID is required when GITHUB_MODE=APP",
          path: ["GH_APP_INSTALLATION_ID"],
        });
      }
    }
  });

type Parsed = z.infer<typeof EnvSchema>;
type EnvResolved = Omit<Parsed, "GH_APP_ID" | "GH_APP_INSTALLATION_ID"> & {
  GH_APP_ID?: number;
  GH_APP_INSTALLATION_ID?: number;
  GH_APP_PRIVATE_KEY_PEM?: string;
};

let cachedEnv: EnvResolved | undefined;

export function getEnv(): EnvResolved {
  if (cachedEnv) return cachedEnv;
  const parsed = EnvSchema.parse({
    GITHUB_MODE: process.env.GITHUB_MODE,
    GH_TOKEN: process.env.GH_TOKEN,
    GH_APP_ID: process.env.GH_APP_ID,
    GH_APP_PRIVATE_KEY: process.env.GH_APP_PRIVATE_KEY,
    GH_APP_INSTALLATION_ID: process.env.GH_APP_INSTALLATION_ID,
    GH_WEBHOOK_SECRET: process.env.GH_WEBHOOK_SECRET,

    AGENT_SHARED_SECRET: process.env.AGENT_SHARED_SECRET,
    AGENT_JWT_SECRET: process.env.AGENT_JWT_SECRET,

    REPO_ALLOWLIST: process.env.REPO_ALLOWLIST,

    NODE_ENV: process.env.NODE_ENV ?? "development",
    LOG_LEVEL: (process.env.LOG_LEVEL as any) ?? "info",
  });

  const GH_APP_PRIVATE_KEY_PEM = parsed.GH_APP_PRIVATE_KEY
    ? Buffer.from(parsed.GH_APP_PRIVATE_KEY, "base64").toString("utf8")
    : undefined;

  const out: EnvResolved = {
    ...parsed,
    GH_APP_ID: parsed.GH_APP_ID ? Number(parsed.GH_APP_ID) : undefined,
    GH_APP_INSTALLATION_ID: parsed.GH_APP_INSTALLATION_ID
      ? Number(parsed.GH_APP_INSTALLATION_ID)
      : undefined,
    GH_APP_PRIVATE_KEY_PEM,
  };
  cachedEnv = out;
  return cachedEnv;
}

export type Env = EnvResolved;
