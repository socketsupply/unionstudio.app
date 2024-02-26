import { network, Encryption } from 'socket:network'

const sharedKey = await Encryption.createSharedKey('TEST')
const clusterId = await Encryption.createClusterId('TEST')
const peerId = await Encryption.createId()
const signingKeys = await Encryption.createKeyPair()

const options = {
  clusterId,
  peerId,
  signingKeys
}

const socket = await network(options)

socket.on('#ready', info => {
  console.log(info)
})
