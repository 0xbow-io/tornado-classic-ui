import networkConfig, { enabledChains } from '../networkConfig'
import { loadCachedEvents } from './helpers'

const EVENTS_PATH = './static/events/'

function main() {
  for (const netId of enabledChains) {
    const config = networkConfig[`netId${netId}`]
    const { constants, tokens, nativeCurrency, deployedBlock } = config
    const CONTRACTS = tokens[nativeCurrency].instanceAddress

    console.log(`\n ::: ${netId} [${nativeCurrency.toUpperCase()}] :::`)

    for (const [instance] of Object.entries(CONTRACTS)) {
      console.log(`\n instanceDenomation - ${instance}`)

      const withdrawalCachedEvents = loadCachedEvents({
        name: `withdrawals_${netId}_${nativeCurrency}_${instance}.json`,
        directory: EVENTS_PATH,
        deployedBlock
      })

      console.log('- Withdrawals')
      console.log('cachedEvents count - ', withdrawalCachedEvents.events.length)
      console.log('lastBlock - ', withdrawalCachedEvents.lastBlock)

      const depositCachedEvents = loadCachedEvents({
        name: `deposits_${netId}_${nativeCurrency}_${instance}.json`,
        directory: EVENTS_PATH,
        deployedBlock
      })

      console.log('- Deposits')
      console.log('cachedEvents count - ', depositCachedEvents.events.length)
      console.log('lastBlock - ', depositCachedEvents.lastBlock)

      const notesCachedEvents = loadCachedEvents({
        name: `encrypted_notes_${netId}.json`,
        directory: EVENTS_PATH,
        deployedBlock: constants.ENCRYPTED_NOTES_BLOCK
      })

      console.log('- Notes')
      console.log('cachedEvents count - ', notesCachedEvents.events.length)
      console.log('lastBlock - ', notesCachedEvents.lastBlock)
    }
  }
}

main()
