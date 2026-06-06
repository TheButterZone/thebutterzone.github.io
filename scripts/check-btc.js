import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const dataPath = path.resolve('data.json');
const statePath = path.resolve('.btc-monitor-state.json');

const members = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

let state = {};
if (fs.existsSync(statePath)) {
  state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

/* -----------------------------
   NORMALIZATION
------------------------------ */

function normalizeTx(tx) {
  return {
    block_time: tx?.status?.block_time || 0
  };
}

/* -----------------------------
   MEMPOOL.SPACE
------------------------------ */

async function fetchMempool(address) {
  const url = `https://mempool.space/api/address/${address}/txs`;
  const res = await axios.get(url);

  return res.data
    .filter(tx => tx?.status?.confirmed)
    .map(normalizeTx);
}

/* -----------------------------
   BLOCKSTREAM FALLBACK
------------------------------ */

async function fetchBlockstream(address) {
  const url = `https://blockstream.info/api/address/${address}/txs`;
  const res = await axios.get(url);

  return res.data
    .filter(tx => tx?.status?.confirmed)
    .map(normalizeTx);
}

/* -----------------------------
   UNIFIED FETCH (NO RETRIES)
------------------------------ */

async function getConfirmedTxs(address) {
  try {
    return await fetchMempool(address);
  } catch (e1) {
    console.warn(`mempool failed for ${address}, using Blockstream`);

    try {
      return await fetchBlockstream(address);
    } catch (e2) {
      console.error(`Both APIs failed for ${address}`);
      return [];
    }
  }
}

/* -----------------------------
   GITHUB ISSUE LOOKUP
------------------------------ */

async function getUserIssue(username) {
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

/* -----------------------------
   MAIN LOGIC
------------------------------ */

async function main() {
  let updatedState = { ...state };

  const tasks = members.map(async (member) => {
    const { bitcoin, githubUser } = member;

    const txs = await getConfirmedTxs(bitcoin);

    // First run: initialize without notifying
    if (!(bitcoin in updatedState)) {
      updatedState[bitcoin] = txs.length
        ? Math.max(...txs.map(t => t.block_time))
        : 0;

      return;
    }

    const lastSeen = updatedState[bitcoin];

    const newTxs = txs.filter(
      tx => tx.block_time > lastSeen
    );

    if (newTxs.length > 0) {
      const issue = await getUserIssue(githubUser);

      if (issue) {
        await octokit.rest.issues.createComment({
          owner: 'TheButterZone',
          repo: 'thebutterzone.github.io',
          issue_number: issue.number,
          body: 'A new Bitcoin payment to your registered address has received its first confirmation.'
        });

        console.log(`Notified ${githubUser}`);
      } else {
        console.warn(`No open issue found for ${githubUser}`);
      }

      updatedState[bitcoin] = Math.max(
        ...newTxs.map(t => t.block_time)
      );
    }
  });

  await Promise.all(tasks);

  fs.writeFileSync(statePath, JSON.stringify(updatedState, null, 2));
}

main().catch(console.error);
