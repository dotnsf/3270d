/**
 * Character Set Converter
 * 譁・ｭ励さ繝ｼ繝牙､画鋤・・BCDIC 竊・UTF-8・・
 */
const logger = require('../logger');
const config = require('../config');
const japaneseHandler = require('./japanese-handler');

// EBCDIC CP037 竊・ASCII 螟画鋤繝・・繝悶Ν
const EBCDIC_TO_ASCII = [
  0x00, 0x01, 0x02, 0x03, 0x9C, 0x09, 0x86, 0x7F, 0x97, 0x8D, 0x8E, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
  0x10, 0x11, 0x12, 0x13, 0x9D, 0x85, 0x08, 0x87, 0x18, 0x19, 0x92, 0x8F, 0x1C, 0x1D, 0x1E, 0x1F,
  0x80, 0x81, 0x82, 0x83, 0x84, 0x0A, 0x17, 0x1B, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x05, 0x06, 0x07,
  0x90, 0x91, 0x16, 0x93, 0x94, 0x95, 0x96, 0x04, 0x98, 0x99, 0x9A, 0x9B, 0x14, 0x15, 0x9E, 0x1A,
  0x20, 0xA0, 0xE2, 0xE4, 0xE0, 0xE1, 0xE3, 0xE5, 0xE7, 0xF1, 0xA2, 0x2E, 0x3C, 0x28, 0x2B, 0x7C,
  0x26, 0xE9, 0xEA, 0xEB, 0xE8, 0xED, 0xEE, 0xEF, 0xEC, 0xDF, 0x21, 0x24, 0x2A, 0x29, 0x3B, 0xAC,
  0x2D, 0x2F, 0xC2, 0xC4, 0xC0, 0xC1, 0xC3, 0xC5, 0xC7, 0xD1, 0xA6, 0x2C, 0x25, 0x5F, 0x3E, 0x3F,
  0xF8, 0xC9, 0xCA, 0xCB, 0xC8, 0xCD, 0xCE, 0xCF, 0xCC, 0x60, 0x3A, 0x23, 0x40, 0x27, 0x3D, 0x22,
  0xD8, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0xAB, 0xBB, 0xF0, 0xFD, 0xFE, 0xB1,
  0xB0, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F, 0x70, 0x71, 0x72, 0xAA, 0xBA, 0xE6, 0xB8, 0xC6, 0xA4,
  0xB5, 0x7E, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0xA1, 0xBF, 0xD0, 0xDD, 0xDE, 0xAE,
  0x5E, 0xA3, 0xA5, 0xB7, 0xA9, 0xA7, 0xB6, 0xBC, 0xBD, 0xBE, 0x5B, 0x5D, 0xAF, 0xA8, 0xB4, 0xD7,
  0x7B, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0xAD, 0xF4, 0xF6, 0xF2, 0xF3, 0xF5,
  0x7D, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F, 0x50, 0x51, 0x52, 0xB9, 0xFB, 0xFC, 0xF9, 0xFA, 0xFF,
  0x5C, 0xF7, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0xB2, 0xD4, 0xD6, 0xD2, 0xD3, 0xD5,
  0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0xB3, 0xDB, 0xDC, 0xD9, 0xDA, 0x9F
];

// ASCII 竊・EBCDIC CP037 螟画鋤繝・・繝悶Ν
const ASCII_TO_EBCDIC = new Array(256);
for (let i = 0; i < 256; i++) {
  const asciiValue = EBCDIC_TO_ASCII[i];
  ASCII_TO_EBCDIC[asciiValue] = i;
}

class CharsetConverter {
  /**
   * @param {string} codePage - 繧ｳ繝ｼ繝峨・繝ｼ繧ｸ・医ョ繝輔か繝ｫ繝・ cp037・・
   */
  constructor(codePage = null) {
    this.codePage = codePage || config.get('terminal.codePage') || 'cp037';
    this.japaneseCodePage = config.get('terminal.japaneseCodePage') || 'cp939';
    this.cache = new Map();
    this.maxCacheSize = 1000;
    this.japaneseHandler = japaneseHandler;
  }

  /**
   * EBCDIC 竊・UTF-8
   * @param {Buffer} ebcdic - EBCDIC繝舌う繝亥・
   * @returns {string} - UTF-8譁・ｭ怜・
   */
  ebcdicToUtf8(ebcdic) {
    if (!ebcdic || ebcdic.length === 0) {
      return '';
    }

    try {
      // 繧ｭ繝｣繝・す繝･繧偵メ繧ｧ繝・け
      const cacheKey = `e2u:${ebcdic.toString('hex')}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // EBCDIC CP037 竊・ASCII 螟画鋤
      const ascii = Buffer.alloc(ebcdic.length);
      for (let i = 0; i < ebcdic.length; i++) {
        ascii[i] = EBCDIC_TO_ASCII[ebcdic[i]];
      }

      // ASCII 竊・UTF-8 (ASCII縺ｯUTF-8縺ｨ莠呈鋤諤ｧ縺後≠繧・
      const result = ascii.toString('utf8');

      // 繧ｭ繝｣繝・す繝･縺ｫ菫晏ｭ・
      this.addToCache(cacheKey, result);

      return result;
    } catch (error) {
      logger.warn('EBCDIC to UTF-8 conversion error:', error);
      // 繧ｨ繝ｩ繝ｼ譎ゅ・鄂ｮ謠帶枚蟄励ｒ菴ｿ逕ｨ
      return '?'.repeat(ebcdic.length);
    }
  }

  /**
   * UTF-8 竊・EBCDIC
   * @param {string} utf8 - UTF-8譁・ｭ怜・
   * @returns {Buffer} - EBCDIC繝舌う繝亥・
   */
  utf8ToEbcdic(utf8) {
    if (!utf8 || utf8.length === 0) {
      return Buffer.alloc(0);
    }

    try {
      // 繧ｭ繝｣繝・す繝･繧偵メ繧ｧ繝・け
      const cacheKey = `u2e:${utf8}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // 譌･譛ｬ隱樊枚蟄励′蜷ｫ縺ｾ繧後※縺・ｋ蝣ｴ蜷医・隴ｦ蜻・
      if (this.containsJapanese(utf8)) {
        logger.warn('Japanese characters detected in EBCDIC conversion, may not display correctly');
      }

      // UTF-8 竊・ASCII (蝓ｺ譛ｬ逧・↑ASCII譁・ｭ励・縺ｿ繧ｵ繝昴・繝・
      const ascii = Buffer.from(utf8, 'utf8');

      // ASCII 竊・EBCDIC CP037 螟画鋤
      const result = Buffer.alloc(ascii.length);
      for (let i = 0; i < ascii.length; i++) {
        const asciiValue = ascii[i];
        // ASCII遽・峇螟悶・譁・ｭ励・'?'(0x6F in EBCDIC)縺ｫ鄂ｮ謠・
        result[i] = ASCII_TO_EBCDIC[asciiValue] !== undefined ? ASCII_TO_EBCDIC[asciiValue] : 0x6F;
      }

      // 繧ｭ繝｣繝・す繝･縺ｫ菫晏ｭ・
      this.addToCache(cacheKey, result);

      return result;
    } catch (error) {
      logger.warn('UTF-8 to EBCDIC conversion error:', error);
      // 繧ｨ繝ｩ繝ｼ譎ゅ・'?'縺ｫ鄂ｮ謠・(0x6F in EBCDIC)
      return Buffer.alloc(utf8.length, 0x6F);
    }
  }

  /**
   * 譌･譛ｬ隱樊枚蟄励′蜷ｫ縺ｾ繧後※縺・ｋ縺九メ繧ｧ繝・け
   * @param {string} text - 繝・く繧ｹ繝・
   * @returns {boolean}
   */
  containsJapanese(text) {
    // 縺ｲ繧峨′縺ｪ縲√き繧ｿ繧ｫ繝翫∵ｼ｢蟄励・遽・峇
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
  }

  /**
   * 譁・ｭ怜ｹ・ｒ蜿門ｾ・
   * @param {string} char - 譁・ｭ・
   * @returns {number} - 1 (蜊願ｧ・ or 2 (蜈ｨ隗・
   */
  getCharWidth(char) {
    return this.japaneseHandler.getCharWidth(char);
  }

  /**
   * 譁・ｭ怜・縺ｮ陦ｨ遉ｺ蟷・ｒ險育ｮ・
   * @param {string} text - 繝・く繧ｹ繝・
   * @returns {number} - 陦ｨ遉ｺ蟷・
   */
  getDisplayWidth(text) {
    return this.japaneseHandler.getDisplayWidth(text);
  }

  /**
   * 謖・ｮ壼ｹ・〒譁・ｭ怜・繧貞・繧願ｩｰ繧・
   * @param {string} text - 繝・く繧ｹ繝・
   * @param {number} maxWidth - 譛螟ｧ蟷・
   * @returns {string} - 蛻・ｊ隧ｰ繧√ｉ繧後◆繝・く繧ｹ繝・
   */
  truncate(text, maxWidth) {
    return this.japaneseHandler.truncate(text, maxWidth).text;
  }

  /**
   * 謖・ｮ壼ｹ・〒譁・ｭ怜・繧呈釜繧願ｿ斐＠
   * @param {string} text - 繝・く繧ｹ繝・
   * @param {number} width - 蟷・
   * @returns {Array<string>} - 陦後・繝ｪ繧ｹ繝・
   */
  wrapText(text, width) {
    return this.japaneseHandler.wrapText(text, width);
  }

  /**
   * 謖・ｮ壼ｹ・↓繝・く繧ｹ繝医ｒ繝代ョ繧｣繝ｳ繧ｰ
   * @param {string} text - 繝・く繧ｹ繝・
   * @param {number} width - 逶ｮ讓吝ｹ・
   * @param {string} align - 驟咲ｽｮ・・left', 'right', 'center'・・
   * @returns {string} - 繝代ョ繧｣繝ｳ繧ｰ縺輔ｌ縺溘ユ繧ｭ繧ｹ繝・
   */
  pad(text, width, align = 'left') {
    return this.japaneseHandler.pad(text, width, align);
  }

  /**
   * 繧ｳ繝ｼ繝峨・繝ｼ繧ｸ繧貞､画峩
   * @param {string} codePage - 譁ｰ縺励＞繧ｳ繝ｼ繝峨・繝ｼ繧ｸ
   */
  setCodePage(codePage) {
    this.codePage = codePage;
    this.clearCache();
    logger.info(`Code page changed to: ${codePage}`);
  }

  /**
   * 譌･譛ｬ隱槭さ繝ｼ繝峨・繝ｼ繧ｸ繧貞､画峩
   * @param {string} codePage - 譁ｰ縺励＞繧ｳ繝ｼ繝峨・繝ｼ繧ｸ
   */
  setJapaneseCodePage(codePage) {
    this.japaneseCodePage = codePage;
    this.clearCache();
    logger.info(`Japanese code page changed to: ${codePage}`);
  }

  /**
   * 繧ｭ繝｣繝・す繝･縺ｫ霑ｽ蜉
   * @param {string} key - 繧ｭ繝ｼ
   * @param {any} value - 蛟､
   */
  addToCache(key, value) {
    // LRU: 譛螟ｧ繧ｵ繧､繧ｺ繧定ｶ・∴縺溘ｉ蜿､縺・お繝ｳ繝医Μ繧貞炎髯､
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  /**
   * 繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢
   */
  clearCache() {
    this.cache.clear();
    logger.debug('Conversion cache cleared');
  }

  /**
   * 繧ｭ繝｣繝・す繝･繧ｵ繧､繧ｺ繧貞叙蠕・
   * @returns {number}
   */
  getCacheSize() {
    return this.cache.size;
  }

  /**
   * 繧ｭ繝｣繝・す繝･邨ｱ險医ｒ蜿門ｾ・
   * @returns {Object}
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      usage: (this.cache.size / this.maxCacheSize * 100).toFixed(2) + '%'
    };
  }

  /**
   * ASCII縺九←縺・°繧偵メ繧ｧ繝・け
   * @param {string} text - 繝・く繧ｹ繝・
   * @returns {boolean}
   */
  isAscii(text) {
    return /^[\x00-\x7F]*$/.test(text);
  }

  /**
   * 蛻ｶ蠕｡譁・ｭ励ｒ髯､蜴ｻ
   * @param {string} text - 繝・く繧ｹ繝・
   * @returns {string}
   */
  removeControlChars(text) {
    return text.replace(/[\x00-\x1F\x7F]/g, '');
  }

  /**
   * 蜊ｰ蟄怜庄閭ｽ譁・ｭ励・縺ｿ繧呈ｮ九☆
   * @param {string} text - 繝・く繧ｹ繝・
   * @returns {string}
   */
  getPrintableChars(text) {
    return text.replace(/[^\x20-\x7E\u3000-\u9FFF\uFF00-\uFFEF]/g, '');
  }
}

module.exports = CharsetConverter;

