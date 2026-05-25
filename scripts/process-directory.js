const fs = require("fs");

const FILE = "data.json";

const addUsername = (process.env.ADD_USERNAME || "").trim();
const btc = (process.env.BTC || "").trim();
const removeUsername = (process.env.REMOVE_USERNAME || "").trim();

let data = [];

/* LOAD */
if (fs.existsSync(FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (!Array.isArray(data)) data = [];
  } catch {
    data = [];
  }
}

const norm = (s) => (s || "").trim().toLowerCase();

let changed = false;

/* ---------------- ADD / UPSERT ---------------- */
if (addUsername && btc) {
  const key = norm(addUsername);

  const idx = data.findIndex(e => norm(e.username) === key);

  if (idx >= 0) {
    data[idx].username = addUsername;
    data[idx].bitcoin = btc;
    console.log("UPDATED:", addUsername);
    changed = true;
  } else {
    data.push({ username: addUsername, bitcoin: btc });
    console.log("ADDED:", addUsername);
    changed = true;
  }
}

/* ---------------- REMOVE ---------------- */
if (removeUsername) {
  const key = norm(removeUsername);

  const before = data.length;

  data = data.filter(e => norm(e.username) !== key);

  const removed = before !== data.length;

  console.log("REMOVE:", removeUsername, "REMOVED:", removed);

  if (removed) changed = true;
}

/* ---------------- WRITE ---------------- */
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
fs.writeFileSync(".changed", changed ? "true" : "false");

console.log("FINAL SIZE:", data.length);
console.log("CHANGED:", changed);
