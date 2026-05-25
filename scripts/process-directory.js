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

/* ADD / MERGE */
if (addUsername && btc) {
  const key = normalize(addUsername);

  const idx = data.findIndex(e => normalize(e.username) === key);

  if (idx >= 0) {
    data[idx].bitcoin = btc;
    data[idx].username = addUsername;
    changed = true;
  } else {
    data.push({ username: addUsername, bitcoin: btc });
    changed = true;
  }
}

/* REMOVE */
if (removeUsername) {
  const key = normalize(removeUsername);

  const before = data.length;

  data = data.filter(e => normalize(e.username) !== key);

  if (data.length !== before) changed = true;
}

/* WRITE */
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
fs.writeFileSync(".changed", changed ? "true" : "false");

console.log("changed =", changed);
