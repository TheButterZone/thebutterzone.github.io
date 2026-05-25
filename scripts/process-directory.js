const fs = require("fs");

const addUsername = (process.env.ADD_USERNAME || "").trim();
const btc = (process.env.BTC || "").trim();
const removeUsername = (process.env.REMOVE_USERNAME || "").trim();

const FILE = "data.json";

let data = [];

if (fs.existsSync(FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (!Array.isArray(data)) data = [];
  } catch {
    data = [];
  }
}

const normalize = (s) => (s || "").trim().toLowerCase();

let changed = false;

/* ---------------- ADD (MERGE) ---------------- */
if (addUsername && btc) {
  const key = normalize(addUsername);

  const idx = data.findIndex(e => normalize(e.username) === key);

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
  const key = normalize(removeUsername);

  const before = data.length;
  data = data.filter(e => normalize(e.username) !== key);

  const removed = before !== data.length;

  console.log("REMOVE REQUEST:", removeUsername);
  console.log("REMOVED:", removed);

  if (removed) changed = true;
}

/* ---------------- WRITE ATOMIC ---------------- */
fs.writeFileSync(FILE + ".tmp", JSON.stringify(data, null, 2));
fs.renameSync(FILE + ".tmp", FILE);

console.log("FINAL SIZE:", data.length);
console.log("CHANGED:", changed);

/* IMPORTANT: signal to GitHub Actions */
if (!changed) {
  process.exit(78); // neutral exit (no-op)
}
