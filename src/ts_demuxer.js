const { Writable, Transform } = require('stream');
const debug = require('debug')('ts-demuxer');

const SYNC_BYTE = 0x47;
const PACKET_SIZE = 188;
const MIN_PES_HDR_SIZE = 19;
const PES_HDR_SIZE = 6;
const PES_EXT_SIZE = 3;

const PAT_ID = 0x0;
const PID_AAC = 0x0f;
const PID_ID3 = 0x15;
const PID_AVC = 0x1b;
const PID_HEVC = 0x24;
const PID_SCTE35 = 0x86;

const Packet = function constructor() {
  return {
    sync: undefined, // [8]  [0xff000000] Sync byte
    tei: undefined,  // [1]    [0x800000] Transport Error Indicator
    pusi: undefined, // [1]    [0x400000] Payload Unit Start Indicator
    tp: undefined,   // [1]    [0x200000] Transport Priority 
    pid: undefined,  // [13]   [0x1fff00] Packet Identifier, describing the payload data
    tsc: undefined,  // [2]        [0xc0] Transport Scrambling Control
    atf: undefined,  // [2]        [0x30] Adaptation Field Control
    co: undefined,   // [4]         [0xf] Continuity Order

    // Adaptation Field
    atflen: undefined, // [8]             Number of bytes in the adaptation field imm following this bytes
    disc: undefined,   // [1]      [0x80] Set if current TS packet is in a discontinuity state
    ra: undefined,     // [1]      [0x40] Set when the stream may be decoded without errors from this point
    prio: undefined,   // [1]      [0x20] Set when this stream should be considered "high priority"
    pcr: undefined,    // [1]      [0x10] Set when the PCR field is present
    opcr: undefined,   // [1]      [0x08] Set when the OPCR field is present

    pcrPayload: undefined,
    pcrValue: undefined,
    pcrBase: undefined,
    pcrExt: undefined,
  };
};

class PESStream extends Transform {
  constructor(type) {
    super();
    this.type = type;
    this.remainder = Buffer.alloc(0, 0);
  }

  _transform(data, encoding, next) {
    const fragment = Buffer.concat([this.remainder, data]);
    const len = fragment.length;

    let pes = {};
    const prefix = (fragment[0] << 16) + (fragment[1] << 8) + fragment[2];
    let payloadStart = 0, hdrlen = 0;

    if (prefix === 1) {
      pes.id = fragment[3];
      pes.pkglen = (fragment[4] << 8) + fragment[5];
      if (pes.pkglen && pes.pkglen > stream.data.length - 6) {
        const remain = pes.pkglen - stream.size + 6;
        debug(`Incomplete PES package we need to wait for more data (${pes.pkglen}): ${remain} bytes`);
      } else {
        if (pes.pkglen === 0) {
          // If PES package length is 0 the PES packet can be of any length
        }
        pes.flags = fragment[7]; // Second byte in optional PES header
        hdrlen = fragment[8];
        payloadStart = hdrlen + PES_HDR_SIZE + PES_EXT_SIZE;
      }
      pes.payload = new Uint8Array(fragment.length - payloadStart);
      pes.payload.set(stream.data.subarray(payloadStart));
      if (pes.pkglen) {
        pes.pkglen -= hdrlen + PES_EXT_SIZE;
      }
      this.remainder = Buffer.alloc(0, 0);
      this.emit('data', pes.payload);
      next(null, pes.payload);
    }
    next();
  }
}

class TSDemuxer extends Writable {
  constructor(demux) {
    super();
    this.remainder = Buffer.alloc(0, 0);
    this.pes = {
      video: {
        data: Buffer.alloc(0, 0),
        pipe: new PESStream('video')
      },
      audio: {
        data: Buffer.alloc(0, 0),
        pipe: new PESStream('audio')
      }
    };
    if (demux && demux.video) {
      this.pes.video.pipe.pipe(demux.video);
    }
    if (demux && demux.audio) {
      this.pes.audio.pipe.pipe(demux.audio);
    }
  }

  _write(data, encoding, next) {
    const chunk = Buffer.concat([this.remainder, data]);
    const len = chunk.length;
    let pos = 0;
    let offset;

    while (pos <= (len - PACKET_SIZE)) {
      //debug(`pos=${pos}, len=${len}`);
      let packet = new Packet();
      if (chunk[pos] === SYNC_BYTE) {
        // Yes we have a valid packet
        packet.sync = chunk[pos];

        packet.pusi = !!(chunk[pos + 1] & 0x40);
        
        // Get the packet identifier
        packet.pid = ((chunk[pos + 1] & 0x1f) << 8) + chunk[pos + 2];

        packet.atf = (chunk[pos + 3] & 0x30) >> 4;
        if (packet.atf > 1) {
          packet.atflen = chunk[pos + 4];
          packet.disc = !!(chunk[pos + 5] & 0x80);
          packet.pcr = !!(chunk[pos + 5] & 0x10);

          if (packet.pcr) {
            // TODO: Obtain the Program clock reference (stored as 33 bits base, 6 bits reserved, 9 bits extension)
            packet.pcrPayload = new Uint8Array(6) // 48 bits
            packet.pcrPayload.set(chunk.subarray(pos + 6, pos + 6 + 6));
  
            packet.pcrBase = (packet.pcrPayload[0] & 0xFF) * 33554432 +// 1 << 25 (33-8)
              (packet.pcrPayload[1] & 0xFF) * 131072 +// 1 << 17 (25-8)
              (packet.pcrPayload[2] & 0xFF) * 512 +// 1 << 9 (17-8)
              (packet.pcrPayload[3] & 0xFF) * 2 +// 1 << 1 (9-8)
              (packet.pcrPayload[4] & 0x80) / 128;
            // check if greater than 2^32 -1
            if (packet.pcrBase > 4294967295) {
              // decrement 2^33
              packet.pcrBase -= 8589934592;
            }
            packet.pcrExt = (packet.pcrPayload[4] & 0x01) * 256 + // 1 << 8
              (packet.pcrPayload[5] & 0xFF);
            packet.pcrValue = packet.pcrBase * 300 + packet.pcrExt;
          }

          offset = pos + 5 + packet.atflen;
          if (offset === (pos + PACKET_SIZE)) {
            pos += PACKET_SIZE;
            continue;
          }
        } else {
          offset = pos + 4;
        }

        if (this.pat && this.pat.pmtId && packet.pid === this.pat.pmtId) {
          if (packet.pusi) {
            offset += chunk[offset] + 1;
  
            // Parse PMT
            this.pmt = this._parsePMT(chunk, offset);
            debug(this.pmt);
          }
        } else if (this.pmt && packet.pid >= 32 && packet.pid <= 8186) {
          let stream;
          if (packet.pid === this.pmt.avc) {
            stream = this.pes.video;
          } else if (packet.pid === this.pmt.aac) {
            stream = this.pes.audio;
          } else {
            debug(`WARN: Ignoring PID ${packet.pid}`);
          }

          if (stream) {
            if (packet.pusi) {
              if (stream.data.length > 0) {
                stream.pipe.push(stream.data);
                stream.data = Buffer.alloc(0, 0);
              }
            }
            stream.data = Buffer.concat([stream.data, chunk.subarray(offset, pos + PACKET_SIZE)]);
          }
        } else {
          switch (packet.pid) {
            case PAT_ID:
              if (packet.pusi) {
                offset += chunk[offset] + 1;
              }
              this.pat = this._parsePAT(chunk, offset);
              break;
          }
        }
      } else {
        debug("Not a TS packet, ignoring");
      }
      pos += PACKET_SIZE;
    }
    this.remainder = chunk.slice(pos, len);
    next();
  }

  _parsePMT(chunk, offset) {
    const pmt = {
      avc: -1,
      hevc: -1,
      aac: -1,
      id3: -1,
      scte35: -1,
    };
    
    const sectionLength = (chunk[offset + 1] & 0x0f) << 8 | chunk[offset + 2];
    const tableEnd = offset + 3 + sectionLength - 4;
    const programInfoLength = (chunk[offset + 10] & 0x0f) << 8 | chunk[offset + 11];
    offset += 12 + programInfoLength;
    
    while (offset < tableEnd) { 
      const pid = (chunk[offset + 1] & 0x1F) << 8 | chunk[offset + 2];
      const type = chunk[offset];
      switch (type) {
        case PID_AAC: 
          if (pmt.aac === -1) {
            pmt.aac = pid;
          }
          break;
        case PID_AVC: 
          if (pmt.avc === -1) {
            pmt.avc = pid;
          }
          break;
        case PID_HEVC: 
          if (pmt.hevc === -1) {
            pmt.hevc = pid;
          }
          break;
        case PID_ID3: 
          if (pmt.id3 === -1) {
            pmt.id3 = pid;
          }
          break;
        case PID_SCTE35: 
          if (pmt.scte35 === -1) {
            pmt.scte35 = pid;
          }
          break;
        default:
          debug(`Unknown stream type ${type}`);
          break;
      }
      offset += ((chunk[offset + 3] & 0x0F) << 8 | chunk[offset + 4]) + 5;
    }
    
    return pmt;
  }

  _parsePAT(chunk, offset) {
    const pat = {};
  
    pat.pmtId = (chunk[offset + 10] & 0x1F) << 8 | chunk[offset + 11];
  
    return pat;
  }
  
}

module.exports = {
  TSDemuxer
};