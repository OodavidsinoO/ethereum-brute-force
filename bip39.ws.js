const { writeFile } = require("fs").promises;
const Web3 = require("web3");
const bip39 = require("bip39");
const HDWallet = require('ethereum-hdwallet')
const Queue = require("queue-promise");

const CONCURRENCY = 2048;

async function recordFind(key, account, transactions, balance) {
  const ethBalance = Web3.utils.fromWei(balance, 'ether');
  writeFile(
    "wallets",
    `Key: ${key}, Address: ${account.address}, Transactions: ${transactions}, Balance: ${ethBalance} eth\n`,
    { flag: "a" }
  );
}

async function randomBip39() {
  return bip39.generateMnemonic();
}

function privateKeyToAddress(key) {
  return "0x" + HDWallet.fromMnemonic(key).derive(`m/44'/60'/0'/0/0`).getAddress().toString('hex');
}

async function checkRandomKey(web3) {
  const key = await randomBip39();
  // console.log(`Checking key "${key}"`);

  const account = privateKeyToAddress(key);
  const transactions = await web3.eth.getTransactionCount(account);
  // console.log(`[${transactions} transaction(s)] Account: ${account}`);

  // If it has transactions, get it's balance and record it
  if (transactions > 0) {
    const balance = await web3.eth.getBalance(account);
    await recordFind(key, account, transactions, balance);
    return true;
  }
  return false;
}

async function main() {
  // Connects to geth on localhost via websocket
  // (start geth with `--ws --ws.api eth,net,web3`)
  // https://api.mycryptoapi.com/eth
  // https://nodes.mewapi.io/rpc/eth
  // https://geth.mytokenpocket.vip
  // const web3 = new Web3(new Web3.providers.HttpProvider("https://main-rpc.linkpool.io"));
  const web3 = new Web3("ws://127.0.0.1:8546");

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
    process.stdout.write(`[${Date.now()}] Checked: ${total} @ ${checked}/s, Found: ${found}\r`);
    checked = 0;
  }, 1000);

  const exit = () => {
    clearInterval(timer);
    web3.currentProvider.disconnect();
    process.exit();
  };

  process.on("SIGINT", exit);
  queue.on("stop", exit);

  // When a job is completed, start another one
  queue.on("resolve", (hasBalance) => {
    checked++;
    if (hasBalance) {
      found++;
    }
    queue.enqueue(() => checkRandomKey(web3));
  });

  // When a job fails, log it and quit.
  queue.on("reject", (error) => {
    console.error(error);
    exit();
  });

  // Enqueue initial jobs
  for (i = 0; i < CONCURRENCY; i++) {
    queue.enqueue(() => checkRandomKey(web3));
  }
}

main();
