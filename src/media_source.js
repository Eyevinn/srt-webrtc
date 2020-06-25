const { RTCAudioSource, RTCVideoSource } = require('wrtc').nonstandard;
const { SRTReadStream } = require('@eyevinn/srt');
const chunker = require('stream-chunker');

class MediaSource {
  constructor({ host, port, width, height }) {
    this.host = host;
    this.port = port;
    this.width = width;
    this.height = height;

    this.audioSource = new RTCAudioSource();
    this.videoSource = new RTCVideoSource();
    this.audioTrack = this.audioSource.createTrack();
    this.videoTrack = this.videoSource.createTrack();  
  }

  listen() {
    const srt = new SRTReadStream(this.host, this.port);
    console.log("Waiting for SRT source to be connected");
    srt.listen(readStream => {
      const frameChunker = chunker(this.width * this.height * 1.5);
      frameChunker.on('data', data => {
        this.videoSource.onFrame({
          width: this.width,
          height: this.height,
          data: new Uint8ClampedArray(data)
        });    
      });
      readStream.pipe(frameChunker);
    });
  }

  getAudioTrack() {
    return this.audioTrack;
  }

  getVideoTrack() {
    return this.videoTrack;
  }
}

module.exports = MediaSource;