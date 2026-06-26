/**
 * 3270 Field Attribute
 * 3270フィールド属性のエンコード/デコード
 */

class FieldAttribute {
  /**
   * 属性オブジェクトをバイトにエンコード
   * 
   * Bit 7-6: Protection
   *   00 = Unprotected, alphanumeric
   *   01 = Unprotected, numeric only
   *   10 = Protected, skip
   *   11 = Protected, skip, numeric
   * 
   * Bit 5-4: Display
   *   00 = Normal, non-detectable
   *   01 = Normal, detectable
   *   10 = Intensified, non-detectable
   *   11 = Non-display (hidden)
   * 
   * Bit 3: Reserved (0)
   * 
   * Bit 2: MDT (Modified Data Tag)
   *   0 = Not modified
   *   1 = Modified
   * 
   * Bit 1-0: Reserved (00)
   * 
   * @param {Object} attr - 属性オブジェクト
   * @returns {number} - 属性バイト
   */
  static encode(attr) {
    let byte = 0;

    // Protection (bits 7-6)
    if (attr.protected) {
      byte |= 0x20;  // Protected
      if (attr.numeric) {
        byte |= 0x10;  // Numeric
      }
    } else if (attr.numeric) {
      byte |= 0x10;  // Unprotected, numeric
    }

    // Display (bits 5-4)
    if (attr.hidden) {
      byte |= 0x0C;  // Non-display
    } else if (attr.intensified) {
      byte |= 0x08;  // Intensified
    } else if (attr.detectable) {
      byte |= 0x04;  // Detectable
    }

    // MDT (bit 2)
    if (attr.modified) {
      byte |= 0x01;
    }

    return byte;
  }

  /**
   * バイトを属性オブジェクトにデコード
   * @param {number} byte - 属性バイト
   * @returns {Object} - 属性オブジェクト
   */
  static decode(byte) {
    return {
      protected: (byte & 0x20) !== 0,
      numeric: (byte & 0x10) !== 0,
      hidden: (byte & 0x0C) === 0x0C,
      intensified: (byte & 0x08) !== 0,
      detectable: (byte & 0x04) !== 0,
      modified: (byte & 0x01) !== 0
    };
  }

  /**
   * デフォルト属性を取得
   * @returns {Object}
   */
  static getDefault() {
    return {
      protected: false,
      numeric: false,
      hidden: false,
      intensified: false,
      detectable: false,
      modified: false
    };
  }

  /**
   * 保護フィールド属性を取得
   * @returns {Object}
   */
  static getProtected() {
    return {
      protected: true,
      numeric: false,
      hidden: false,
      intensified: false,
      detectable: false,
      modified: false
    };
  }

  /**
   * 入力フィールド属性を取得
   * @returns {Object}
   */
  static getInput() {
    return {
      protected: false,
      numeric: false,
      hidden: false,
      intensified: false,
      detectable: false,
      modified: false
    };
  }

  /**
   * 非表示フィールド属性を取得（パスワード用）
   * @returns {Object}
   */
  static getHidden() {
    return {
      protected: false,
      numeric: false,
      hidden: true,
      intensified: false,
      detectable: false,
      modified: false
    };
  }

  /**
   * 高輝度フィールド属性を取得
   * @returns {Object}
   */
  static getIntensified() {
    return {
      protected: true,
      numeric: false,
      hidden: false,
      intensified: true,
      detectable: false,
      modified: false
    };
  }

  /**
   * 数値入力フィールド属性を取得
   * @returns {Object}
   */
  static getNumeric() {
    return {
      protected: false,
      numeric: true,
      hidden: false,
      intensified: false,
      detectable: false,
      modified: false
    };
  }

  /**
   * 属性が等しいかチェック
   * @param {Object} attr1 - 属性1
   * @param {Object} attr2 - 属性2
   * @returns {boolean}
   */
  static equals(attr1, attr2) {
    return attr1.protected === attr2.protected &&
           attr1.numeric === attr2.numeric &&
           attr1.hidden === attr2.hidden &&
           attr1.intensified === attr2.intensified &&
           attr1.detectable === attr2.detectable &&
           attr1.modified === attr2.modified;
  }

  /**
   * 属性をコピー
   * @param {Object} attr - 属性
   * @returns {Object} - コピーされた属性
   */
  static copy(attr) {
    return {
      protected: attr.protected,
      numeric: attr.numeric,
      hidden: attr.hidden,
      intensified: attr.intensified,
      detectable: attr.detectable,
      modified: attr.modified
    };
  }

  /**
   * 属性を文字列に変換（デバッグ用）
   * @param {Object} attr - 属性
   * @returns {string}
   */
  static toString(attr) {
    const parts = [];
    if (attr.protected) parts.push('Protected');
    if (attr.numeric) parts.push('Numeric');
    if (attr.hidden) parts.push('Hidden');
    if (attr.intensified) parts.push('Intensified');
    if (attr.detectable) parts.push('Detectable');
    if (attr.modified) parts.push('Modified');
    return parts.length > 0 ? parts.join(', ') : 'Normal';
  }
}

module.exports = FieldAttribute;
