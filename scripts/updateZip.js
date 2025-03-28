import { uniqBy } from 'lodash'

import networkConfig, { enabledChains } from '../networkConfig'

import { loadCachedEvents, save } from './helpers'

const EVENTS_PATH = './static/events/'
const EVENTS = ['Deposit', 'Withdrawal']

function updateEncrypted(netId) {
  try {
    const file = `${EVENTS_PATH}encrypted_notes_${netId}.json`
    save(file)
  } catch {}
}

async function updateCommon(netId) {
  const { nativeCurrency, tokens } = networkConfig[`netId${netId}`]

  for (const type of EVENTS) {
    for (const [tokenName, tokenInfo] of Object.entries(tokens)) {
      console.log(`${tokenInfo.symbol}: ${Object.keys(tokenInfo.instanceAddress)}`)
      for (const instance of Object.keys(tokenInfo.instanceAddress)) {
        console.warn('instance', instance)

        const filename = `${type.toLowerCase()}s_${netId}_${tokenName}_${instance}.json`

        const isSaved = save(`${EVENTS_PATH}${filename}`)

        if (isSaved) {
          try {
            testCommon(netId, type, filename)
          } catch (err) {
            console.error(err.message)
          }
        }
      }
    }
  }
}

function testCommon(netId, type, filename) {
  const { deployedBlock } = networkConfig[`netId${netId}`]

  const cachedEvents = loadCachedEvents({
    name: filename,
    directory: EVENTS_PATH,
    deployedBlock
  })

  console.log('cachedEvents', cachedEvents.events.length, type)

  let events = cachedEvents.events

  if (type === 'Withdrawal') {
    events = uniqBy(cachedEvents.events, 'nullifierHash')
  } else if (type === 'Deposit') {
    events = cachedEvents.events.filter((e, index) => Number(e.leafIndex) === index)
  }

  if (events.length !== cachedEvents.events.length) {
    console.error('events.length', events.length)
    console.error('cachedEvents.events.length', cachedEvents.events.length)
    throw new Error(`Duplicates was detected in ${filename} (${events.length - cachedEvents.events.length})`)
  }
}

async function main() {
  for (let i = 0; i < enabledChains.length; i++) {
    const netId = enabledChains[i]

    updateEncrypted(netId)

    await updateCommon(netId)
  }
}

main()
