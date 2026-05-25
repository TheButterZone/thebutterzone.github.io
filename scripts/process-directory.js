const fs = require("fs");

const addUsername = process.env.ADD_USERNAME?.trim();
const btc = process.env.BTC?.trim();
const removeUsername = process.env.REMOVE_USERNAME?.trim();

let data = [];

if (fs.existsSync("data.json")) {
  try {
    data = JSON.parse(fs.readFileSync("data.json", "utf8"));
  } catch {
    data = [];
  }
}

// ADD
if (addUsername && btc) {
  const exists = data.some(e => e.username === addUsername);

  if (!exists) {
    data.push({
      username: addUsername,
      bitcoin: btc
    });
  }
}

// REMOVE
if (removeUsername) {
  data = data.filter(e => e.username !== removeUsername);
}

fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
console.log("Updated data.json");
