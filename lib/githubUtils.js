import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

/**
 * Fetch ALL issues (open + closed) with pagination safety
 * This guarantees no issue is missed beyond 100 results.
 */
export async function getAllIssues() {
  const issues = await octokit.paginate(
    octokit.rest.issues.listForRepo,
    {
      owner: 'TheButterZone',
      repo: 'thebutterzone.github.io',
      state: 'all',
      per_page: 100
    }
  );

  return issues;
}

/**
 * Find canonical submit-info issue for a member
 * Must:
 *  - have "approve" label
 *  - match username in title or body
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
 * Post GitHub comment
 */
export async function postComment(issueNumber, body) {
  return octokit.rest.issues.createComment({
    owner: 'TheButterZone',
    repo: 'thebutterzone.github.io',
    issue_number: issueNumber,
    body
  });
}
