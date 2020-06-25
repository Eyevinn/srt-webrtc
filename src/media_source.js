const { RTCAudioSource, RTCVideoSource } = require('wrtc').nonstandard;
const { SRTReadStream } = require('@eyevinn/srt');
const { H264Decoder } = require('h264decoder');
const debug = require('debug')('media-source');

const NaluChunker = require('./nalu-chunker.js');

// ffmpeg -re -i /mnt/F1/F1\ CAN\ APR10.MOV -vcodec copy -an -f h264 srt://host.docker.internal:1234

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
      const decoder = new H264Decoder();
      const naluChunker = new NaluChunker();
      naluChunker.on('nalu', nalu => {
        debug(`Got NAL unit ${nalu.byteLength}, decoding`);
        const ret = decoder.decode(nalu);
        if (ret === H264Decoder.PIC_RDY) {
          debug("Got frame");
          this.videoSource.onFrame({
            width: decoder.width,
            height: decoder.height,
            data: decoder.pic
          });
        }
      });
      readStream.pipe(naluChunker);
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