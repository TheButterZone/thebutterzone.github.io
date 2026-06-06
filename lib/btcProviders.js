import axios from 'axios';

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
   UNIFIED FETCH
------------------------------ */
export async function getConfirmedTxs(address) {
  try {
    return await fetchMempool(address);
  } catch (e1) {
    console.warn(`mempool.space failed for ${address}, trying Blockstream`);

    try {
      return await fetchBlockstream(address);
    } catch (e2) {
      console.error(`Both APIs failed for ${address}`);
      return [];
    }
  }
}
