/* eslint-disable no-console */
import { TokenPriceOracle } from '@tornado/tornado-oracles'

export const state = () => {
  return {
    prices: {
      torn: '1607657994944809',
      dai: '604623353553108',
      cdai: '13524059864784',
      usdc: '600920027684692',
      usdt: '600764414690498',
      wbtc: '15636492243151834302'
    }
  }
}

export const getters = {
  priceOracle: (state, getters, rootState, rootGetters) => {
    const netId = Number(rootGetters['metamask/netId'])
    const { url: rpcUrl } = rootState.settings[`netId${netId}`].rpc

    return new TokenPriceOracle(rpcUrl)
  },
  tokenRate: (state, getters, rootState) => {
    return state.prices[rootState.application.selectedStatistic.currency]
  },
  getTokenPrice: (state) => (currency) => {
    return state.prices[currency]
  },
  isPriceWatcherDisabled: (state, getters, rootState, rootGetters) => {
    const nativeCurrency = rootGetters['metamask/nativeCurrency']
    const tokens = Object.keys(rootGetters['metamask/networkConfig'].tokens)
    return tokens.includes(nativeCurrency) && tokens.length === 1
  }
}

export const mutations = {
  SAVE_TOKEN_PRICES(state, prices) {
    state.prices = {
      ...state.prices,
      ...prices
    }
  }
}

export const actions = {
  async fetchTokenPrice({ getters, commit, dispatch, rootState }) {
    if (getters.isPriceWatcherDisabled) {
      return
    }

    try {
      const prices = await getters.priceOracle.fetchPrices()
      console.log('prices', prices)
      commit('SAVE_TOKEN_PRICES', prices)

      setTimeout(() => dispatch('fetchTokenPrice'), 1000 * 30)
    } catch (e) {
      console.error(e)
      setTimeout(() => dispatch('fetchTokenPrice'), 1000 * 30)
    }
  }
}
