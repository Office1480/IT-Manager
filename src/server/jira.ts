import "server-only";
import { decryptText } from "@/lib/crypto";

type Org = { jiraBaseUrl: string | null; jiraEmail: string | null; jiraTokenEnc: string | null; jiraDefaultProject: string | null; jiraIssueType: string | null };

export const jiraConfigured = (o: Org) => !!(o.jiraBaseUrl && o.jiraEmail && o.jiraTokenEnc);

const para = (text: string) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const heading = (text: string) => ({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] });

/** Crée un ticket Jira Cloud (API REST v3) à partir d'une idée validée. */
export async function createJiraIssue(
  org: Org,
  input: { projectKey?: string | null; summary: string; sections: { title: string; body: string | null }[]; labels?: string[] },
) {
  if (!jiraConfigured(org)) throw new Error("JIRA_NOT_CONFIGURED");
  const projectKey = input.projectKey || org.jiraDefaultProject;
  if (!projectKey) throw new Error("JIRA_NO_PROJECT");
  const base = org.jiraBaseUrl!.replace(/\/+$/, "");
  const auth = Buffer.from(`${org.jiraEmail}:${decryptText(org.jiraTokenEnc)}`).toString("base64");
  const content = input.sections.filter((s) => s.body).flatMap((s) => [heading(s.title), ...s.body!.split(/\n{2,}/).map(para)]);
  const res = await fetch(`${base}/rest/api/3/issue`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary: input.summary.slice(0, 250),
        issuetype: { name: org.jiraIssueType || "Epic" },
        labels: input.labels ?? ["it-manager"],
        description: { type: "doc", version: 1, content: content.length ? content : [para(input.summary)] },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`JIRA_${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { key: string };
  return { key: json.key, url: `${base}/browse/${json.key}` };
}
