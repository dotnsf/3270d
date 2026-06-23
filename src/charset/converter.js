/**
 * Character Set Converter
 * 文字コード変換（EBCDIC ↔ UTF-8）
 */
const iconv = require('iconv-lite');

// EBCDICエンコーディングのサポートを有効化
const encodings = require('iconv-lite/encodings');
iconv.encodings = encodings;

const logger = require('../logger');
const config = require('../config');
const japaneseHandler = require('./japanese-handler');

class CharsetConverter {
  /**
   * @param {string} codePage - コードページ（デフォルト: cp037）
   */
  constructor(codePage = null) {
    this.codePage = codePage || config.get('terminal.codePage') || 'cp037';
    this.japaneseCodePage = config.get('terminal.japaneseCodePage') || 'cp939';
    this.cache = new Map();
    this.maxCacheSize = 1000;
    this.japaneseHandler = japaneseHandler;
  }

  /**
   * EBCDIC → UTF-8
   * @param {Buffer} ebcdic - EBCDICバイト列
   * @returns {string} - UTF-8文字列
   */
  ebcdicToUtf8(ebcdic) {
    if (!ebcdic || ebcdic.length === 0) {
      return '';
    }

    try {
      // キャッシュをチェック
      const cacheKey = `e2u:${ebcdic.toString('hex')}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // 変換
      const result = iconv.decode(ebcdic, this.codePage);

      // キャッシュに保存
      this.addToCache(cacheKey, result);

      return result;
    } catch (error) {
      logger.warn('EBCDIC to UTF-8 conversion error:', error);
      // エラー時は置換文字を使用
      return '?'.repeat(ebcdic.length);
    }
  }

  /**
   * UTF-8 → EBCDIC
   * @param {string} utf8 - UTF-8文字列
   * @returns {Buffer} - EBCDICバイト列
   */
  utf8ToEbcdic(utf8) {
    if (!utf8 || utf8.length === 0) {
      return Buffer.alloc(0);
    }

    try {
      // キャッシュをチェック
      const cacheKey = `u2e:${utf8}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // 日本語文字が含まれているかチェック
      const codePage = this.containsJapanese(utf8) ? this.japaneseCodePage : this.codePage;

      // 変換
      const result = iconv.encode(utf8, codePage);

      // キャッシュに保存
      this.addToCache(cacheKey, result);

      return result;
    } catch (error) {
      logger.warn('UTF-8 to EBCDIC conversion error:', error);
      // エラー時は'?'に置換
      return iconv.encode('?'.repeat(utf8.length), this.codePage);
    }
  }

  /**
   * 日本語文字が含まれているかチェック
   * @param {string} text - テキスト
   * @returns {boolean}
   */
  containsJapanese(text) {
    // ひらがな、カタカナ、漢字の範囲
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
  }

  /**
   * 文字幅を取得
   * @param {string} char - 文字
   * @returns {number} - 1 (半角) or 2 (全角)
   */
  getCharWidth(char) {
    return this.japaneseHandler.getCharWidth(char);
  }

  /**
   * 文字列の表示幅を計算
   * @param {string} text - テキスト
   * @returns {number} - 表示幅
   */
  getDisplayWidth(text) {
    return this.japaneseHandler.getDisplayWidth(text);
  }

  /**
   * 指定幅で文字列を切り詰め
   * @param {string} text - テキスト
   * @param {number} maxWidth - 最大幅
   * @returns {string} - 切り詰められたテキスト
   */
  truncate(text, maxWidth) {
    return this.japaneseHandler.truncate(text, maxWidth).text;
  }

  /**
   * 指定幅で文字列を折り返し
   * @param {string} text - テキスト
   * @param {number} width - 幅
   * @returns {Array<string>} - 行のリスト
   */
  wrapText(text, width) {
    return this.japaneseHandler.wrapText(text, width);
  }

  /**
   * 指定幅にテキストをパディング
   * @param {string} text - テキスト
   * @param {number} width - 目標幅
   * @param {string} align - 配置（'left', 'right', 'center'）
   * @returns {string} - パディングされたテキスト
   */
  pad(text, width, align = 'left') {
    return this.japaneseHandler.pad(text, width, align);
  }

  /**
   * コードページを変更
   * @param {string} codePage - 新しいコードページ
   */
  setCodePage(codePage) {
    this.codePage = codePage;
    this.clearCache();
    logger.info(`Code page changed to: ${codePage}`);
  }

  /**
   * 日本語コードページを変更
   * @param {string} codePage - 新しいコードページ
   */
  setJapaneseCodePage(codePage) {
    this.japaneseCodePage = codePage;
    this.clearCache();
    logger.info(`Japanese code page changed to: ${codePage}`);
  }

  /**
   * キャッシュに追加
   * @param {string} key - キー
   * @param {any} value - 値
   */
  addToCache(key, value) {
    // LRU: 最大サイズを超えたら古いエントリを削除
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.cache.clear();
    logger.debug('Conversion cache cleared');
  }

  /**
   * キャッシュサイズを取得
   * @returns {number}
   */
  getCacheSize() {
    return this.cache.size;
  }

  /**
   * キャッシュ統計を取得
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
   * ASCIIかどうかをチェック
   * @param {string} text - テキスト
   * @returns {boolean}
   */
  isAscii(text) {
    return /^[\x00-\x7F]*$/.test(text);
  }

  /**
   * 制御文字を除去
   * @param {string} text - テキスト
   * @returns {string}
   */
  removeControlChars(text) {
    return text.replace(/[\x00-\x1F\x7F]/g, '');
  }

  /**
   * 印字可能文字のみを残す
   * @param {string} text - テキスト
   * @returns {string}
   */
  getPrintableChars(text) {
    return text.replace(/[^\x20-\x7E\u3000-\u9FFF\uFF00-\uFFEF]/g, '');
  }
}

module.exports = CharsetConverter;

// Made with Bob
