/*
Include CryptoJS via CDN in your HTML:
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
*/

class QRGenerator {
  static B32TABLE = 'GN5BH8QJSAC0MFR6P4VET1O7K9U2LD3I';
  static IN_TABLE = '0123456789abcdefghijklmnopqrstuv';

  get typeLen() { throw new Error('typeLen not implemented'); }
  get varLen()  { throw new Error('varLen not implemented'); }
  get keys()    { throw new Error('keys not implemented'); }

  // Convert CryptoJS WordArray to Uint8Array
  static wordArrayToU8(wa) {
    const len = wa.sigBytes;
    const words = wa.words;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return u8;
  }

  // Convert Uint8Array to CryptoJS WordArray
  static u8ToWordArray(u8arr) {
    const words = [];
    for (let i = 0; i < u8arr.length; i++) {
      words[i >>> 2] |= u8arr[i] << (24 - (i % 4) * 8);
    }
    return CryptoJS.lib.WordArray.create(words, u8arr.length);
  }

  static modB32Encode(bytes) {
    // bytes: Uint8Array of hex values? Actually we need hex string of digest
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    // build inBuf: each hex char -> 4-bit value
    const inBuf = Array.from(hex).map(ch => {
      const idx = QRGenerator.IN_TABLE.indexOf(ch);
      if (idx < 0) throw new Error(`Invalid hex char: ${ch}`);
      return idx;
    });

    const out = [];
    let bitPos = 0, bufPos = 0;
    const OUT_BIT = 5, IN_BIT = 4;

    while (bufPos < inBuf.length) {
      let a = inBuf[bufPos] << (32 - IN_BIT);
      if (bufPos + 1 < inBuf.length) {
        a |= inBuf[bufPos + 1] << (32 - 2 * IN_BIT);
      }
      a >>>= (32 - OUT_BIT - bitPos);
      a &= (1 << OUT_BIT) - 1;
      if (bufPos + 1 >= inBuf.length) {
        a >>>= 2;
      }
      out.push(QRGenerator.B32TABLE[a]);
      bitPos += OUT_BIT;
      while (bitPos >= IN_BIT) {
        bitPos -= IN_BIT;
        bufPos++;
      }
    }
    return out.join('');
  }

  calcHash(codeU8) {
    let codeWA = QRGenerator.u8ToWordArray(codeU8);
    let lastDigestBytes;
    for (const key of this.keys) {
      const keyWA = CryptoJS.enc.Latin1.parse(key);
      const hmacWA = CryptoJS.HmacMD5(codeWA, keyWA);
      lastDigestBytes = QRGenerator.wordArrayToU8(hmacWA);
      // next round code = hex digest lowercase bytes
      const hex = hmacWA.toString(CryptoJS.enc.Hex).toLowerCase();
      codeWA = CryptoJS.enc.Latin1.parse(hex);
    }
    return QRGenerator.modB32Encode(lastDigestBytes);
  }

  gen(pattern) {
    if (pattern.length !== this.typeLen + this.varLen) {
      throw new Error(`Pattern must be ${this.typeLen + this.varLen} characters long`);
    }
    if (!/^[0-9a-zA-Z]+$/.test(pattern)) {
      throw new Error('Pattern can only contain alphanumeric characters');
    }
    const up = pattern.toUpperCase();
    const codeU8 = new TextEncoder().encode(up);
    const hash = this.calcHash(codeU8);
    return up + hash;
  }
}

class V1QRGenerator extends QRGenerator {
  get typeLen() { return 2; }
  get varLen()  { return 4; }
  get keys()    { return ['A14+BDM71D', 'QK35+NI8WV']; }
}

class V2QRGenerator extends QRGenerator {
  get typeLen() { return 3; }
  get varLen()  { return 4; }
  get keys()    { return ['OYD78+MIP3', 'N+Q09V7LI5']; }
}

/**
 * Generates QR string with hash.
 * @param {string} pattern - alphanumeric, correct length for variant
 * @param {'v1'|'v2'} [variant='v2']
 * @returns {string}
 */
function generateQR(pattern, variant = 'auto') {
  if(pattern.length == "7") {variant = 'v2' } else {variant = 'v1'}
  console.log(variant)
  const gen = variant === 'v1' ? new V1QRGenerator() : new V2QRGenerator();
  return '/' + gen.gen(pattern);
}

