require('make-promises-safe') // installs an 'unhandledRejection' handler
const { RTCAudioSource, RTCVideoSource } = require('wrtc').nonstandard;
const { SRTReadStream } = require('@eyevinn/srt');
const chunker = require('stream-chunker');

const WebRTCConnectionManager = require('./src/webrtc/connection_manager.js');
const ConnectionWritable = require('./src/webrtc/connection_writable.js');

let audioTrack;
let videoTrack;
let writeStream;
let audioSource;
let videoSource;

const WIDTH = 320;
const HEIGHT = 180;

const connectionManager = new WebRTCConnectionManager({ port: 3000 });
connectionManager.register('beforeoffer', (peerConnection, next) => {
  audioSource = new RTCAudioSource();
  videoSource = new RTCVideoSource();
  audioTrack = audioSource.createTrack();
  videoTrack = videoSource.createTrack();

  peerConnection.addTrack(audioTrack);
  peerConnection.addTrack(videoTrack);
  next();
});

connectionManager.on('connect', connection => {
  const srt = new SRTReadStream("0.0.0.0", 1234);
  console.log("Waiting for SRT client to be connected");
  srt.listen(readStream => {
    const frameChunker = chunker(WIDTH * HEIGHT * 1.5);
    frameChunker.on('data', data => {
      videoSource.onFrame({
        width: WIDTH,
        height: HEIGHT,
        data: new Uint8ClampedArray(data)
      });
  
    });
    readStream.pipe(frameChunker);
  });  
});
connectionManager.on('close', () => {
  audioTrack.stop();
  videoTrack.stop();
});


connectionManager.listen();