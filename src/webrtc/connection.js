const EventEmitter = require('events');
const DefaultRTCPeerConnection = require('wrtc').RTCPeerConnection;
const debug = require('debug')('connection');

const { hookRunner, hookIterator } = require('./hooks.js');

class Connection extends EventEmitter {
  constructor({ connectionId, RTCPeerConnection }) {
    super();

    const _private = {
      connectionId: connectionId,
      PeerConnection: RTCPeerConnection || DefaultRTCPeerConnection,
      state: 'open',
      frames: 0
    };

    const peerConnection = new _private.PeerConnection({ sdpSemantics: 'unified-plan' });

    hookRunner('beforeoffer', hookIterator, peerConnection, () => {});

    let connectionTimer = setTimeout(() => {
      if (peerConnection.iceConnectionState !== 'connected' && peerConnection.iceConnectionState !== 'completed') {
        this.close();
      }
    }, 10000);

    let reconnectionTimer = null;

    const onIceConnectionStateChange = () => {
      debug(this.getId() + `: ICE Connection State '${peerConnection.iceConnectionState}'`);
      if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
        if (connectionTimer) {
          clearTimeout(connectionTimer);
          connectionTimer = null;
        }
        clearTimeout(reconnectionTimer);
        reconnectionTimer = null;
      } else if (peerConnection.iceConnectionState === 'disconnected' || peerConnection.iceConnectionState === 'failed') {
        if (!connectionTimer && !reconnectionTimer) {
          const self = this;
          reconnectionTimer = setTimeout(() => {
            self.close();
          }, 10000);
        }
      }
    };
    peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange);

    this.doOffer = async () => {
      const offer = await peerConnection.createOffer();
      debug(this.getId() + ": Got offer: ");
      debug(offer);
      await peerConnection.setLocalDescription(offer);
      try {
        await waitUntilIceGatheringStateComplete(this.getId(), peerConnection);
      } catch (exc) {
        this.close();
        throw exc;
      }
    };

    this.applyAnswer = async (answer) => {
      debug(this.getId() + ": Apply answer: ");
      debug(answer);
      await peerConnection.setRemoteDescription(answer);
    };

    this.getId = () => _private.connectionId;
    this.asJson = () => ({
      id: _private.connectionId,
      localDescription: peerConnection.localDescription ? {
        type: peerConnection.localDescription.type,
        sdp: peerConnection.localDescription.sdp.replace(/\r\na=ice-options:trickle/g, ''),
      } : null,
      remoteDescription: peerConnection.remoteDescription ? {
        type: peerConnection.remoteDescription.type,
        sdp: peerConnection.remoteDescription.sdp.replace(/\r\na=ice-options:trickle/g, '')
      } : null,
      frames: _private.frames
    });
    this.close = () => {

      peerConnection.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange);
      if (connectionTimer) {
        clearTimeout(connectionTimer);
        connectionTimer = null;
      }
      if (reconnectionTimer) {
        clearTimeout(reconnectionTimer);
        reconnectionTimer = null;
      }
      peerConnection.close();
      _private.state = 'closed';
    }
  }
}

async function waitUntilIceGatheringStateComplete(id, peerConnection) {
  debug(`${id}: Wait until ICE Gathering State Complete`);
  if (peerConnection.iceGatheringState === 'complete') {
    return;
  }


  const deferred = {};
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  const timeout = setTimeout(() => {
    peerConnection.removeEventListener('icecandidate', onIceCandidate);
    deferred.reject(new Error('Timed out waiting for host candidates'));
  }, 3000);

  function onIceCandidate({ candidate }) {
    if (!candidate) {
      clearTimeout(timeout);
      peerConnection.removeEventListener('icecandidate', onIceCandidate);
      deferred.resolve();
    }
  }

  peerConnection.addEventListener('icecandidate', onIceCandidate);

  await deferred.promise;
}

module.exports = Connection;