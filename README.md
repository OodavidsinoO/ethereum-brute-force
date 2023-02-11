# Ethereum Random Private Key Brute Force Searcher

This small project will continuously generate random ethereum private keys and log any that have a balance on the ethereum mainnet.

In other words, this project will stress test your CPU and not find any ethereum.

## To Run

You must have a fully synchronised ethereum node for this script to run against.

I've tested against both geth and OpenEthereum.

Start geth with the arguments: `--ws --ws.api eth,net,web3`, OpenEthereum exposes the required apis by default.

It should preferably be running on localhost to reduce latency as much as possible.

It will be very slow running against a `--syncmode light` node to the point where it could be faster refreshing the page at https://keys.lol.

To install dependencies run:

```sh
$ yarn
```

And to start the script run:

```sh
$ yarn wsRandom
$ yarn wsBip39
$ yarn etherscanRandom
$ yarn etherscanBip39
```

You'll see output like the following:

```sh
$ node main.js
🔍 Checked: 30000 @ 120/s | 🌟 Found: 0
```

If any accounts with balance are found (they won't be), you can see them logged in the 'wallets' file:

```
$ cat wallets
cat: wallets: No such file or directory
```

## Performance

When I run this on my PC (i7-6700K), I get a check rate of around 1500/s.

On an n2-standard-4 GCP instance I see ~1000/s.

You can tweak the `CONCURRENCY` variable at the top of main.js to control how many promises can be pending at once.
