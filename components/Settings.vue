<template>
  <div class="modal-card box box-modal">
    <header class="box-modal-header">
      <div class="box-modal-title">{{ $t('settings') }}</div>
      <button type="button" class="delete" @click="$parent.cancel('escape')" />
    </header>
    <div class="field">
      <b-field :label="$t('rpc')" class="has-custom-field" data-test="rpc_endpoint_dropdown">
        <b-dropdown v-model="selectedRpc" expanded aria-role="list">
          <div slot="trigger" class="control" :class="{ 'is-loading': checkingRpc && !isCustomRpc }">
            <div class="input">
              <span>{{ isCustomRpc ? $t('customRpc') : selectedRpc }}</span>
            </div>
          </div>
          <b-dropdown-item
            v-for="{ name, url } in Object.values(networkConfig.rpcUrls)"
            :key="name"
            :value="name"
            aria-role="listitem"
            :data-test="`rpc_endpoint_${name}`"
            @click="checkRpc({ name, url })"
          >
            {{ name }}
          </b-dropdown-item>
          <b-dropdown-item
            value="custom"
            aria-role="listitem"
            data-test="rpc_endpoint_custom"
            @click="checkRpc({ name: 'custom' })"
          >
            {{ $t('customRpc') }}
          </b-dropdown-item>
        </b-dropdown>
      </b-field>
      <div v-if="isCustomRpc" class="field has-custom-field">
        <b-input
          ref="customInput"
          v-model="customRpcUrl"
          type="url"
          :placeholder="$t('customRpcPlaceholder')"
          :custom-class="hasErrorRpc.type"
          :use-html5-validation="false"
          @input="checkCustomRpc"
        ></b-input>
      </div>
      <p v-if="hasErrorRpc.msg" class="help" :class="hasErrorRpc.type">
        {{ hasErrorRpc.msg }}
      </p>
    </div>
    <template v-if="!isEthereumNetwork">
      <div class="field">
        <b-field label="Ethereum RPC provider" class="has-custom-field" data-test="rpc_endpoint_eth_dropdown">
          <b-dropdown v-model="selectedEthRpc" expanded aria-role="list">
            <div slot="trigger" class="control" :class="{ 'is-loading': checkingRpc && !isCustomEthRpc }">
              <div class="input">
                <span>{{ isCustomEthRpc ? $t('customRpc') : selectedEthRpc }}</span>
              </div>
            </div>
            <b-dropdown-item
              v-for="{ name, url } in Object.values(ethNetworkConfig.rpcUrls)"
              :key="name"
              :value="name"
              aria-role="listitem"
              :data-test="`rpc_endpoint_eth_${name}`"
              @click="checkEthRpc({ name, url })"
            >
              {{ name }}
            </b-dropdown-item>
            <b-dropdown-item
              value="custom"
              aria-role="listitem"
              data-test="rpc_endpoint_eth_custom"
              @click="checkEthRpc({ name: 'custom' })"
            >
              {{ $t('customRpc') }}
            </b-dropdown-item>
          </b-dropdown>
        </b-field>
        <div v-if="isCustomEthRpc" class="field has-custom-field">
          <b-input
            ref="customInputTwo"
            v-model="customEthRpcUrl"
            type="url"
            :placeholder="$t('customRpcPlaceholder')"
            :custom-class="hasErrorEthRpc.type"
            :use-html5-validation="false"
            @input="checkCustomEthRpc"
          ></b-input>
        </div>
        <p v-if="hasErrorEthRpc.msg" class="help" :class="hasErrorEthRpc.type">
          {{ hasErrorEthRpc.msg }}
        </p>
      </div>
    </template>
    <div class="buttons buttons__halfwidth">
      <b-button type="is-primary" outlined data-test="button_reset_rpc" @mousedown.prevent @click="onReset">
        {{ $t('reset') }}
      </b-button>
      <b-button type="is-primary" :disabled="isDisabledSave" data-test="save_rpc_button" @click="onSave">
        {{ $t('save') }}
      </b-button>
    </div>
  </div>
</template>
<script>
/* eslint-disable no-console */
import { mapGetters, mapMutations } from 'vuex'

import { debounce } from '@/utils'
import networkConfig from '@/networkConfig'

export default {
  props: {
    netId: {
      type: Number,
      required: true
    }
  },
  data() {
    return {
      checkingRpc: false,
      hasErrorRpc: { type: '', msg: '' },
      hasErrorEthRpc: { type: '', msg: '' },
      customRpcUrl: '',
      customEthUrl: '',
      selectedRpc: 'custom',
      selectedEthRpc: 'custom',
      rpc: { name: 'custom', url: '' },
      ethRpc: { name: 'custom', url: '' }
    }
  },
  computed: {
    ...mapGetters('settings', ['getRpc']),
    networkConfig() {
      return networkConfig[`netId${this.netId}`]
    },
    ethNetworkConfig() {
      return networkConfig.netId1
    },
    isEthereumNetwork() {
      return this.netId === 1
    },
    isCustomRpc() {
      return this.selectedRpc === 'custom'
    },
    isCustomEthRpc() {
      return this.selectedEthRpc === 'custom'
    },
    isDisabledSave() {
      return (
        this.hasErrorRpc.type === 'is-warning' || this.checkingRpc || (this.isCustomRpc && !this.customRpcUrl)
      )
    }
  },
  created() {
    this.ethRpc = this.getRpc(1)
    this.rpc = this.getRpc(this.netId)
    this.selectedRpc = this.rpc.name
    this.selectedEthRpc = this.ethRpc.name

    if (this.selectedRpc === 'custom') {
      this.$nextTick(() => {
        this.customRpcUrl = this.rpc.url
      })
    }
    if (this.selectedEthRpc === 'custom') {
      this.$nextTick(() => {
        this.customEthRpcUrl = this.ethRpc.url
      })
    }

    this.checkRpc(this.rpc)
    this.checkEthRpc(this.ethRpc)
  },
  methods: {
    ...mapMutations('settings', ['SAVE_RPC']),
    onReset() {
      this.checkingRpc = false
      this.hasErrorRpc = { type: '', msg: '' }

      this.rpc = Object.entries(this.networkConfig.rpcUrls)[0][1]
      this.ethRpc = Object.entries(this.ethNetworkConfig.rpcUrls)[0][1]
      this.selectedRpc = this.rpc.name
      this.selectedEthRpc = this.ethRpc.name
      this.checkEthRpc(this.ethRpc)
      this.checkRpc(this.rpc)
    },
    onSave() {
      this.SAVE_RPC({ ...this.rpc, netId: this.netId })
      if (this.netId !== 1) {
        this.SAVE_RPC({ ...this.ethRpc, netId: 1 })
      }
      this.$emit('close')
    },
    onCancel() {
      this.$emit('cancel')
    },
    checkRpc({ name, url = '' }) {
      this.checkingRpc = true

      if (name === 'custom') {
        this.customRpcUrl = ''
        this.hasErrorRpc = { type: '', msg: '' }
      }
      this._checkRpc({ name, url })
    },
    checkEthRpc({ name, url = '' }) {
      this.checkingRpc = true

      if (name === 'custom') {
        this.customEthRpcUrl = ''
        this.hasErrorEthRpc = { type: '', msg: '' }
        return
      }
      this._checkEthRpc({ name, url })
    },
    checkCustomRpc(url) {
      const trimmedUrl = url.trim()
      if (!trimmedUrl) {
        this.hasErrorRpc = { type: '', msg: '' }
        return
      }
      debounce(this._checkRpc, { name: 'custom', url: trimmedUrl })
    },
    checkCustomEthRpc(url) {
      const trimmedUrl = url.trim()
      if (!trimmedUrl) {
        this.hasErrorEthRpc = { type: '', msg: '' }
        return
      }
      debounce(this._checkEthRpc, { name: 'custom', url: trimmedUrl })
    },
    async _checkRpc({ name, url }) {
      this.checkingRpc = true
      this.hasErrorRpc = { type: '', msg: '' }

      const { isValid, error } = await this.$store.dispatch('settings/checkRpc', {
        url,
        netId: this.netId
      })

      if (isValid) {
        this.hasErrorRpc.type = 'is-primary'
        this.hasErrorRpc.msg = this.$t('rpcStatusOk')
        this.rpc = { name, url }
      } else {
        this.hasErrorRpc.type = 'is-warning'
        this.hasErrorRpc.msg = error
      }

      this.checkingRpc = false
    },
    async _checkEthRpc({ name, url }) {
      this.checkingRpc = true
      this.hasErrorEthRpc = { type: '', msg: '' }

      const { isValid, error } = await this.$store.dispatch('settings/checkRpc', {
        url,
        netId: 1,
        isEthRpc: true
      })

      if (isValid) {
        this.hasErrorEthRpc.type = 'is-primary'
        this.hasErrorEthRpc.msg = this.$t('rpcStatusOk')
        this.ethRpc = { name, url }
      } else {
        this.hasErrorEthRpc.type = 'is-warning'
        this.hasErrorEthRpc.msg = error
      }

      this.checkingRpc = false
    }
  }
}
</script>
