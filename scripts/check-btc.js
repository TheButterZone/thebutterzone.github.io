import fs from 'fs';
import path from 'path';
import { getConfirmedTxs } from '../lib/btcProviders.js';
import { getUserIssue, postComment } from '../lib/githubUtils.js';

const dataPath = path.resolve('data.json');
const statePath = path.resolve('.btc-monitor-state.json');

const members = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

let state = {};
if (fs.existsSync(statePath)) {
  state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

async function main() {
  let updatedState = { ...state };

  const tasks = members.map(async (member) => {
    const { bitcoin, githubUser } = member;

    const txs = await getConfirmedTxs(bitcoin);

    // First run initialization (no notification)
    if (!(bitcoin in updatedState)) {
      updatedState[bitcoin] = txs.length
        ? Math.max(...txs.map(t => t.block_time))
        : 0;
      return;
    }

    const lastSeen = updatedState[bitcoin];
    const newTxs = txs.filter(tx => tx.block_time > lastSeen);

    if (newTxs.length > 0) {
      const issue = await getUserIssue(githubUser);

      if (issue) {
        await postComment(
          issue.number,
          'A new Bitcoin payment to your registered address has received its first confirmation.'
        );
        console.log(`Notified ${githubUser}`);
      } else {
        console.warn(`No open issue found for ${githubUser}`);
      }

      updatedState[bitcoin] = Math.max(...newTxs.map(t => t.block_time));
    }
  });

  await Promise.all(tasks);

  fs.writeFileSync(statePath, JSON.stringify(updatedState, null, 2));
}

main().catch(console.error);
