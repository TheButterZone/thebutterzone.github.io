import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

/**
 * Fetch ALL open issues once per run
 */
export async function getAllOpenIssues() {
  const issues = await octokit.rest.issues.listForRepo({
    owner: 'TheButterZone',
    repo: 'thebutterzone.github.io',
    state: 'open',
    per_page: 100
  });

  return issues.data;
}

/**
 * Build username → issue map (in-memory index)
 */
export function buildIssueIndex(issues) {
  const map = new Map();

  for (const issue of issues) {
    const text = `${issue.title || ''}\n${issue.body || ''}`.toLowerCase();

    // Extract simple match based on known pattern (github username)
    // We rely on substring match as before, but locally
    for (const word of text.split(/\s+/)) {
      if (word.startsWith('@')) {
        const username = word.slice(1);
        map.set(username, issue);
      }
    }
  }

  return map;
}

/**
 * Fallback safe matcher (used if indexing fails)
 */
export function findIssueForUser(issues, username) {
  return issues.find(issue =>
    issue.title?.toLowerCase().includes(username.toLowerCase()) ||
    issue.body?.toLowerCase().includes(username.toLowerCase())
  );
}

export async function postComment(issueNumber, body) {
  return octokit.rest.issues.createComment({
    owner: 'TheButterZone',
    repo: 'thebutterzone.github.io',
    issue_number: issueNumber,
    body
  });
}
