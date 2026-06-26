/**
 * 日本語処理ハンドラー
 * 
 * 3270端末での日本語表示に特化した処理を提供します。
 * DBCS（Double Byte Character Set）のサポート、
 * 全角文字の適切な配置、文字境界の処理などを行います。
 */

const logger = require('../logger');

/**
 * JapaneseHandlerクラス
 * 
 * 日本語テキストの3270端末での表示を管理します。
 */
class JapaneseHandler {
  constructor() {
    // DBCS文字範囲
    this.dbcsRanges = [
      { start: 0x3000, end: 0x303F, name: 'CJK Symbols and Punctuation' },
      { start: 0x3040, end: 0x309F, name: 'Hiragana' },
      { start: 0x30A0, end: 0x30FF, name: 'Katakana' },
      { start: 0x3100, end: 0x312F, name: 'Bopomofo' },
      { start: 0x3130, end: 0x318F, name: 'Hangul Compatibility Jamo' },
      { start: 0x3190, end: 0x319F, name: 'Kanbun' },
      { start: 0x31A0, end: 0x31BF, name: 'Bopomofo Extended' },
      { start: 0x31C0, end: 0x31EF, name: 'CJK Strokes' },
      { start: 0x31F0, end: 0x31FF, name: 'Katakana Phonetic Extensions' },
      { start: 0x3200, end: 0x32FF, name: 'Enclosed CJK Letters and Months' },
      { start: 0x3300, end: 0x33FF, name: 'CJK Compatibility' },
      { start: 0x3400, end: 0x4DBF, name: 'CJK Unified Ideographs Extension A' },
      { start: 0x4DC0, end: 0x4DFF, name: 'Yijing Hexagram Symbols' },
      { start: 0x4E00, end: 0x9FFF, name: 'CJK Unified Ideographs' },
      { start: 0xF900, end: 0xFAFF, name: 'CJK Compatibility Ideographs' },
      { start: 0xFF00, end: 0xFFEF, name: 'Halfwidth and Fullwidth Forms' }
    ];
  }

  /**
   * 文字がDBCS（全角）かどうかを判定
   * 
   * @param {string} char - 文字
   * @returns {boolean} DBCSの場合true
   */
  isDBCS(char) {
    if (!char || char.length === 0) {
      return false;
    }

    const code = char.charCodeAt(0);

    // DBCS範囲をチェック
    for (const range of this.dbcsRanges) {
      if (code >= range.start && code <= range.end) {
        return true;
      }
    }

    return false;
  }

  /**
   * 文字幅を取得（3270端末用）
   * 
   * @param {string} char - 文字
   * @returns {number} 文字幅（1または2）
   */
  getCharWidth(char) {
    if (!char || char.length === 0) {
      return 0;
    }

    // サロゲートペアの処理
    if (char.length > 1) {
      const code = char.codePointAt(0);
      // サロゲートペア範囲（絵文字など）
      if (code > 0xFFFF) {
        return 2;
      }
    }

    return this.isDBCS(char) ? 2 : 1;
  }

  /**
   * テキストの表示幅を計算
   * 
   * @param {string} text - テキスト
   * @returns {number} 表示幅
   */
  getDisplayWidth(text) {
    let width = 0;
    
    // サロゲートペアを考慮した文字列イテレーション
    for (const char of text) {
      width += this.getCharWidth(char);
    }

    return width;
  }

  /**
   * 指定幅でテキストを切り詰め
   * 
   * 全角文字の途中で切れないように調整します。
   * 
   * @param {string} text - テキスト
   * @param {number} maxWidth - 最大幅
   * @returns {Object} 結果
   * @returns {string} result.text - 切り詰められたテキスト
   * @returns {number} result.width - 実際の幅
   */
  truncate(text, maxWidth) {
    let width = 0;
    let result = '';

    for (const char of text) {
      const charWidth = this.getCharWidth(char);
      
      if (width + charWidth > maxWidth) {
        // 全角文字が入らない場合はそこで終了（パディングしない）
        break;
      }

      result += char;
      width += charWidth;
    }

    return { text: result, width };
  }

  /**
   * 指定幅にテキストをパディング
   * 
   * @param {string} text - テキスト
   * @param {number} width - 目標幅
   * @param {string} align - 配置（'left', 'right', 'center'）
   * @returns {string} パディングされたテキスト
   */
  pad(text, width, align = 'left') {
    const displayWidth = this.getDisplayWidth(text);

    if (displayWidth >= width) {
      return this.truncate(text, width).text;
    }

    const padding = width - displayWidth;

    switch (align) {
      case 'right':
        return ' '.repeat(padding) + text;
      
      case 'center':
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
      
      case 'left':
      default:
        return text + ' '.repeat(padding);
    }
  }

  /**
   * テキストを指定幅で折り返し
   * 
   * 全角文字の途中で折り返さないように調整します。
   * 
   * @param {string} text - テキスト
   * @param {number} width - 幅
   * @returns {Array<string>} 行のリスト
   */
  wrapText(text, width) {
    const lines = [];
    let currentLine = '';
    let currentWidth = 0;

    // 改行で分割
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      currentLine = '';
      currentWidth = 0;

      for (const char of paragraph) {
        const charWidth = this.getCharWidth(char);

        if (currentWidth + charWidth > width) {
          // 現在の行を保存
          lines.push(currentLine);
          
          // 新しい行を開始
          currentLine = char;
          currentWidth = charWidth;
        } else {
          currentLine += char;
          currentWidth += charWidth;
        }
      }

      // 残りの行を追加
      if (currentLine.length > 0 || paragraph.length === 0) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  /**
   * 文字列を指定位置で分割
   * 
   * 全角文字の途中で分割しないように調整します。
   * 
   * @param {string} text - テキスト
   * @param {number} position - 分割位置（表示幅）
   * @returns {Object} 結果
   * @returns {string} result.before - 前半
   * @returns {string} result.after - 後半
   * @returns {number} result.actualPosition - 実際の分割位置
   */
  splitAt(text, position) {
    let width = 0;
    let index = 0;

    for (const char of text) {
      const charWidth = this.getCharWidth(char);

      if (width + charWidth > position) {
        break;
      }

      width += charWidth;
      index += char.length; // サロゲートペア対応
    }

    return {
      before: text.substring(0, index),
      after: text.substring(index),
      actualPosition: width
    };
  }

  /**
   * 文字境界を検証
   * 
   * 指定位置が文字の途中でないことを確認します。
   * 
   * @param {string} text - テキスト
   * @param {number} position - 位置（表示幅）
   * @returns {boolean} 有効な境界の場合true
   */
  isValidBoundary(text, position) {
    let width = 0;

    for (const char of text) {
      if (width === position) {
        return true;
      }

      const charWidth = this.getCharWidth(char);
      width += charWidth;

      if (width > position) {
        return false;
      }
    }

    return width === position;
  }

  /**
   * 最も近い有効な境界を取得
   * 
   * @param {string} text - テキスト
   * @param {number} position - 位置（表示幅）
   * @param {string} direction - 方向（'before' または 'after'）
   * @returns {number} 有効な境界位置
   */
  getNearestBoundary(text, position, direction = 'before') {
    let width = 0;
    let lastValidWidth = 0;

    for (const char of text) {
      if (width >= position) {
        return direction === 'before' ? lastValidWidth : width;
      }

      lastValidWidth = width;
      width += this.getCharWidth(char);
    }

    return width;
  }

  /**
   * 日本語文字が含まれているかチェック
   * 
   * @param {string} text - テキスト
   * @returns {boolean} 日本語文字が含まれている場合true
   */
  containsJapanese(text) {
    for (const char of text) {
      if (this.isDBCS(char)) {
        const code = char.charCodeAt(0);
        // ひらがな、カタカナ、漢字の範囲
        if ((code >= 0x3040 && code <= 0x309F) ||  // ひらがな
            (code >= 0x30A0 && code <= 0x30FF) ||  // カタカナ
            (code >= 0x4E00 && code <= 0x9FFF)) {  // 漢字
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 文字種別を取得
   * 
   * @param {string} char - 文字
   * @returns {string} 文字種別（'hiragana', 'katakana', 'kanji', 'ascii', 'other'）
   */
  getCharType(char) {
    if (!char || char.length === 0) {
      return 'other';
    }

    const code = char.charCodeAt(0);

    if (code >= 0x3040 && code <= 0x309F) {
      return 'hiragana';
    } else if (code >= 0x30A0 && code <= 0x30FF) {
      return 'katakana';
    } else if (code >= 0x4E00 && code <= 0x9FFF) {
      return 'kanji';
    } else if (code >= 0x20 && code <= 0x7E) {
      return 'ascii';
    } else {
      return 'other';
    }
  }

  /**
   * テキストの統計情報を取得
   * 
   * @param {string} text - テキスト
   * @returns {Object} 統計情報
   */
  getTextStats(text) {
    const stats = {
      length: 0,
      displayWidth: 0,
      hiragana: 0,
      katakana: 0,
      kanji: 0,
      ascii: 0,
      other: 0,
      dbcs: 0,
      sbcs: 0
    };

    for (const char of text) {
      stats.length++;
      
      const width = this.getCharWidth(char);
      stats.displayWidth += width;

      if (width === 2) {
        stats.dbcs++;
      } else {
        stats.sbcs++;
      }

      const type = this.getCharType(char);
      stats[type]++;
    }

    return stats;
  }
}

// シングルトンインスタンスをエクスポート
module.exports = new JapaneseHandler();

// Made with Bob
