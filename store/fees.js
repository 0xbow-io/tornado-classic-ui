/* eslint-disable no-console */
import { toWei, fromWei, toBN } from 'web3-utils'
import { TornadoFeeOracleV4, TornadoFeeOracleV5 } from '@tornado/tornado-oracles'

export const state = () => {
  return {
    gasPriceParams: { gasPrice: toWei(toBN(50), 'gwei') },
    withdrawalNetworkFee: toBN(0),
    withdrawalFeeViaRelayer: toBN(0)
  }
}

export const getters = {
  oracle: (state, getters, rootState, rootGetters) => {
    const netId = Number(rootGetters['metamask/netId'])
    const { url: rpcUrl } = rootState.settings[`netId${netId}`].rpc
    const { gasPrices } = rootGetters['metamask/networkConfig']

    // Return old oracle for backwards compatibility, if chain is ETH Mainnet
    return netId === 1
      ? new TornadoFeeOracleV4(netId, rpcUrl, gasPrices)
      : new TornadoFeeOracleV5(netId, rpcUrl, gasPrices)
  },
  getGasPriceParams: (state) => {
    return state.gasPriceParams
  },
  gasPrice: (state, getters) => {
    const { gasPrice, maxFeePerGas } = getters.getGasPriceParams
    return maxFeePerGas || gasPrice
  },
  gasPriceInGwei: (state, getters) => {
    return fromWei(getters.gasPrice, 'gwei')
  }
}

export const mutations = {
  SAVE_GAS_PARAMS(state, payload) {
    state.gasPriceParams = payload
  },
  SAVE_WITHDRAWAL_NETWORK_FEE(state, gasFee) {
    state.withdrawalNetworkFee = gasFee
  },
  SAVE_WITHDRAWAL_FEE_VIA_RELAYER(state, fee) {
    state.withdrawalFeeViaRelayer = fee
  }
}

export const actions = {
  async fetchGasPrice({ getters, dispatch, commit, rootGetters }) {
    const { pollInterval } = rootGetters['metamask/networkConfig']

    try {
      const gasPriceParams = await getters.oracle.getGasPriceParams()
      commit('SAVE_GAS_PARAMS', gasPriceParams)
    } catch (e) {
      console.error('fetchGasPrice', e)
    } finally {
      setTimeout(() => dispatch('fetchGasPrice'), 2000 * pollInterval)
    }
  },
  setDefaultGasPrice({ commit, rootGetters }) {
    const { gasPrices } = rootGetters['metamask/networkConfig']
    commit('SAVE_GAS_PARAMS', { gasPrice: toWei(gasPrices?.fast?.toFixed(9) || 0, 'gwei') })
  },
  async calculateWithdrawalNetworkFee({ getters, commit }, { tx }) {
    const withdrawalGas = await getters.oracle.getGas(tx, 'user_withdrawal')

    commit('SAVE_WITHDRAWAL_NETWORK_FEE', toBN(withdrawalGas))
  },
  async calculateWithdrawalFeeViaRelayer({ dispatch, getters, commit, rootGetters, rootState }, { tx }) {
    const feePercent = rootState.relayer.selectedRelayer.tornadoServiceFee
    const { currency, amount } = rootState.application.selectedStatistic
    const nativeCurrency = rootGetters['metamask/nativeCurrency']
    const { decimals } = rootGetters['metamask/networkConfig'].tokens[currency]

    await dispatch('calculateWithdrawalNetworkFee', { tx })
    if (currency !== nativeCurrency)
      await dispatch('application/setDefaultEthToReceive', { currency }, { root: true })

    const withdrawalFee = await getters.oracle.calculateWithdrawalFeeViaRelayer(
      'user_withdrawal',
      tx,
      feePercent,
      currency.toLowerCase(),
      amount,
      decimals,
      rootState.application.ethToReceive || 0,
      rootState.price.prices[currency.toLowerCase()]
    )

    commit('SAVE_WITHDRAWAL_FEE_VIA_RELAYER', toBN(withdrawalFee))
  }
}
