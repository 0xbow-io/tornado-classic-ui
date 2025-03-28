/* eslint-disable no-console */
export default ({ store, isHMR, app }, inject) => {
  inject('isLoadedFromIPFS', main)
}
function main() {
  const whiteListedDomains = [
    'tornadocash.eth.link',
    'tornadocash.eth.limo',
    'tornadocashcommunity.eth.link',
    'tornadocashcommunity.eth.limo'
  ]

  const IPFS_GATEWAY_REGEXP = /.ipfs./
  const IPFS_LOCAL_REGEXP = /.ipfs.localhost:/
  const IPFS_SOP_GATEWAY_REGEXP = /\/ipfs\//

  if (IPFS_LOCAL_REGEXP.test(window.location.host)) {
    return false
  } else if (
    IPFS_GATEWAY_REGEXP.test(window.location.host) ||
    IPFS_SOP_GATEWAY_REGEXP.test(window.location.host) ||
    whiteListedDomains.includes(window.location.host)
  ) {
    console.warn('The page has been loaded from ipfs.io. LocalStorage is disabled')
    return true
  }

  return false
}
