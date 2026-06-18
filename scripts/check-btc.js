import fs from 'fs';
import path from 'path';
import { getConfirmedTxs } from '../lib/btcProviders.js';
import { getAllIssues, findIssueForUser, postComment } from '../lib/githubUtils.js';

console.log(`[START] ${new Date().toISOString()}`);

const dataPath = path.resolve('data.json');
const statePath = path.resolve('.btc-monitor-state.json');

const members = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

let state = {};
if (fs.existsSync(statePath)) {
  state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

async function main() {
  let updatedState = { ...state };
  let hasChanges = false;

  // GitHub issues fetched ONCE per run (cached)
  const issues = await getAllIssues();

  const tasks = members.map(async (member) => {
    const { bitcoin, githubUser } = member;

    // -----------------------------
    // BTC TX FETCH
    // -----------------------------
    const txs = await getConfirmedTxs(bitcoin);

    // -----------------------------
    // FIRST RUN INITIALIZATION
    // -----------------------------
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

    // -----------------------------
    // NOTIFICATION LOGIC
    // -----------------------------
    if (newTxs.length === 0) return; // nothing to do

    const issue = findIssueForUser(issues, githubUser);

    if (!issue) {
      console.warn(`No approve-labeled issue found for ${githubUser}`);
      return;
    }

    try {
      await postComment(
        issue.number,
        'A new Bitcoin payment to your registered address has received its first confirmation.'
      );
    } catch (err) {
      console.error(`[WARN] Failed to post comment to ${githubUser}:`, err);
    }

    // Update memory state
    const newMax = Math.max(...newTxs.map(t => t.block_time));
    updatedState[bitcoin] = Math.max(updatedState[bitcoin], newMax);
    hasChanges = true;

    console.log(`Updated state for ${githubUser}`);
  });

  await Promise.all(tasks);

  // Only write to disk if state properties changed
  if (hasChanges) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(updatedState, null, 2));
    console.log('State file updated on disk.');
  } else {
    console.log('No state updates occurred. Skipping file write.');
  }

  console.log('Run complete');
}

main().catch(console.error);
