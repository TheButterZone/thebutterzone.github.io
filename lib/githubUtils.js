import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

/**
 * Fetch ALL issues once per workflow run (open + closed)
 * This is the ONLY GitHub API call needed for issue lookup.
 */
export async function getAllIssues() {
  const issues = await octokit.rest.issues.listForRepo({
    owner: 'TheButterZone',
    repo: 'thebutterzone.github.io',
    state: 'all',
    per_page: 100
  });

  return issues.data;
}

/**
 * Find the canonical "submit-info" issue for a member
 * Rules:
 *  - must have "approve" label
 *  - must match username in title or body
 */
export function findIssueForUser(issues, username) {
  const lower = username.toLowerCase();

  return issues.find(issue => {
    const hasApproveLabel = issue.labels?.some(
      l => l.name === 'approve'
    );

    const textMatch =
      issue.title?.toLowerCase().includes(lower) ||
      issue.body?.toLowerCase().includes(lower);

    return hasApproveLabel && textMatch;
  });
}

/**
 * Post comment safely (no dedupe logic here anymore — state handles it)
 */
export async function postComment(issueNumber, body) {
  return octokit.rest.issues.createComment({
    owner: 'TheButterZone',
    repo: 'thebutterzone.github.io',
    issue_number: issueNumber,
    body
  });
}
