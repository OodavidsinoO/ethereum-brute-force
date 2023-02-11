const { writeFile } = require("fs").promises;
const { randomBytes } = require("crypto");
const Queue = require("queue-promise");
const privateKeyToAddress = require('ethereum-private-key-to-address');
const { apiKeys, apiEndpoint } = require("./configs.js");

const CONCURRENCY = 5;

async function recordFind(key, account, balance) {
  const ethBalance = balance / 1e9;
  writeFile(
    "wallets",
    `Key: ${key}\tAddress: ${account}\tBalance: ${ethBalance} ETH\n`,
    { flag: "a" }
  );
}

async function checkRandomKeys(keys = [...Array(20).keys()].map(() => "0x" + randomBytes(32).toString("hex"))) {
  // Generate 20 random 32 byte keys
  // const keys = [...Array(20).fill('0x000000000000000000000000000000000000000000000000000000000000000e')];
  const publicKeys = keys.map(privateKeyToAddress);

  // Request etherscan for the balances of the generated keys
  // If the API key is out of requests, it will retry with another key
  let response = await fetch(`${apiEndpoint.etherscan}?module=account&action=balancemulti&address=${publicKeys.join(",")}&tag=latest&apikey=${apiKeys.etherscan[Math.floor(Math.random() * apiKeys.etherscan.length)]}`)
                       .then((res) => { if (res.ok) { return res.json(); } else { throw new Error("Etherscan API error, Retrying..."); } })
                       // Use a different API key if this one is out of requests
                        .catch((res, error) => {
                          console.error(error);
                          console.log(res);
                          return checkRandomKeys(keys);
                        });

  // If it has transactions, get it's balance and record it
  for (const account of response.result) {
    if (account.balance > 0) {
      await recordFind(keys[publicKeys.indexOf(account.account)], account.account, account.balance);
      return true;
    }
  }
  return false;
}

async function main() {
  let total = 0;
  let checked = 0;
  let found = 0;

  const queue = new Queue({
    concurrent: CONCURRENCY,
    interval: 10,
    start: true,
  });

  // Print the test rate each second
  const timer = setInterval(() => {
    total += checked;
    const MAX = apiKeys.etherscan.length * 20 * 100000;
    process.stdout.write(`\r🔍 Checked: ${total} @ ${checked}/s | Progress: ${(total/MAX*100).round(4)}% (Max: ${MAX}) | 🌟 Found: ${found}                                  `);
    checked = 0;
  }, 1000);

  const exit = () => {
    clearInterval(timer);
    process.exit();
  };

  process.on("SIGINT", exit);
  queue.on("stop", exit);

  // When a job is completed, start another one
  queue.on("resolve", (hasBalance) => {
    checked += 20;
    if (hasBalance) {
      found++;
    }
    queue.enqueue(() => checkRandomKeys());
  });

  // When a job fails, log it and quit.
  queue.on("reject", (error) => {
    console.error(error);
    exit();
  });

  // Enqueue initial jobs
  for (i = 0; i < CONCURRENCY; i++) {
    queue.enqueue(() => checkRandomKeys());
  }
}

// Add a round function to the Number prototype
Number.prototype.round = function(places) {
  return +(Math.round(this + "e+" + places)  + "e-" + places);
}

main();