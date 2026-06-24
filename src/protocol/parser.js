/**
 * 3270 Data Stream Parser
 * 3270データストリームの解析
 */
const { Orders, AID, isOrder } = require('./data-stream');
const BufferAddress = require('./buffer-address');
const FieldAttribute = require('./field-attribute');
const Converter = require('../charset/converter');
const logger = require('../logger');

class DataStreamParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.converter = new Converter();
  }

  /**
   * データストリームを解析
   * @param {Buffer} data - 3270データストリーム
   * @returns {Object} - 解析結果
   */
  parse(data) {
    let offset = 0;

    // AID (Attention Identifier)
    if (offset >= data.length) {
      throw new Error('Invalid data stream: no AID');
    }
    const aid = data[offset++];

    // Cursor Position (2 bytes)
    let cursor = null;
    if (offset + 1 < data.length) {
      try {
        const cursorAddr = BufferAddress.decode(data.slice(offset, offset + 2));
        cursor = BufferAddress.toRowCol(cursorAddr);
        offset += 2;
      } catch (error) {
        logger.warn('Failed to decode cursor position:', error);
        cursor = { row: 0, col: 0 };
        offset += 2;
      }
    }

    // Fields
    const fields = [];

    while (offset < data.length) {
      const byte = data[offset];

      // Telnet IAC (0xFF) で終了
      if (byte === 0xFF) {
        break;
      }

      if (byte === Orders.SBA) {
        // Set Buffer Address
        offset++;
        if (offset + 1 < data.length) {
          try {
            const addr = BufferAddress.decode(data.slice(offset, offset + 2));
            offset += 2;

            // フィールドデータを読み取り
            const fieldData = [];
            while (offset < data.length &&
                   data[offset] !== Orders.SF &&
                   data[offset] !== Orders.SBA &&
                   data[offset] !== 0xFF) {
              fieldData.push(data[offset++]);
            }

            if (fieldData.length > 0) {
              const dataBuffer = Buffer.from(fieldData);
              fields.push({
                address: addr,
                position: BufferAddress.toRowCol(addr),
                data: dataBuffer,
                // TN3270ではASCIIで送信されることが多い
                value: dataBuffer.toString('utf8')
              });
            }
          } catch (error) {
            logger.warn('Failed to decode SBA address:', error);
            offset += 2;
          }
        }
      } else if (byte === Orders.SF) {
        // Start Field - 属性バイトをスキップ
        offset++;
        if (offset < data.length) {
          const attrByte = data[offset++];
          try {
            const attr = FieldAttribute.decode(attrByte);
            logger.debug('Field attribute:', FieldAttribute.toString(attr));
          } catch (error) {
            logger.warn('Failed to decode field attribute:', error);
          }
        }
      } else if (isOrder(byte)) {
        // その他のオーダー
        offset++;
        logger.debug(`Skipping order: 0x${byte.toString(16)}`);
      } else {
        // 通常のデータ（オーダーなし）
        const fieldData = [];
        while (offset < data.length &&
               !isOrder(data[offset]) &&
               data[offset] !== 0xFF) {
          fieldData.push(data[offset++]);
        }

        if (fieldData.length > 0) {
          const dataBuffer = Buffer.from(fieldData);
          fields.push({
            address: null,
            position: null,
            data: dataBuffer,
            value: this.converter.ebcdicToUtf8(dataBuffer)
          });
        }
      }
    }

    return {
      aid,
      cursor,
      fields
    };
  }

  /**
   * Read Modified応答を解析
   * @param {Buffer} data - Read Modified応答データ
   * @returns {Object} - 解析結果
   */
  parseReadModified(data) {
    return this.parse(data);
  }

  /**
   * Read Buffer応答を解析
   * @param {Buffer} data - Read Buffer応答データ
   * @returns {Object} - 解析結果
   */
  parseReadBuffer(data) {
    // Read Bufferは画面全体の内容を返す
    // 実装は基本的にparseと同じ
    return this.parse(data);
  }

  /**
   * AID名を取得
   * @param {number} aid - AID
   * @returns {string}
   */
  getAIDName(aid) {
    const names = {
      [AID.NONE]: 'None',
      [AID.ENTER]: 'Enter',
      [AID.CLEAR]: 'Clear',
      [AID.PA1]: 'PA1',
      [AID.PA2]: 'PA2',
      [AID.PA3]: 'PA3'
    };

    // PFキー
    for (let i = 1; i <= 24; i++) {
      const key = `PF${i}`;
      if (AID[key] === aid) {
        return key;
      }
    }

    return names[aid] || `Unknown(0x${aid.toString(16)})`;
  }

  /**
   * データストリームをダンプ（デバッグ用）
   * @param {Buffer} data - データストリーム
   */
  dump(data) {
    logger.debug('=== Data Stream Dump ===');
    logger.debug(`Length: ${data.length}`);
    logger.debug(`Hex: ${data.toString('hex')}`);

    try {
      const parsed = this.parse(data);
      logger.debug(`AID: ${this.getAIDName(parsed.aid)} (0x${parsed.aid.toString(16)})`);
      if (parsed.cursor) {
        logger.debug(`Cursor: row=${parsed.cursor.row}, col=${parsed.cursor.col}`);
      }
      logger.debug(`Fields: ${parsed.fields.length}`);
      parsed.fields.forEach((field, index) => {
        if (field.position) {
          logger.debug(`  Field ${index}: row=${field.position.row}, col=${field.position.col}, length=${field.data.length}`);
        } else {
          logger.debug(`  Field ${index}: length=${field.data.length}`);
        }
      });
    } catch (error) {
      logger.error('Failed to parse data stream:', error);
    }
  }
}

module.exports = DataStreamParser;

// Made with Bob
