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
if (mode === "add" && username && btc) {
  const key = norm(username);

  const idx = data.findIndex(e => norm(e.username) === key);

  if (idx >= 0) {
    console.log("UPDATED:", username);
    data[idx].bitcoin = btc;
  } else {
    console.log("ADDED:", username);
    data.push({ username, bitcoin: btc });
  }

  changed = true;
}

/* ---------------- REMOVE ---------------- */
if (mode === "remove" && username) {
  const key = norm(username);

  const before = data.length;
  data = data.filter(e => norm(e.username) !== key);

  if (data.length !== before) {
    console.log("REMOVED:", username);
    changed = true;
  }
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
