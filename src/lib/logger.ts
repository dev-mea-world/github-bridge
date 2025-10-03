import pino from "pino";
import type { Logger } from "pino";
import { env } from "@/lib/env";
import { nanoid } from "nanoid";

const isDev = env.NODE_ENV !== "production";

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          singleLine: true,
        },
      }
    : undefined,
  base: undefined, // don't include pid/hostname by default
  serializers: {
    // Never log secrets
  },
});

export function getRequestId(init?: string): string {
  return init?.trim() || nanoid(12);
}

export function withRequest(loggerBase: Logger, fields: {
  requestId?: string;
  agentId?: string;
  action?: string;
  repo?: string;
}) {
  const child = loggerBase.child({
    requestId: fields.requestId ?? getRequestId(),
    ...(fields.agentId ? { agentId: fields.agentId } : {}),
    ...(fields.action ? { action: fields.action } : {}),
    ...(fields.repo ? { repo: fields.repo } : {}),
  });
  return child;
}
