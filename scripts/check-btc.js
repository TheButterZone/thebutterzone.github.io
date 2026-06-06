import fs from 'fs';
import path from 'path';
import { getConfirmedTxs } from '../lib/btcProviders.js';
import { getAllIssues, findIssueForUser, postComment } from '../lib/githubUtils.js';

const TEST_MODE = process.env.TEST_MODE === 'true';

const dataPath = path.resolve('data.json');
const statePath = path.resolve('.btc-monitor-state.json');

const members = TEST_MODE
  ? [
      {
        githubUser: 'testuser',
        bitcoin: 'bc1qtestaddress'
      }
    ]
  : JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

let state = {};
if (fs.existsSync(statePath)) {
  state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

async function main() {
  let updatedState = { ...state };

  // GitHub issues fetched ONCE per run (cached)
  const issues = await getAllIssues();

  const tasks = members.map(async (member) => {
    const { bitcoin, githubUser } = member;

    // -----------------------------
    // BTC TX FETCH (REAL OR MOCK)
    // -----------------------------
    const txs = TEST_MODE
      ? [
          {
            block_time: Math.floor(Date.now() / 1000)
          }
        ]
      : await getConfirmedTxs(bitcoin);

    // -----------------------------
    // FIRST RUN INITIALIZATION
    // -----------------------------
    if (!(bitcoin in updatedState)) {
      updatedState[bitcoin] = txs.length
        ? Math.max(...txs.map(t => t.block_time))
        : 0;

      console.log(
        TEST_MODE
          ? `[TEST_MODE] Initialized state for ${githubUser}`
          : `Initialized state for ${githubUser}`
      );

      return;
    }

    const lastSeen = updatedState[bitcoin];
    const newTxs = txs.filter(tx => tx.block_time > lastSeen);

    // -----------------------------
    // NOTIFICATION LOGIC
    // -----------------------------
    if (newTxs.length > 0) {
      const issue = findIssueForUser(issues, githubUser);

      if (issue) {
        if (!TEST_MODE) {
          await postComment(
            issue.number,
            'A new Bitcoin payment to your registered address has received its first confirmation.'
          );
        } else {
          console.log(
            `[TEST_MODE] Would post comment to issue #${issue.number} for ${githubUser}`
          );
        }
      } else {
        console.warn(`No approve-labeled issue found for ${githubUser}`);
      }

      const newMax = Math.max(...newTxs.map(t => t.block_time));

      updatedState[bitcoin] = Math.max(
        updatedState[bitcoin],
        newMax
      );

      console.log(
        TEST_MODE
          ? `[TEST_MODE] Updated state for ${githubUser}`
          : `Updated state for ${githubUser}`
      );
    }
  });

  await Promise.all(tasks);

  fs.writeFileSync(statePath, JSON.stringify(updatedState, null, 2));

  console.log(
    TEST_MODE
      ? '[TEST_MODE] Run complete (no real GitHub writes executed)'
      : 'Run complete'
  );
}

main().catch(console.error);
