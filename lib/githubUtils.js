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

  console.log(
    issues
      .filter(i => i.user?.login?.toLowerCase() === lower)
      .map(i => ({
        number: i.number,
        author: i.user?.login,
        state: i.state,
        labels: i.labels.map(l => l.name),
      }))
  );

  return issues.find(issue => {
    const hasApproveLabel = issue.labels?.some(
      l => l.name === 'approve'
    );

    const authorMatch =
      issue.user?.login?.toLowerCase() === lower;

    return hasApproveLabel && authorMatch;
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
