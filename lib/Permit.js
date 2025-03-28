import { concatSig } from 'eth-sig-util'

const PermitType = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' }
]

const EIP712DomainType = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' }
]

export default class PermitSigner {
  constructor(_domain, _permitArgs) {
    this.permitArgs = _permitArgs
    this.domain = _domain
  }

  setPermitInfo(_permitArgs) {
    this.permitArgs = _permitArgs
  }

  getReqPayload() {
    return {
      domain: this.domain,
      primaryType: 'Permit',
      types: {
        Permit: PermitType,
        EIP712Domain: EIP712DomainType
      },
      message: this.permitArgs
    }
  }

  getSignature(response) {
    response = response.substring(2)

    const r = '0x' + response.substring(0, 64)
    const s = '0x' + response.substring(64, 128)

    let v = parseInt(response.substring(128, 130), 16)

    // fix ledger sign
    if (v === 0 || v === 1) {
      v = v + 27
    }

    return {
      hex: concatSig(v, r, s),
      v,
      r,
      s
    }
  }
}
