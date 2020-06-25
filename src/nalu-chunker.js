const { Transform } = require('stream');
const debug = require('debug')('nalu-chunker');

const NAL_START_PREFIX = 0x01;
const BYTE_STATE = {
  "0-7": 0,
  "8-15": 1,
  "16-23": 2,
  "24-31": 3,
};

const NAL_UNIT_TYPE = {
  0: "Unspecified",
  1: "Coded slice of a non-IDR picture",
  2: "Coded slice data partition A",
  3: "Coded slice data partition B",
  4: "Coded slice data partition C",
  5: "Coded slice of an IDR picture",
  6: "Supplemental enhancement information (SEI)",
  7: "Sequence parameter set",
  8: "Picture parameter set",
  9: "Access unit delimiter",
  10: "End of sequence",
  11: "End of stream",
  12: "Filler data",
  13: "Sequence parameter set extension",
  14: "Prefix NAL unit",
  15: "Subset sequence parameter set",
  16: "Depth parameter set",
  17: "Reserved",
  18: "Reserved",
  19: "Coded slice of an auxiliary coded picture without partitioning",
  20: "Coded slice extension",
  21: "Coded slice extension for depth view components",
  22: "Reserved",
  23: "Reserved",
  24: "Unspecified",
  28: "Unspecified",
  29: "Unspecified",
};

class NaluChunker extends Transform {
  constructor() {
    super();
    this.remainder = Buffer.alloc(0, 0);
    this.unitStartPos = -1;
    this.state =  BYTE_STATE["0-7"];
  }

  _transform(data, encoding, next) {
    const allData = Buffer.concat([this.remainder, data]);
    const len = allData.length;
    let pos = 0;

    //debug(`New chunk (${this.remainder.length}, ${data.length})`);

    let byte;
    let unitType;
    while(pos < len) {
      byte = allData[pos++];
      if (this.state === BYTE_STATE["0-7"]) {
        this.state = byte ? BYTE_STATE["0-7"] : BYTE_STATE["8-15"];
        continue;
      }
      if (this.state === BYTE_STATE["8-15"]) {
        this.state = byte ? BYTE_STATE["0-7"] : BYTE_STATE["16-23"];
        continue; 
      }
      if (this.state === BYTE_STATE["16-23"] || this.state === BYTE_STATE["24-31"]) {
        if (byte === 0) {
          this.state = BYTE_STATE["24-31"];
        } else if (byte === NAL_START_PREFIX) {
          debug(`Start Prefix at ${pos} unitStartPos=${this.unitStartPos}`);
          if (this.unitStartPos >= 0) {
            debug(`NAL unit ${NAL_UNIT_TYPE[unitType]} starting at ${this.unitStartPos} and ends at ${pos - this.state - 1}`);
            const nalu = allData.slice(this.unitStartPos, pos - this.state - 1);
            this.emit('nalu', new Uint8Array(nalu));
          }
          unitType = allData[pos] & 0x1f;
          this.unitStartPos = pos;
        } else {
          this.state = BYTE_STATE["0-7"];
        }
      }
    }
    if (this.unitStartPos >= 0) {
      // Parts of a NAL unit remains
      this.remainder = allData.slice(this.unitStartPos, len);
      this.unitStartPos = 0;
    }
    next();
  }
}

module.exports = NaluChunker;