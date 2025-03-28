# Tornado Cash Classic UI

> Self-hostable Tornado Cash UI software for interacting with the protocol

## Building locally

- Install [Node.js](https://nodejs.org) version 16
  - If you are using [nvm](https://github.com/creationix/nvm#installation) (recommended) running `nvm use` will automatically choose the right node version for you.
- Install [Yarn](https://yarnpkg.com/en/docs/install)
- Install dependencies: `yarn`
- Copy the `.env.example` file to `.env`
  - Replace environment variables with your own personal.
- Build the project to the `./dist/` folder with `yarn generate`.

## Development builds

To start a development build (e.g. with logging and file watching) run `yarn dev`.

## Deploy on IPFS

- Make sure you set `PINATA_API_KEY` and `PINATA_SECRET_API_KEY` environment variables in `.env`
- To deploy a production build run `yarn deploy-ipfs`.

## Architecture

For detailed explanation on how things work, checkout [Nuxt.js docs](https://nuxtjs.org).

## Audit

[TornadoCash_Classic_dApp_audit_Decurity.pdf](https://ipfs.io/ipfs/QmXzmwfsb4GwzmPD7W9VDNHh7ttyYKgXCY74973QMZqBDA)

## Update cached files

- To update deposit and withdrawal events use `yarn update:events {chainId} {optional: tokenOrEvent} {optional: tokenOrEvent}`
- To update encrypted notes use `yarn update:encrypted {chainId}`
- To update merkle tree use `yarn update:tree {chainId}`

#### NOTE!

After updating cached files do not forget to use `yarn update:zip`.

### Example for Ethereum Mainnet:

You may set in [`networkConfig.js`](./networkConfig.js) the `blockSyncInterval` (def: 10_000) to the maximum value allowed by your RPC provider. Command usage follows below.

```bash
# Updating events with just the required chain id parameter
yarn update:events 1
# Updating events for only one token across all instances on that network
yarn update:events 1 dai
# Updating events for only one event on only some network
yarn update:events 1 deposit
# Both
yarn update:events 1 dai deposit
# Updating encrypted notes for some chain id
yarn update:encrypted 1
# Updating trees for some chain id
yarn update:tree 1
# Finally zips must be updated
yarn update:zip
```

### Example for Binance Smart Chain:

```bash
yarn update:events 56
yarn update:events 56 bnb
yarn update:events 56 bnb deposit
yarn update:encrypted 56
yarn update:tree 56
yarn update:zip
```
