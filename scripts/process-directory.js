const fs = require("fs");

const addUsername = process.env.ADD_USERNAME?.trim();
const btc = process.env.BTC?.trim();
const removeRaw = process.env.REMOVE_USERNAME?.trim();

const FILE = "data.json";

let data = [];

/* ---------------- LOAD DATA ---------------- */
if (fs.existsSync(FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (!Array.isArray(data)) data = [];
  } catch {
    data = [];
  }
}

/* ------------- NORMALIZE KEY -------------- */
const normalize = (s) => (s || "").trim().toLowerCase();

/* ---------------- ADD (MERGE) ------------- */
if (addUsername && btc) {
  const username = normalize(addUsername);

  const existingIndex = data.findIndex(
    (e) => normalize(e.username) === username
  );

  if (existingIndex >= 0) {
    // MERGE UPDATE
    data[existingIndex] = {
      ...data[existingIndex],
      username: addUsername,
      bitcoin: btc
    };

    console.log("Updated existing user:", addUsername);
  } else {
    // INSERT NEW
    data.push({
      username: addUsername,
      bitcoin: btc
    });

    console.log("Added new user:", addUsername);
  }
}

/* ---------------- REMOVE ------------------- */
if (removeRaw) {
  const removeUsername = removeRaw.trim().split("\n")[0];
  const target = normalize(removeUsername);

  const before = data.length;

  data = data.filter(
    (e) => normalize(e.username) !== target
  );

  console.log(`Removed ${before - data.length} entries for:`, removeUsername);
}

/* -------------- ATOMIC WRITE --------------- */
const tmpFile = FILE + ".tmp";

fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
fs.renameSync(tmpFile, FILE);

console.log("Final dataset size:", data.length);
