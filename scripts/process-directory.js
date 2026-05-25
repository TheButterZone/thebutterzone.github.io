const fs = require("fs");

const FILE = "data.json";

/* ---------------- INPUTS ---------------- */
const addUsername = (process.env.ADD_USERNAME || "").trim();
const btc = (process.env.BTC || "").trim();
const removeUsername = (process.env.REMOVE_USERNAME || "").trim();

/* ---------------- NORMALIZER ---------------- */
const norm = (s) =>
  (s || "")
    .replace(/\u200B/g, "")
    .replace(/\r/g, "")
    .trim()
    .toLowerCase();

/* ---------------- LOAD + AUTO-REPAIR ---------------- */
let data = [];

if (fs.existsSync(FILE)) {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));

    data = Array.isArray(raw)
      ? raw
          .filter(Boolean)
          .map(e => ({
            username: e?.username ? String(e.username) : "",
            bitcoin: e?.bitcoin ? String(e.bitcoin) : ""
          }))
      : [];
  } catch {
    data = [];
  }
}

/* ---------------- HARD GUARD (remove broken rows) ---------------- */
data = data.filter(e => e.username && e.username.trim() !== "");

/* ---------------- STATE ---------------- */
let changed = false;

/* ---------------- ADD / UPDATE ---------------- */
if (addUsername && btc) {
  const key = norm(addUsername);

  const idx = data.findIndex(e => norm(e.username) === key);

  if (idx >= 0) {
    data[idx].username = addUsername;
    data[idx].bitcoin = btc;
    console.log("UPDATED:", addUsername);
    changed = true;
  } else {
    data.push({
      username: addUsername,
      bitcoin: btc
    });
    console.log("ADDED:", addUsername);
    changed = true;
  }
}

/* ---------------- REMOVE ---------------- */
if (removeUsername) {
  const key = norm(removeUsername);

  console.log("REMOVE RAW:", JSON.stringify(removeUsername));
  console.log("NORMALIZED KEY:", JSON.stringify(key));

  console.log("DATA USERS:");
  data.forEach(e => {
    console.log(JSON.stringify(e.username));
  });

  const before = data.length;

  data = data.filter(e => norm(e.username) !== key);

  const removed = before !== data.length;

  console.log("REMOVED:", removed);
  changed = removed || changed;
}

/* ---------------- DEDUPE ---------------- */
function dedupeByUsername(data) {
  const map = new Map();

  for (const item of data) {
    if (!item || !item.username) continue;

    const key = item.username.trim().toLowerCase();

    map.set(key, {
      ...item,
      username: item.username.trim()
    });
  }

  return Array.from(map.values());
}

/* ---------------- FINALIZE DATA ---------------- */
const beforeData = JSON.stringify(data);

data = dedupeByUsername(data);

const afterData = JSON.stringify(data);

/* mark changed if dedupe modified anything */
if (beforeData !== afterData) {
  changed = true;
}

/* ---------------- FINAL WRITE ---------------- */
fs.writeFileSync(
  FILE,
  JSON.stringify(data, null, 2)
);

console.log("FINAL SIZE:", data.length);
console.log("CHANGED:", changed);

/* ---------------- CHANGE FLAG ---------------- */
fs.writeFileSync(".changed", changed ? "true" : "false");
