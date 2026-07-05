import fs from 'fs';
import path from 'path';
import { getConfirmedTxs } from '../lib/btcProviders.js';
import { getAllIssues, findIssueForUser, postComment } from '../lib/githubUtils.js';

console.log(`[START] ${new Date().toISOString()}`);

const dataPath = path.resolve('data.json');
const statePath = path.resolve('.btc-monitor-state.json');
const queuePath = path.resolve('.btc-failed-queue.json');

const members = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// -----------------------------
// LOAD STATE
// -----------------------------
let state = {};
if (fs.existsSync(statePath)) {
  state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

// -----------------------------
// LOAD FAILURE QUEUE
// -----------------------------
let queue = [];
if (fs.existsSync(queuePath)) {
  queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
}

// -----------------------------
// RETRY HELPER WITH BACKOFF
// -----------------------------
async function postCommentWithRetry(issueNumber, body, retries = 3) {
  let lastErr;

  for (let i = 0; i < retries; i++) {
    try {
      await postComment(issueNumber, body);
      return true;
    } catch (err) {
      lastErr = err;

      const wait = 1000 * Math.pow(2, i);
      console.warn(`Retry ${i + 1}/${retries} failed. Waiting ${wait}ms...`);

      await new Promise(res => setTimeout(res, wait));
    }
  }

  throw lastErr;
}

async function main() {
  let updatedState = { ...state };
  let updatedQueue = [...queue];
  let hasChanges = false;

  const issues = await getAllIssues();

  // -----------------------------
  // PROCESS FAILED QUEUE FIRST
  // -----------------------------
  const stillFailed = [];

  for (const item of queue) {
    const { issueNumber, message } = item;

    try {
      await postCommentWithRetry(issueNumber, message);
      hasChanges = true;
      console.log(`Retried queued notification for issue #${issueNumber}`);
    } catch (err) {
      console.error(`Still failing issue #${issueNumber}`, err);
      stillFailed.push(item);
    }
  }

  updatedQueue = stillFailed;

  // -----------------------------
  // PROCESS MEMBERS
  // -----------------------------
  const tasks = members.map(async (member) => {
    const { bitcoin, githubUser } = member;

    const txs = await getConfirmedTxs(bitcoin);

    if (!(bitcoin in updatedState)) {
      updatedState[bitcoin] = txs.length
        ? Math.max(...txs.map(t => t.block_time))
        : 0;

      hasChanges = true;
      console.log(`Initialized state for ${githubUser}`);
      return;
    }

    const lastSeen = updatedState[bitcoin];
    const newTxs = txs.filter(tx => tx.block_time > lastSeen);

    if (newTxs.length === 0) return;

    const issue = findIssueForUser(issues, githubUser);

    if (!issue) {
      console.warn(`No approve-labeled issue found for ${githubUser}`);
      return;
    }

    const message =
      "A new Bitcoin payment to your registered address has received its first confirmation.";

    try {
      await postCommentWithRetry(issue.number, message);

      const newMax = Math.max(...newTxs.map(t => t.block_time));
      updatedState[bitcoin] = Math.max(updatedState[bitcoin], newMax);
      hasChanges = true;

      console.log(`Updated state for ${githubUser}`);
    } catch (err) {
      console.error(`[WARN] Failed permanently for ${githubUser}`, err);

      // -----------------------------
      // PUSH TO FAILURE QUEUE
      // -----------------------------
      updatedQueue.push({
        issueNumber: issue.number,
        message,
        timestamp: Date.now()
      });
    }
  });

  await Promise.all(tasks);

  // -----------------------------
  // SAVE STATE
  // -----------------------------
  if (hasChanges) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(updatedState, null, 2));
    console.log('State file updated on disk.');
  }

  // -----------------------------
  // SAVE FAILURE QUEUE
  // -----------------------------
  if (updatedQueue.length > 0) {
    fs.writeFileSync(queuePath, JSON.stringify(updatedQueue, null, 2));
    console.log(`Saved ${updatedQueue.length} queued failures.`);
  } else if (queue.length > 0) {
    fs.writeFileSync(queuePath, JSON.stringify([], null, 2));
    console.log('Cleared failure queue.');
  }

  console.log('Run complete');
}

main().catch(console.error);
