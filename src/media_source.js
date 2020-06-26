const { RTCAudioSource, RTCVideoSource } = require('wrtc').nonstandard;
const { SRTReadStream } = require('@eyevinn/srt');
const { H264Decoder } = require('h264decoder');
const NaluChunker = require('@eyevinn/nalu-chunker');
const debug = require('debug')('media-source');


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
        //debug(`Got NAL unit of size ${nalu.data.byteLength}, decoding ${nalu.type}`);
        const ret = decoder.decode(nalu.data);
        //debug(`H264 Decoder returned ${ret}`);
        if (ret === H264Decoder.PIC_RDY) {
          debug(`Got frame ${decoder.width}x${decoder.height}`);
          this.videoSource.onFrame({
            width: decoder.width,
            height: decoder.height,
            data: decoder.pic.slice(0, decoder.width * decoder.height * 1.5)
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