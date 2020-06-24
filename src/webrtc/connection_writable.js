const { Writable } = require('stream');
const debug = require('debug')('connection-writable');

class ConnectionWriteStream extends Writable {
  constructor(peerConnection, videoSource) {
    super();
    this.peerConnection = peerConnection;
    this.videoSource = videoSource;
  }

  _write(frame, encoding, next) {
    debug("Writing frame");
    this.videoSource.onFrame({
      width: 320,
      height: 240,
      data: new Uint8ClampedArray(frame)
    });
    next();
  }
}

module.exports = ConnectionWriteStream;