# Fund Testnet Account

Your testnet account address:
```
0x2f8f549bd4b7a715296ac63a5a75e5027a9181c6f46d7a56b9ccfbdea3170ee5
```

## Option 1: Web Faucet (Recommended)
Visit: https://aptos.dev/network/faucet

1. Paste your address: `0x2f8f549bd4b7a715296ac63a5a75e5027a9181c6f46d7a56b9ccfbdea3170ee5`
2. Select "Testnet"
3. Click "Get APT"

## Option 2: Discord Faucet
1. Join Aptos Discord: https://discord.gg/aptoslabs
2. Go to #testnet-faucet channel
3. Type: `!faucet 0x2f8f549bd4b7a715296ac63a5a75e5027a9181c6f46d7a56b9ccfbdea3170ee5`

## After Funding

Check balance:
```bash
cd /Users/udingethe/Dev/fourcast
APTOS_CONFIG_DIR=.aptos-testnet aptos account list --profile testnet
```

Then deploy:
```bash
cd move
APTOS_CONFIG_DIR=../.aptos-testnet aptos move publish --profile testnet --named-addresses fourcast_addr=0x2f8f549bd4b7a715296ac63a5a75e5027a9181c6f46d7a56b9ccfbdea3170ee5 --assume-yes
```
