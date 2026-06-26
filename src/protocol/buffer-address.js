/**
 * 3270 Buffer Address
 * 3270バッファアドレスのエンコード/デコード
 */

class BufferAddress {
  /**
   * 行列座標をバッファアドレスに変換
   * @param {number} row - 行 (0-23)
   * @param {number} col - 列 (0-79)
   * @returns {number} - バッファアドレス (0-1919)
   */
  static fromRowCol(row, col) {
    if (row < 0 || row >= 24 || col < 0 || col >= 80) {
      throw new Error(`Invalid row/col: (${row}, ${col})`);
    }
    return row * 80 + col;
  }

  /**
   * バッファアドレスを行列座標に変換
   * @param {number} addr - バッファアドレス (0-1919)
   * @returns {Object} - {row, col}
   */
  static toRowCol(addr) {
    if (addr < 0 || addr >= 1920) {
      throw new Error(`Invalid buffer address: ${addr}`);
    }
    return {
      row: Math.floor(addr / 80),
      col: addr % 80
    };
  }

  /**
   * バッファアドレスを2バイトにエンコード
   * 3270は14ビットアドレスを2バイトで表現
   * 各バイトは6ビット（0x40-0x7F）
   * @param {number} addr - バッファアドレス (0-1919)
   * @returns {Array<number>} - 2バイトの配列
   */
  static encode(addr) {
    if (addr < 0 || addr >= 1920) {
      throw new Error(`Invalid buffer address: ${addr}`);
    }
    const high = ((addr >> 6) & 0x3F) | 0x40;
    const low = (addr & 0x3F) | 0x40;
    return [high, low];
  }

  /**
   * 2バイトをバッファアドレスにデコード
   * @param {Buffer|Array<number>} buf - 2バイトのバッファ
   * @returns {number} - バッファアドレス (0-1919)
   */
  static decode(buf) {
    if (!buf || buf.length < 2) {
      throw new Error('Buffer must be at least 2 bytes');
    }
    const high = (buf[0] & 0x3F) << 6;
    const low = buf[1] & 0x3F;
    return high | low;
  }

  /**
   * アドレスが有効範囲内かチェック
   * @param {number} addr - バッファアドレス
   * @returns {boolean}
   */
  static isValid(addr) {
    return addr >= 0 && addr < 1920;
  }

  /**
   * 行列座標が有効範囲内かチェック
   * @param {number} row - 行
   * @param {number} col - 列
   * @returns {boolean}
   */
  static isValidRowCol(row, col) {
    return row >= 0 && row < 24 && col >= 0 && col < 80;
  }

  /**
   * 次のアドレスを取得（ラップアラウンド）
   * @param {number} addr - 現在のアドレス
   * @returns {number} - 次のアドレス
   */
  static next(addr) {
    return (addr + 1) % 1920;
  }

  /**
   * 前のアドレスを取得（ラップアラウンド）
   * @param {number} addr - 現在のアドレス
   * @returns {number} - 前のアドレス
   */
  static prev(addr) {
    return (addr - 1 + 1920) % 1920;
  }

  /**
   * 2つのアドレス間の距離を計算
   * @param {number} addr1 - アドレス1
   * @param {number} addr2 - アドレス2
   * @returns {number} - 距離
   */
  static distance(addr1, addr2) {
    if (addr2 >= addr1) {
      return addr2 - addr1;
    } else {
      return 1920 - addr1 + addr2;
    }
  }
}

module.exports = BufferAddress;
