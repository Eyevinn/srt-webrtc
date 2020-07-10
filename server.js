require('make-promises-safe') // installs an 'unhandledRejection' handler

const { WebRTCConnectionManager } = require('@eyevinn/webrtc');
const MediaSource = require('./src/media_source.js');

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 180;

const mediaSource = new MediaSource({ host: "0.0.0.0", port: 1234, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

const connectionManager = new WebRTCConnectionManager({ port: 3000 });
connectionManager.register('beforeoffer', (peerConnection, next) => {
  console.log("Adding media tracks");
  peerConnection.addTrack(mediaSource.getAudioTrack());
  peerConnection.addTrack(mediaSource.getVideoTrack());
  next();
});

connectionManager.on('connect', connection => {
  console.log("Client connected");  
});
connectionManager.on('close', () => {
  console.log("Client closed connection");
});

mediaSource.listen();
connectionManager.listen();