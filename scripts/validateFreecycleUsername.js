import { Octokit } from "@octokit/rest";
import crypto from "crypto";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const repoFull = process.env.REPO;
const issue_number = Number(process.env.ISSUE_NUMBER);

const [owner, repo] = repoFull.split("/");

// -----------------------------
// Load issue
// -----------------------------
const { data: issue } = await octokit.rest.issues.get({
  owner,
  repo,
  issue_number,
});

const body = issue.body || "";

// -----------------------------
// Validate target issue type
// -----------------------------
if (
  !body.includes("### Freecycle.org Username") ||
  !body.includes("### Bitcoin Address")
) {
  console.log("Not a submission issue.");
  process.exit(0);
}

// -----------------------------
// Extract username (robust)
// -----------------------------
const lines = body.split("\n");

let username = null;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "### Freecycle.org Username") {
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (line) {
        username = line;
        break;
      }
    }
    break;
  }
}

if (!username) {
  console.log("Username not found.");
  process.exit(0);
}

console.log(`Checking username: ${username}`);

// -----------------------------
// State (labels)
// -----------------------------
const labels = issue.labels.map(l => l.name);
const wasInvalid = labels.includes("invalid-username");

// -----------------------------
// STATE HASH DEBOUNCE
// -----------------------------
const stateString = JSON.stringify({
  username,
  bitcoin: body.includes("### Bitcoin Address")
    ? "present"
    : "missing",
});

const stateHash = crypto
  .createHash("sha256")
  .update(stateString)
  .digest("hex");

// Load previous hash from comments
const { data: comments } = await octokit.rest.issues.listComments({
  owner,
  repo,
  issue_number,
});

const lastHashComment = comments.find(c =>
  c.body.startsWith("<!-- validation-hash:")
);

const lastHash = lastHashComment
  ? lastHashComment.body.match(/<!-- validation-hash:(.*) -->/)?.[1]?.trim()
  : null;

if (lastHash === stateHash) {
  console.log("State unchanged (hash match). Skipping validation.");
  process.exit(0);
}

// Store new hash marker
await octokit.rest.issues.createComment({
  owner,
  repo,
  issue_number,
  body: `<!-- validation-hash:${stateHash} -->`,
});

// -----------------------------
// Fetch Freecycle API
// -----------------------------
const res = await fetch(
  "https://freecycle.org/api/signup/username-check",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "GitHub Actions",
    },
    body: JSON.stringify({ username }),
  }
);

const text = (await res.text()).trim();

// API: true = taken (exists)
const exists = text === "true";

// Your system: must exist to be valid
const invalid = !exists;

// -----------------------------
// INVALID CASE
// -----------------------------
if (invalid) {
  console.log("Invalid username");

  const alreadyCommented = comments.some(c =>
    c.body.includes("could not be found on Freecycle.org")
  );

  if (!alreadyCommented) {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: [
        `❌ The Freecycle username **${username}** could not be found on Freecycle.org.`,
        "",
        "Please edit the **Freecycle.org Username** field in this issue and replace it with your correct username.",
        "Once you save your changes, this check will run again automatically.",
      ].join("\n"),
    });
  }

  if (!wasInvalid) {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number,
      labels: ["invalid-username"],
    });
  }

  process.exit(0);
}

// -----------------------------
// VALID CASE
// -----------------------------
console.log("Valid username");

if (wasInvalid) {
  await octokit.rest.issues.removeLabel({
    owner,
    repo,
    issue_number,
    name: "invalid-username",
  });

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number,
    body: "✅ Username verified successfully. This submission is now ready for review.",
  });

  console.log("Recovered from invalid state");
}

process.exit(0);
