import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function getUserIssue(username) {
  const issues = await octokit.rest.issues.listForRepo({
    owner: 'TheButterZone',
    repo: 'thebutterzone.github.io',
    state: 'open'
  });

  return issues.data.find(issue =>
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
