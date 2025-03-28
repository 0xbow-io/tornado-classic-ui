import 'dotenv/config'

import fs from 'fs'
import { uniqBy } from 'lodash'

import networkConfig, { enabledChains } from '../networkConfig'
import ABI from '../abis/Instance.abi.json'

import { loadCachedEvents, getPastEvents } from './helpers'

const EVENTS_PATH = './static/events/'

function parseArg(netId, tokenOrEvent) {
  const { tokens } = networkConfig[`netId${netId}`]
  const keys = Object.keys(tokens)
  if (tokenOrEvent !== undefined) {
    const lower = tokenOrEvent.toLowerCase()
    return keys.includes(lower)
      ? { token: lower }
      : { event: lower[0].toUpperCase() + lower.slice(1).toLowerCase() }
  } else return undefined
}

function parseDepositEvent({ blockNumber, transactionHash, returnValues }) {
  const { commitment, leafIndex, timestamp } = returnValues
  return {
    timestamp,
    commitment,
    blockNumber,
    transactionHash,
    leafIndex: Number(leafIndex)
  }
}

function parseWithdrawalEvent({ blockNumber, transactionHash, returnValues }) {
  const { nullifierHash, to, fee } = returnValues
  return {
    to,
    fee,
    blockNumber,
    nullifierHash,
    transactionHash
  }
}

function filterWithdrawalEvents(events) {
  return uniqBy(events, 'nullifierHash').sort((a, b) => a.blockNumber - b.blockNumber)
}

function filterDepositEvents(events) {
  return events.filter((e, index) => Number(e.leafIndex) === index)
}

async function main(netId, chosenToken, chosenEvent) {
  const { tokens, deployedBlock } = networkConfig[`netId${netId}`]

  const tokenSymbols = chosenToken !== undefined ? [chosenToken] : Object.keys(tokens)
  const eventNames = chosenEvent !== undefined ? [chosenEvent] : ['Deposit', 'Withdrawal']

  for (const eventName of eventNames) {
    // Get the parser that we need
    const parser = eventName === 'Deposit' ? parseDepositEvent : parseWithdrawalEvent
    // Get the parser that we need
    const filter = eventName === 'Deposit' ? filterDepositEvents : filterWithdrawalEvents

    for (const tokenSymbol of tokenSymbols) {
      // Now load the denominations and address
      const instanceData = Object.entries(tokens[tokenSymbol].instanceAddress)

      // And now sync
      for (const data of instanceData) {
        const denom = data[0]
        const address = data[1]

        // Now load cached events
        const cachedEvents = loadCachedEvents({
          name: `${eventName.toLowerCase()}s_${netId}_${tokenSymbol}_${denom}.json`,
          directory: EVENTS_PATH,
          deployedBlock
        })

        console.log('Update events for', denom, tokenSymbol.toUpperCase(), `${eventName.toLowerCase()}s`)
        console.log('cachedEvents count - ', cachedEvents.events.length)
        console.log('lastBlock - ', cachedEvents.lastBlock)

        let events = await getPastEvents({
          type: eventName,
          fromBlock: cachedEvents.lastBlock + 1,
          netId: netId,
          events: [],
          contractAttrs: [ABI, address]
        })

        events = filter(cachedEvents.events.concat(events.map(parser)))

        fs.writeFileSync(
          `${EVENTS_PATH}${eventName.toLowerCase()}s_${netId}_${tokenSymbol}_${denom}.json`,
          JSON.stringify(events, null, 2) + '\n'
        )
      }
    }
  }
}

/**
 * @param netId ID of the network for which event(s) should be synced.
 * @param tokenOrEvent Optional token or event.
 * @param eventOrToken Optional token or event. Overwrites the former option.
 */
async function start() {
  const [, , , netId, tokenOrEvent, eventOrToken] = process.argv

  const args = { ...parseArg(netId, tokenOrEvent), ...parseArg(netId, eventOrToken) }

  if (!enabledChains.includes(netId)) {
    throw new Error(`Supported chain ids ${enabledChains.join(', ')}`)
  }

  await main(netId, args.token, args.event)
}

start()
