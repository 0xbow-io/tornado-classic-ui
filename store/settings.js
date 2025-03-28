/* eslint-disable no-console */
import Web3 from 'web3'

import networkConfig from '@/networkConfig'

const getFirstRpcs = (acc, [netId, { rpcUrls }]) => {
  const [rpc] = Object.values(rpcUrls)

  acc[netId] = {
    rpc
  }

  return acc
}

const rpcData = Object.entries(networkConfig).reduce(getFirstRpcs, {})

export const state = () => {
  return {
    ...rpcData,
    isActiveNotification: {
      first: true,
      second: true,
      third: true
    }
  }
}

export const getters = {
  getRpc: (state) => (netId) => {
    return state[`netId${netId}`].rpc
  },
  currentRpc: (state, getters, rootState) => {
    const netId = rootState.metamask.netId
    return state[`netId${netId}`].rpc
  }
}

export const mutations = {
  SAVE_RPC(state, { netId, name, url }) {
    this._vm.$set(state[`netId${netId}`], 'rpc', { name, url })
  },
  DISABLE_NOTIFICATION(state, { key }) {
    this._vm.$set(state, 'isActiveNotification', { ...state.isActiveNotification, [key]: false })
  }
}

export const actions = {
  disableNotification({ commit }, params) {
    commit('DISABLE_NOTIFICATION', params)
  },
  async checkCurrentRpc({ dispatch, getters, rootGetters }) {
    const netId = rootGetters['metamask/netId']
    if (netId !== 1) {
      await dispatch('preselectRpc', { netId: 1, isEthRpc: true })
    }
    await dispatch('preselectRpc', { netId })
  },
  async preselectRpc({ getters, commit, dispatch }, { netId, isEthRpc = false }) {
    const savedRpc = getters.getRpc(netId)
    const { isValid } = await dispatch('checkRpc', { ...savedRpc, netId, isEthRpc })

    if (isValid) {
      return
    }

    const { rpcUrls } = networkConfig[`netId${netId}`]

    for (const [, { name, url }] of Object.entries(rpcUrls)) {
      const { isValid, error } = await dispatch('checkRpc', { url, netId, isEthRpc })
      if (isValid) {
        commit('SAVE_RPC', { netId, name, url })
        return
      } else {
        console.error('preselectRpc', url, error)
      }
    }
    throw new Error(this.app.i18n.t('rpcSelectError'))
  },
  async checkRpc(_, { url, netId, isEthRpc = false }) {
    try {
      const web3 = new Web3(url)
      const chainId = await web3.eth.getChainId()
      const isCurrent = Number(chainId) === Number(netId)

      if (isEthRpc || isCurrent) {
        return { isValid: true }
      } else {
        return { isValid: false, error: this.app.i18n.t('thisRpcIsForDifferentNetwork') }
      }
    } catch (e) {
      console.error('checkRpc', e)
      return { isValid: false, error: this.app.i18n.t('rpcIsDown') }
    }
  }
}
