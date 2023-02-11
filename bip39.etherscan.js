const { writeFile } = require("fs").promises;
const bip39 = require("bip39");
const HDWallet = require('ethereum-hdwallet')
const Queue = require("queue-promise");
const privateKeyToAddress = require('ethereum-private-key-to-address');
const colors = require('colors');
const { apiKeys, apiEndpoint } = require("./configs.js");

colors.enable();

const CONCURRENCY = 1; // 5 API Calls per second
let tempKeysPool = [];

async function recordFind(key, account, balance) {
  const ethBalance = balance / 1e9;
  writeFile(
    "wallets",
    `Key: ${key}\tAddress: ${account}\tBalance: ${ethBalance} ETH\n`,
    { flag: "a" }
  );
}

async function checkRandomKeys(keys = []) {
  let publicKeys = [];
  // Generate a random mnemonic if none is provided
  if (keys.length === 0) {
    for (let i = 0; i < 20; i++) {
      keys.push(bip39.generateMnemonic());
      publicKeys.push(privateKeyToAddress(HDWallet.fromMnemonic(keys[i]).derive(`m/44'/60'/0'/0/0`).getPrivateKey().toString('hex')));
    }
  }

  // Request etherscan for the balances of the generated keys
  // If the API key is out of requests, it will retry with another key
  let response = await fetch(`${apiEndpoint.etherscan}?module=account&action=balancemulti&address=${publicKeys.join(",")}&tag=latest&apikey=${apiKeys.etherscan[Math.floor(Math.random() * apiKeys.etherscan.length)]}`)
                       .then((res) => { return res.json(); } )
                       .then((json) => {
                          if (json.status == "1") {
                            return json;
                          } else {
                            throw new Error("Etherscan API error, Retrying...");
                          }
                       })
                       // Use a different API key if this one is out of requests
                        .catch((error) => {
                          console.error(error);
                          return checkRandomKeys();
                        });

  // If it has transactions, get it's balance and record it
  for (const account of response.result) {
    tempKeysPool.push(keys[publicKeys.indexOf(account.account)]);
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
    interval: 0,
    start: true,
  });

  // Print the test rate each second
  const timer = setInterval(() => {
    total += checked;
    const MAX = apiKeys.etherscan.length * 20 * 100000;
    // Print tempKeysPool
    for (const key of tempKeysPool) {
      console.log('Checking ' + key.green);
    }
    tempKeysPool = [];
    process.stdout.write(`🔍 Checked: ${total} @ ${checked}/s | Progress: ${(total/MAX*100).round(4)}% (Max: ${MAX}) | 🌟 Found: ${found}`);
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