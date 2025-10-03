import { Octokit } from "@octokit/rest";
import { App } from "@octokit/app";
import { env } from "@/lib/env";
import { nanoid } from "nanoid";

export function parseRepo(repo: string): { owner: string; repo: string } {
  const [owner, name] = repo.split("/");
  return { owner, repo: name };
}

export async function getOctokit(): Promise<Octokit> {
  if (env.GITHUB_MODE === "PAT") {
    return new Octokit({ auth: env.GH_TOKEN });
  }
  // APP mode
  const app = new App({
    appId: env.GH_APP_ID!,
    privateKey: env.GH_APP_PRIVATE_KEY_PEM!,
  });
  const token = await app.getInstallationAccessToken({
    installationId: env.GH_APP_INSTALLATION_ID!,
  });
  return new Octokit({ auth: token });
}

export async function getFileUtf8(params: { repoFull: string; path: string; ref?: string }) {
  const { repoFull, path, ref = "main" } = params;
  const { owner, repo } = parseRepo(repoFull);
  const octokit = await getOctokit();
  const res = await octokit.repos.getContent({ owner, repo, path, ref });
  if (!("content" in res.data)) {
    throw Object.assign(new Error("Path is not a file"), { status: 400 });
  }
  const contentB64 = res.data.content as string;
  const content = Buffer.from(contentB64, "base64").toString("utf8");
  return { path: res.data.path, ref, sha: (res.data.sha as string), content };
}

export async function createBranch(repoFull: string, branch: string, fromRef = "main") {
  const { owner, repo } = parseRepo(repoFull);
  const octokit = await getOctokit();
  const from = await octokit.git.getRef({ owner, repo, ref: `heads/${fromRef}` });
  const sha = from.data.object.sha;
  const res = await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha });
  return { ok: true, branch, sha: res.data.object.sha };
}

export async function ensureBranch(repoFull: string, branch: string, fromRef = "main") {
  const { owner, repo } = parseRepo(repoFull);
  const octokit = await getOctokit();
  try {
    await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    return { existed: true };
  } catch (err: any) {
    if (err?.status === 404) {
      await createBranch(repoFull, branch, fromRef);
      return { existed: false };
    }
    throw err;
  }
}

export async function putFileUtf8(params: {
  repoFull: string;
  path: string;
  content: string;
  message?: string;
  branch?: string;
  baseRef?: string;
}) {
  const { repoFull, path, content, message = "chore: update via Glor.IA", baseRef = "main" } = params;
  let { branch } = params;
  const { owner, repo } = parseRepo(repoFull);
  const octokit = await getOctokit();

  if (!branch) {
    branch = `gloria/auto-${nanoid(8)}`;
    await createBranch(repoFull, branch, baseRef);
  } else {
    await ensureBranch(repoFull, branch, baseRef);
  }

  let sha: string | undefined = undefined;
  try {
    const current = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    if ("sha" in current.data) sha = (current.data as any).sha;
  } catch (err: any) {
    if (err?.status !== 404) throw err;
  }

  const res = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
    sha,
    committer: {
      name: "Glor.IA Bot",
      email: "gloria-bot@meaworld.com",
    },
    author: {
      name: "Glor.IA Bot",
      email: "gloria-bot@meaworld.com",
    },
  });

  const commitUrl = (res.data as any)?.commit?.html_url ?? undefined;
  const contentSha = (res.data as any)?.content?.sha ?? undefined;
  const status = res.status; // 201 created, 200 updated

  return { branch: branch!, path, sha: contentSha, commitUrl, status };
}

export async function openPr(repoFull: string, params: { head: string; base?: string; title: string; body?: string }) {
  const { owner, repo } = parseRepo(repoFull);
  const octokit = await getOctokit();
  const res = await octokit.pulls.create({ owner, repo, head: params.head, base: params.base ?? "main", title: params.title, body: params.body });
  return { number: res.data.number, url: res.data.html_url };
}

export async function listPrs(repoFull: string, state: "open" | "closed" | "all" = "open") {
  const { owner, repo } = parseRepo(repoFull);
  const octokit = await getOctokit();
  const res = await octokit.pulls.list({ owner, repo, state });
  return res.data;
}

export async function mergePr(repoFull: string, number: number, method: "merge" | "squash" | "rebase" = "squash") {
  const { owner, repo } = parseRepo(repoFull);
  const octokit = await getOctokit();
  const res = await octokit.pulls.merge({ owner, repo, pull_number: number, merge_method: method as any });
  return res.data;
}

export async function createIssue(repoFull: string, params: { title: string; body?: string; labels?: string[] }) {
  const { owner, repo } = parseRepo(repoFull);
  const octokit = await getOctokit();
  const res = await octokit.issues.create({ owner, repo, title: params.title, body: params.body, labels: params.labels });
  return res.data;
}

export async function commentIssue(repoFull: string, params: { number: number; body: string }) {
  const { owner, repo } = parseRepo(repoFull);
  const octokit = await getOctokit();
  const res = await octokit.issues.createComment({ owner, repo, issue_number: params.number, body: params.body });
  return res.data;
}

export async function addLabels(repoFull: string, params: { number: number; labels: string[] }) {
  const { owner, repo } = parseRepo(repoFull);
  const octokit = await getOctokit();
  const res = await octokit.issues.addLabels({ owner, repo, issue_number: params.number, labels: params.labels });
  return res.data;
}

export async function searchCode(repoFull: string, q: string) {
  const { owner, repo } = parseRepo(repoFull);
  const octokit = await getOctokit();
  const res = await octokit.search.code({ q: `${q} repo:${owner}/${repo}` });
  return res.data;
}

