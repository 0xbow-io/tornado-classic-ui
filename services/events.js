import Web3 from 'web3'

import graph from '@/services/graph'
import { download } from '@/store/snark'
import networkConfig, { enabledChains, blockSyncInterval } from '@/networkConfig'
import InstanceABI from '@/abis/Instance.abi.json'
import { CONTRACT_INSTANCES, eventsType, httpConfig } from '@/constants'
import { sleep, flattenNArray, formatEvents, capitalizeFirstLetter } from '@/utils'

let store
if (process.browser) {
  window.onNuxtReady(({ $store }) => {
    store = $store
  })
}

class EventService {
  constructor({ netId, amount, currency, factoryMethods }) {
    this.idb = window.$nuxt.$indexedDB(netId)

    const { nativeCurrency } = networkConfig[`netId${netId}`]
    const hasCache = enabledChains.includes(netId.toString())

    this.netId = netId
    this.amount = amount
    this.currency = currency

    this.factoryMethods = factoryMethods
    this.contract = this.getContract({ netId, amount, currency })

    this.isNative = nativeCurrency === this.currency
    this.hasCache = this.isNative && hasCache
  }

  getInstanceName(type) {
    return `${type}s_${this.netId}_${this.currency}_${this.amount}`
  }

  updateEventProgress(percentage, type) {
    if (store) {
      store.dispatch('loading/updateProgress', {
        message: `Fetching past ${type} events`,
        progress: Math.ceil(percentage * 100)
      })
    }
  }

  async getEvents(type) {
    let cachedEvents = await this.getEventsFromDB(type)

    if (!cachedEvents && this.hasCache) {
      cachedEvents = await this.getEventsFromCache(type)
    }

    return cachedEvents
  }

  async updateEvents(type, cachedEvents) {
    const { deployedBlock } = networkConfig[`netId${this.netId}`]

    const savedEvents = cachedEvents || (await this.getEvents(type))

    let fromBlock = deployedBlock

    if (savedEvents) {
      fromBlock = savedEvents.lastBlock + 1
    }

    const newEvents = await this.getEventsFromBlock({
      type,
      fromBlock,
      graphMethod: `getAll${capitalizeFirstLetter(type)}s`
    })

    const allEvents = [].concat(savedEvents?.events || [], newEvents?.events || []).sort((a, b) => {
      if (a.leafIndex && b.leafIndex) {
        return a.leafIndex - b.leafIndex
      }
      return a.blockNumber - b.blockNumber
    })
    const lastBlock = allEvents[allEvents.length - 1].blockNumber

    this.saveEvents({ events: allEvents, lastBlock, type })

    return {
      events: allEvents,
      lastBlock
    }
  }
  async findEvent({ eventName, eventToFind, type }) {
    const instanceName = this.getInstanceName(type)

    let event = await this.idb.getFromIndex({
      storeName: instanceName,
      indexName: eventName,
      key: eventToFind
    })

    if (event) {
      return event
    }

    const savedEvents = await this.getEvents(type)
    if (savedEvents) {
      event = savedEvents.events.find((event) => event[eventName] === eventToFind)
      if (event) {
        return event
      }
    }

    const freshEvents = await this.updateEvents(type)
    event = freshEvents && freshEvents?.events.find((event) => event[eventName] === eventToFind)

    return event
  }

  getContract({ netId, amount, currency }) {
    const config = networkConfig[`netId${netId}`]
    const address = config.tokens[currency].instanceAddress[amount]
    return this.factoryMethods.getContract(address)
  }

  async getEventsFromCache(type) {
    try {
      const instanceName = this.getInstanceName(type)
      if (!CONTRACT_INSTANCES.includes(String(this.amount))) {
        console.error(`Amount doesn't includes in contract instances`)
        return
      }

      const module = await download({
        contentType: 'string',
        name: `events/${instanceName}.json.gz`
      })

      if (module) {
        const events = JSON.parse(module)

        return {
          events,
          lastBlock: events[events.length - 1].blockNumber
        }
      }

      return {
        events: [],
        lastBlock: ''
      }
    } catch (err) {
      return undefined
    }
  }

  async getEventsFromDB(type) {
    try {
      const instanceName = this.getInstanceName(type)
      const savedEvents = await this.idb.getAll({ storeName: instanceName })

      if (!savedEvents || !savedEvents.length) {
        return undefined
      }

      return {
        events: savedEvents,
        lastBlock: savedEvents[savedEvents.length - 1].blockNumber
      }
    } catch (err) {
      return undefined
    }
  }

  async getStatisticsRpc({ eventsCount }) {
    const { deployedBlock } = networkConfig[`netId${this.netId}`]
    const savedEvents = await this.getEvents(eventsType.DEPOSIT)

    if (savedEvents.events.length) {
      const { events } = await this.updateEvents(eventsType.DEPOSIT, savedEvents)
      return events
    }

    const blockRange = Math.floor(blockSyncInterval / 2) - 1
    const fromBlock = deployedBlock
    const { blockDifference, currentBlockNumber } = await this.getBlocksDiff({ fromBlock })

    let numberParts = blockDifference === 0 ? 1 : Math.ceil(blockDifference / blockRange)
    const part = Math.ceil(blockDifference / numberParts)

    let events = []
    let toBlock = currentBlockNumber

    if (fromBlock < currentBlockNumber) {
      for (let i = 0; i < numberParts; i++) {
        try {
          await sleep(200)
          const partOfEvents = await this.getEventsPartFromRpc({
            fromBlock: toBlock - part,
            toBlock,
            type: eventsType.DEPOSIT
          })

          if (partOfEvents) {
            events = events.concat(partOfEvents.events)
            if (eventsCount <= events.length) {
              break
            }
          }
          toBlock -= part
        } catch {
          numberParts = numberParts + 1
        }
      }
      if (eventsCount !== events.length) {
        const savedEvents = await this.getEvents(eventsType.DEPOSIT)
        events = events.concat(savedEvents?.events || [])
      }
    }

    return events
  }

  async getEventsFromGraph({ fromBlock, methodName }) {
    try {
      const { events, lastSyncBlock } = await graph[methodName]({
        fromBlock,
        netId: this.netId,
        amount: this.amount,
        currency: this.currency
      })
      return {
        events,
        lastBlock: lastSyncBlock
      }
    } catch (err) {
      return undefined
    }
  }

  async getBlocksDiff({ fromBlock }) {
    const currentBlockNumber = await this.factoryMethods.getBlockNumber()

    return {
      currentBlockNumber,
      blockDifference: Math.ceil(currentBlockNumber - fromBlock)
    }
  }

  getPastEvents({ fromBlock, toBlock, type }, shouldRetry = false, retries = 0) {
    return new Promise((resolve, reject) => {
      this.contract
        .getPastEvents(capitalizeFirstLetter(type), {
          fromBlock,
          toBlock
        })
        .then((events) => resolve(events))
        .catch((err) => {
          retries++

          // If provider.getBlockNumber returned last block that isn't accepted (happened on Avalanche/Gnosis),
          // get events to last accepted block
          if (err.message.includes('after last accepted block')) {
            const acceptedBlock = parseInt(err.message.split('after last accepted block ')[1])
            toBlock = acceptedBlock
            // Retries to 0, because it is not RPC error
            retries = 0
          }

          // maximum 5 second buffer for rate-limiting
          if (shouldRetry) {
            const shouldRetryAgain = retries < 5

            sleep(1000 * retries).then(() =>
              this.getPastEvents({ fromBlock, toBlock, type }, shouldRetryAgain, retries)
                .then((events) => resolve(events))
                .catch((_) => resolve(undefined))
            )
          } else {
            reject(new Error(err))
          }
        })
    })
  }

  async getEventsPartFromRpc(parameters, shouldRetry = false) {
    try {
      const { fromBlock, type } = parameters
      const { currentBlockNumber } = await this.getBlocksDiff({ fromBlock })

      if (fromBlock < currentBlockNumber) {
        const eventsPart = await this.getPastEvents(parameters, shouldRetry)

        if (eventsPart) {
          if (eventsPart.length > 0) {
            return {
              events: formatEvents(eventsPart, type),
              lastBlock: eventsPart[eventsPart.length - 1].blockNumber
            }
          } else {
            return {
              events: [],
              lastBlock: fromBlock
            }
          }
        } else {
          return undefined
        }
      } else {
        return {
          events: [],
          lastBlock: fromBlock
        }
      }
    } catch (err) {
      return undefined
    }
  }

  createBatchRequest(batchArray) {
    return batchArray.map(
      (e, i) =>
        new Promise((resolve) =>
          sleep(20 * i).then(() =>
            this.getEventsPartFromRpc({ ...e }, true).then((batch) => {
              if (!batch) {
                resolve([{ isFailedBatch: true, ...e }])
              } else {
                resolve(batch.events)
              }
            })
          )
        )
    )
  }

  async getBatchEventsFromRpc({ fromBlock, type }) {
    try {
      const batchSize = 10

      let [events, failed] = [[], []]
      let lastBlock = fromBlock

      const { blockDifference, currentBlockNumber } = await this.getBlocksDiff({ fromBlock })
      const batchDigest = blockDifference === 0 ? 1 : Math.ceil(blockDifference / blockSyncInterval)

      const blockDenom = Math.ceil(blockDifference / batchDigest)
      const batchCount = Math.ceil(batchDigest / batchSize)

      if (fromBlock < currentBlockNumber) {
        this.updateEventProgress(0, type)

        for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
          const isLastBatch = batchIndex === batchCount - 1
          const params = new Array(batchSize).fill('').map((_, i) => {
            const toBlock = (i + 1) * blockDenom + lastBlock
            const fromBlock = toBlock - blockDenom
            return { fromBlock, toBlock, type }
          })
          const batch = await Promise.all(this.createBatchRequest(params))
          const requests = flattenNArray(batch)

          events = events.concat(requests.filter((e) => !e.isFailedBatch))
          failed = failed.concat(requests.filter((e) => e.isFailedBatch))
          lastBlock = params[batchSize - 1].toBlock

          const progressIndex = batchIndex - failed.length / batchSize

          if (isLastBatch && failed.length !== 0) {
            const failedBatch = await Promise.all(this.createBatchRequest(failed))
            const failedReqs = flattenNArray(failedBatch)
            const failedRept = failedReqs.filter((e) => e.isFailedBatch)

            if (failedRept.length === 0) {
              events = events.concat(failedReqs)
            } else {
              throw new Error('Failed to batch events')
            }
          }
          this.updateEventProgress(progressIndex / batchCount, type)
        }

        return {
          lastBlock: events[events.length - 1].blockNumber,
          events
        }
      } else {
        return undefined
      }
    } catch (err) {
      return undefined
    }
  }

  async getEventsFromRpc({ fromBlock, type }) {
    try {
      const { blockDifference } = await this.getBlocksDiff({ fromBlock })

      let events

      if (blockDifference < blockSyncInterval) {
        const rpcEvents = await this.getEventsPartFromRpc({ fromBlock, toBlock: 'latest', type })
        events = rpcEvents?.events || []
      } else {
        const rpcEvents = await this.getBatchEventsFromRpc({ fromBlock, type })
        events = rpcEvents?.events || []
      }

      return events
    } catch (err) {
      return []
    }
  }

  async getEventsFromBlock({ fromBlock, graphMethod, type }) {
    try {
      // ToDo think about undefined
      const rpcEvents = await this.getEventsFromRpc({ fromBlock, type })

      const allEvents = [].concat(rpcEvents || [])

      if (allEvents.length) {
        return {
          events: allEvents,
          lastBlock: allEvents[allEvents.length - 1].blockNumber
        }
      }
      return undefined
    } catch (err) {
      return undefined
    }
  }

  async saveEvents({ events, lastBlock, type }) {
    try {
      if (!events || !events.length || this.idb.isBlocked) {
        return
      }

      const instanceName = this.getInstanceName(type)

      await this.idb.createMultipleTransactions({
        data: events,
        storeName: instanceName
      })

      await this.idb.putItem({
        data: {
          blockNumber: lastBlock,
          name: instanceName
        },
        storeName: 'lastEvents'
      })
    } catch (err) {
      console.error('saveEvents has error:', err.message)
    }
  }
}

class EventsFactory {
  instances = new Map()

  constructor(rpcUrl) {
    const httpProvider = new Web3.providers.HttpProvider(rpcUrl, httpConfig)

    this.provider = new Web3(httpProvider).eth
  }

  getBlockNumber = () => {
    return this.provider.getBlockNumber()
  }

  getContract = (address) => {
    return new this.provider.Contract(InstanceABI, address)
  }

  getService = (payload) => {
    const instanceName = `${payload.netId}_${payload.currency}_${payload.amount}`

    if (this.instances.has(instanceName)) {
      return this.instances.get(instanceName)
    }

    const instance = new EventService({
      ...payload,
      factoryMethods: {
        getContract: this.getContract,
        getBlockNumber: this.getBlockNumber
      }
    })
    this.instances.set(instanceName, instance)
    return instance
  }
}

export { EventsFactory }
