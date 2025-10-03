export const runtime = "nodejs";

const openapiBase = {
  openapi: "3.1.0",
  info: {
    title: "Glor.IA GitHub Bridge API",
    version: "0.1.0",
    description: "Bridge API for performing GitHub actions on allowed repositories with HMAC authentication.",
  },
  // servers will be set dynamically in GET based on request origin
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["ok"] },
                    ts: { type: "string" },
                  },
                  required: ["status", "ts"],
                },
              },
            },
          },
        },
      },
    },
    "/api/agent/execute": {
      post: {
        summary: "Execute a GitHub action",
        operationId: "executeAction",
        security: [{ HmacAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ExecuteRequest" },
              examples: {
                open_pr: {
                  summary: "Open PR",
                  value: {
                    agentId: "gloria",
                    repo: "owner/repo",
                    action: "OPEN_PR",
                    payload: { head: "gloria/auto-123", title: "Glor.IA PR" }
                  }
                },
                put_file: {
                  summary: "Put file (auto-branch)",
                  value: {
                    agentId: "gloria",
                    repo: "owner/repo",
                    action: "PUT_FILE",
                    payload: { path: "README.md", content: "Hello" }
                  }
                }
              }
            },
          },
        },
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/R_GET_FILE" },
                    { $ref: "#/components/schemas/R_LIST_PRS" },
                    { $ref: "#/components/schemas/R_MERGE_PR" },
                    { $ref: "#/components/schemas/R_COMMENT_ISSUE" },
                    { $ref: "#/components/schemas/R_ADD_LABELS" },
                    { $ref: "#/components/schemas/R_SEARCH_CODE" },
                    { type: "object" } // fallback for other 200s
                  ]
                },
                examples: {
                  list_prs: {
                    summary: "List PRs",
                    value: [
                      { number: 1, state: "open", title: "Example PR" }
                    ]
                  },
                  get_file: {
                    summary: "Get file",
                    value: { path: "README.md", ref: "main", sha: "abc123", content: "# Title" }
                  }
                }
              }
            }
          },
          201: {
            description: "Created",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/R_PUT_FILE" },
                    { $ref: "#/components/schemas/R_OPEN_PR" },
                    { $ref: "#/components/schemas/R_CREATE_ISSUE" },
                    { $ref: "#/components/schemas/R_CREATE_BRANCH" }
                  ]
                },
                examples: {
                  open_pr: {
                    summary: "Open PR",
                    value: { number: 42, url: "https://github.com/owner/repo/pull/42" }
                  },
                  put_file: {
                    summary: "Put file",
                    value: { branch: "gloria/auto-abc123", path: "README.md", sha: "def456", commitUrl: "https://github.com/owner/repo/commit/def456" }
                  },
                  create_issue: {
                    summary: "Create issue",
                    value: { number: 101, title: "Bug: ...", html_url: "https://github.com/owner/repo/issues/101" }
                  }
                }
              }
            }
          },
          400: { $ref: "#/components/responses/Error" },
          401: { $ref: "#/components/responses/Error" },
          403: { $ref: "#/components/responses/Error" },
          404: { $ref: "#/components/responses/Error" },
          422: { $ref: "#/components/responses/Error" },
          429: { $ref: "#/components/responses/Error" },
          500: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/github/webhook": {
      post: {
        summary: "GitHub webhook receiver",
        operationId: "receiveGithubWebhook",
        security: [{ GithubWebhookAuth: [] }],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { type: "boolean" } },
                  required: ["ok"],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Error" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      HmacAuth: {
        type: "apiKey",
        in: "header",
        name: "X-Signature",
        description: "HMAC SHA256 signature as sha256=<hex> over raw body using shared secret.",
      },
      GithubWebhookAuth: {
        type: "apiKey",
        in: "header",
        name: "X-Hub-Signature-256",
        description: "GitHub webhook signature (sha256=...) verified with GH_WEBHOOK_SECRET.",
      },
    },
    responses: {
      Error: {
        description: "Error response",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {},
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
      ExecuteRequest: {
        type: "object",
        required: ["agentId", "repo", "action", "payload"],
        properties: {
          agentId: { type: "string" },
          repo: { type: "string", pattern: "^[^/]+/[^/]+$" },
          action: { $ref: "#/components/schemas/ActionEnum" },
          payload: { $ref: "#/components/schemas/ActionPayload" },
        },
      },
      ActionEnum: {
        type: "string",
        enum: [
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
        ],
      },
      ActionPayload: {
        oneOf: [
          { $ref: "#/components/schemas/P_GET_FILE" },
          { $ref: "#/components/schemas/P_PUT_FILE" },
          { $ref: "#/components/schemas/P_CREATE_BRANCH" },
          { $ref: "#/components/schemas/P_OPEN_PR" },
          { $ref: "#/components/schemas/P_LIST_PRS" },
          { $ref: "#/components/schemas/P_MERGE_PR" },
          { $ref: "#/components/schemas/P_CREATE_ISSUE" },
          { $ref: "#/components/schemas/P_COMMENT_ISSUE" },
          { $ref: "#/components/schemas/P_ADD_LABELS" },
          { $ref: "#/components/schemas/P_SEARCH_CODE" },
        ],
      },
      P_GET_FILE: {
        type: "object",
        required: ["path"],
        properties: { path: { type: "string" }, ref: { type: "string", default: "main" } },
      },
      P_PUT_FILE: {
        type: "object",
        required: ["path", "content"],
        properties: {
          path: { type: "string" },
          content: { type: "string" },
          message: { type: "string", default: "chore: update via Glor.IA" },
          branch: { type: "string" },
          baseRef: { type: "string", default: "main" },
        },
      },
      P_CREATE_BRANCH: {
        type: "object",
        required: ["branch"],
        properties: { branch: { type: "string" }, fromRef: { type: "string", default: "main" } },
      },
      P_OPEN_PR: {
        type: "object",
        required: ["head", "title"],
        properties: {
          head: { type: "string" },
          base: { type: "string", default: "main" },
          title: { type: "string" },
          body: { type: "string" },
        },
      },
      P_LIST_PRS: {
        type: "object",
        properties: { state: { type: "string", enum: ["open", "closed", "all"], default: "open" } },
      },
      P_MERGE_PR: {
        type: "object",
        required: ["number"],
        properties: { number: { type: "number" }, method: { type: "string", enum: ["merge", "squash", "rebase"], default: "squash" } },
      },
      P_CREATE_ISSUE: {
        type: "object",
        required: ["title"],
        properties: { title: { type: "string" }, body: { type: "string" }, labels: { type: "array", items: { type: "string" } } },
      },
      P_COMMENT_ISSUE: {
        type: "object",
        required: ["number", "body"],
        properties: { number: { type: "number" }, body: { type: "string" } },
      },
      P_ADD_LABELS: {
        type: "object",
        required: ["number", "labels"],
        properties: { number: { type: "number" }, labels: { type: "array", items: { type: "string" }, minItems: 1 } },
      },
      P_SEARCH_CODE: {
        type: "object",
        required: ["q"],
        properties: { q: { type: "string", minLength: 3 } },
      },
      R_GET_FILE: {
        type: "object",
        required: ["path", "ref", "sha", "content"],
        properties: {
          path: { type: "string" },
          ref: { type: "string" },
          sha: { type: "string" },
          content: { type: "string" }
        }
      },
      R_PUT_FILE: {
        type: "object",
        required: ["branch", "path"],
        properties: {
          branch: { type: "string" },
          path: { type: "string" },
          sha: { type: "string" },
          commitUrl: { type: "string" }
        }
      },
      R_CREATE_BRANCH: {
        type: "object",
        required: ["ok", "branch"],
        properties: {
          ok: { type: "boolean" },
          branch: { type: "string" },
          sha: { type: "string" }
        }
      },
      R_OPEN_PR: {
        type: "object",
        required: ["number", "url"],
        properties: {
          number: { type: "number" },
          url: { type: "string" }
        }
      },
      R_LIST_PRS: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            number: { type: "number" },
            state: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            html_url: { type: "string" },
            user: {
              type: "object",
              properties: { login: { type: "string" }, id: { type: "number" }, html_url: { type: "string" } }
            },
            head: {
              type: "object",
              properties: {
                ref: { type: "string" },
                sha: { type: "string" },
                repo: { type: "object", properties: { full_name: { type: "string" }, html_url: { type: "string" } } }
              }
            },
            base: {
              type: "object",
              properties: {
                ref: { type: "string" },
                sha: { type: "string" },
                repo: { type: "object", properties: { full_name: { type: "string" }, html_url: { type: "string" } } }
              }
            },
            created_at: { type: "string" },
            updated_at: { type: "string" },
            draft: { type: "boolean" }
          }
        }
      },
      R_MERGE_PR: {
        type: "object",
        properties: {
          merged: { type: "boolean" },
          message: { type: "string" },
          sha: { type: "string" }
        }
      },
      R_CREATE_ISSUE: {
        type: "object",
        properties: {
          id: { type: "number" },
          number: { type: "number" },
          title: { type: "string" },
          state: { type: "string" },
          body: { type: "string" },
          html_url: { type: "string" },
          user: { type: "object", properties: { login: { type: "string" }, id: { type: "number" } } },
          labels: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "number" }, name: { type: "string" }, color: { type: "string" }, description: { type: "string" }, default: { type: "boolean" } }
            }
          },
          created_at: { type: "string" },
          updated_at: { type: "string" }
        }
      },
      R_COMMENT_ISSUE: {
        type: "object",
        properties: {
          id: { type: "number" },
          html_url: { type: "string" },
          body: { type: "string" },
          user: { type: "object", properties: { login: { type: "string" }, id: { type: "number" } } },
          created_at: { type: "string" },
          updated_at: { type: "string" },
          issue_url: { type: "string" }
        }
      },
      R_ADD_LABELS: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "number" }, name: { type: "string" }, color: { type: "string" }, description: { type: "string" }, default: { type: "boolean" } }
        }
      },
      R_SEARCH_CODE: {
        type: "object",
        properties: {
          total_count: { type: "number" },
          incomplete_results: { type: "boolean" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                path: { type: "string" },
                sha: { type: "string" },
                html_url: { type: "string" },
                score: { type: "number" },
                repository: {
                  type: "object",
                  properties: { full_name: { type: "string" }, html_url: { type: "string" } }
                }
              }
            }
          }
        }
      }
    },
  },
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const openapi = { ...openapiBase, servers: [{ url: origin }] } as const;
  return Response.json(openapi);
}
