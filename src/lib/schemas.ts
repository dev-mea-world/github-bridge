import { z } from "zod";

export const ActionEnum = z.enum([
  "GET_FILE",
  "PUT_FILE",
  "CREATE_BRANCH",
  "OPEN_PR",
  "LIST_PRS",
  "MERGE_PR",
  "CREATE_ISSUE",
  "COMMENT_ISSUE",
  "ADD_LABELS",
  "SEARCH_CODE",
]);

export const baseSchema = z.object({
  agentId: z.string().min(1),
  repo: z.string().regex(/^[^/]+\/[^/]+$/),
  action: ActionEnum,
});

export const payloads = {
  GET_FILE: z.object({ path: z.string(), ref: z.string().default("main") }),
  PUT_FILE: z.object({
    path: z.string(),
    content: z.string(), // UTF-8 content
    message: z.string().default("chore: update via Glor.IA"),
    branch: z.string().optional(),
    baseRef: z.string().default("main"),
  }),
  CREATE_BRANCH: z.object({ branch: z.string(), fromRef: z.string().default("main") }),
  OPEN_PR: z.object({
    head: z.string(),
    base: z.string().default("main"),
    title: z.string(),
    body: z.string().optional(),
  }),
  LIST_PRS: z.object({ state: z.enum(["open", "closed", "all"]).default("open") }),
  MERGE_PR: z.object({ number: z.number(), method: z.enum(["merge", "squash", "rebase"]).default("squash") }),
  CREATE_ISSUE: z.object({ title: z.string(), body: z.string().optional(), labels: z.array(z.string()).optional() }),
  COMMENT_ISSUE: z.object({ number: z.number(), body: z.string() }),
  ADD_LABELS: z.object({ number: z.number(), labels: z.array(z.string()).min(1) }),
  SEARCH_CODE: z.object({ q: z.string().min(3) }),
} as const;

export const executeSchema = baseSchema.and(
  z.object({
    payload: z.union([
      payloads.GET_FILE,
      payloads.PUT_FILE,
      payloads.CREATE_BRANCH,
      payloads.OPEN_PR,
      payloads.LIST_PRS,
      payloads.MERGE_PR,
      payloads.CREATE_ISSUE,
      payloads.COMMENT_ISSUE,
      payloads.ADD_LABELS,
      payloads.SEARCH_CODE,
    ]),
  })
).superRefine((val, ctx) => {
  // Ensure payload type matches action
  const action = val.action;
  const p = (val as any).payload;
  const map = payloads as Record<string, z.ZodSchema<any>>;
  const schema = map[action];
  const parsed = schema.safeParse(p);
  if (!parsed.success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid payload for action ${action}` });
  }
});

export type ExecuteInput = z.infer<typeof executeSchema>;
export type Action = z.infer<typeof ActionEnum>;
