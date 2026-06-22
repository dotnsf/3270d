# TN3270 Server - 実装ガイド

## 概要

このドキュメントでは、各モジュールの詳細な実装仕様とコーディングガイドラインを説明します。

---

## モジュール実装仕様

### 1. Network Layer

#### src/network/telnet-server.js

```javascript
/**
 * Telnetサーバー
 */
const net = require('net');
const EventEmitter = require('events');
const logger = require('../logger');
const Connection = require('./connection');

class TelnetServer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 23,
      host: options.host || '0.0.0.0',
      maxConnections: options.maxConnections || 2,
      ...options
    };
    
    this.server = null;
    this.connections = new Map();
  }
  
  /**
   * サーバーを起動
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });
      
      this.server.on('error', (error) => {
        logger.error('Server error:', error);
        this.emit('error', error);
      });
      
      this.server.listen(this.options.port, this.options.host, () => {
        logger.info(`TN3270 server listening on ${this.options.host}:${this.options.port}`);
        resolve();
      });
    });
  }
  
  /**
   * サーバーを停止
   */
  async stop() {
    return new Promise((resolve) => {
      // すべての接続をクローズ
      for (const connection of this.connections.values()) {
        connection.close();
      }
      
      if (this.server) {
        this.server.close(() => {
          logger.info('TN3270 server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
  
  /**
   * 新しい接続を処理
   */
  handleConnection(socket) {
    // 最大接続数チェック
    if (this.connections.size >= this.options.maxConnections) {
      logger.warn('Max connections reached, rejecting connection');
      socket.end();
      return;
    }
    
    const connection = new Connection(socket);
    this.connections.set(connection.id, connection);
    
    logger.info(`New connection: ${connection.id} from ${socket.remoteAddress}`);
    
    connection.on('close', () => {
      this.connections.delete(connection.id);
      logger.info(`Connection closed: ${connection.id}`);
    });
    
    this.emit('connection', connection);
  }
  
  /**
   * アクティブな接続数を取得
   */
  getConnectionCount() {
    return this.connections.size;
  }
}

module.exports = TelnetServer;
```

#### src/network/connection.js

```javascript
/**
 * 個別の接続を管理
 */
const EventEmitter = require('events');
const crypto = require('crypto');
const logger = require('../logger');
const TelnetOptions = require('./telnet-options');

class Connection extends EventEmitter {
  constructor(socket) {
    super();
    
    this.id = crypto.randomUUID();
    this.socket = socket;
    this.state = 'connecting';
    this.terminalType = null;
    this.options = new TelnetOptions();
    
    this.setupSocket();
  }
  
  /**
   * ソケットのセットアップ
   */
  setupSocket() {
    this.socket.on('data', (data) => {
      this.handleData(data);
    });
    
    this.socket.on('close', () => {
      this.state = 'closed';
      this.emit('close');
    });
    
    this.socket.on('error', (error) => {
      logger.error(`Connection ${this.id} error:`, error);
      this.emit('error', error);
    });
  }
  
  /**
   * データ受信処理
   */
  handleData(data) {
    if (this.state === 'connecting' || this.state === 'negotiating') {
      // Telnetネゴシエーション中
      this.options.process(data, (response) => {
        if (response) {
          this.socket.write(response);
        }
      });
      
      if (this.options.isNegotiationComplete()) {
        this.terminalType = this.options.getTerminalType();
        this.state = 'negotiated';
        this.emit('negotiated', this.terminalType);
      }
    } else {
      // 通常のデータ
      this.emit('data', data);
    }
  }
  
  /**
   * Telnetネゴシエーションを開始
   */
  async negotiate() {
    this.state = 'negotiating';
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Negotiation timeout'));
      }, 30000);
      
      this.once('negotiated', (terminalType) => {
        clearTimeout(timeout);
        resolve(terminalType);
      });
      
      // Terminal Typeをリクエスト
      this.options.requestTerminalType(this.socket);
      
      // Binary Modeをリクエスト
      this.options.requestBinaryMode(this.socket);
      
      // EORをリクエスト
      this.options.requestEOR(this.socket);
    });
  }
  
  /**
   * データ送信
   */
  send(data) {
    if (this.state !== 'closed') {
      this.socket.write(data);
    }
  }
  
  /**
   * 接続をクローズ
   */
  close() {
    if (this.state !== 'closed') {
      this.socket.end();
      this.state = 'closed';
    }
  }
  
  /**
   * 接続状態を取得
   */
  getState() {
    return this.state;
  }
  
  /**
   * リモートアドレスを取得
   */
  getRemoteAddress() {
    return this.socket.remoteAddress;
  }
}

module.exports = Connection;
```

#### src/network/telnet-options.js

```javascript
/**
 * Telnetオプション処理
 */
const logger = require('../logger');

// Telnetコマンド
const IAC = 255;
const WILL = 251;
const WONT = 252;
const DO = 253;
const DONT = 254;
const SB = 250;
const SE = 240;

// Telnetオプション
const BINARY = 0;
const ECHO = 1;
const SGA = 3;
const TERMINAL_TYPE = 24;
const EOR = 25;

class TelnetOptions {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.terminalType = null;
    this.binaryMode = false;
    this.eor = false;
    this.negotiationComplete = false;
  }
  
  /**
   * データを処理
   */
  process(data, callback) {
    this.buffer = Buffer.concat([this.buffer, data]);
    
    while (this.buffer.length > 0) {
      const result = this.parseCommand();
      
      if (result === null) {
        // 不完全なコマンド
        break;
      }
      
      if (result.response) {
        callback(result.response);
      }
    }
  }
  
  /**
   * コマンドをパース
   */
  parseCommand() {
    if (this.buffer.length < 2) {
      return null;
    }
    
    if (this.buffer[0] !== IAC) {
      // IAC以外のデータは無視
      this.buffer = this.buffer.slice(1);
      return { response: null };
    }
    
    const command = this.buffer[1];
    
    if (command === SB) {
      // Subnegotiation
      return this.parseSubnegotiation();
    } else if (command === WILL || command === WONT || command === DO || command === DONT) {
      if (this.buffer.length < 3) {
        return null;
      }
      
      const option = this.buffer[2];
      this.buffer = this.buffer.slice(3);
      
      return this.handleOption(command, option);
    } else {
      // その他のコマンド
      this.buffer = this.buffer.slice(2);
      return { response: null };
    }
  }
  
  /**
   * Subnegotiationをパース
   */
  parseSubnegotiation() {
    // IAC SE を探す
    let endIndex = -1;
    for (let i = 2; i < this.buffer.length - 1; i++) {
      if (this.buffer[i] === IAC && this.buffer[i + 1] === SE) {
        endIndex = i;
        break;
      }
    }
    
    if (endIndex === -1) {
      return null;
    }
    
    const option = this.buffer[2];
    const data = this.buffer.slice(3, endIndex);
    this.buffer = this.buffer.slice(endIndex + 2);
    
    return this.handleSubnegotiation(option, data);
  }
  
  /**
   * オプションを処理
   */
  handleOption(command, option) {
    logger.debug(`Telnet: ${this.commandName(command)} ${option}`);
    
    if (command === WILL) {
      if (option === TERMINAL_TYPE) {
        // Terminal Typeを受け入れる
        return { response: Buffer.from([IAC, DO, TERMINAL_TYPE]) };
      } else if (option === BINARY) {
        this.binaryMode = true;
        return { response: Buffer.from([IAC, DO, BINARY]) };
      } else if (option === EOR) {
        this.eor = true;
        return { response: Buffer.from([IAC, DO, EOR]) };
      }
    } else if (command === DO) {
      if (option === BINARY) {
        return { response: Buffer.from([IAC, WILL, BINARY]) };
      } else if (option === EOR) {
        return { response: Buffer.from([IAC, WILL, EOR]) };
      }
    }
    
    return { response: null };
  }
  
  /**
   * Subnegotiationを処理
   */
  handleSubnegotiation(option, data) {
    if (option === TERMINAL_TYPE && data.length > 0) {
      if (data[0] === 0) {
        // IS
        this.terminalType = data.slice(1).toString('ascii');
        logger.info(`Terminal type: ${this.terminalType}`);
        
        // ネゴシエーション完了をチェック
        if (this.binaryMode && this.eor) {
          this.negotiationComplete = true;
        }
      }
    }
    
    return { response: null };
  }
  
  /**
   * Terminal Typeをリクエスト
   */
  requestTerminalType(socket) {
    socket.write(Buffer.from([IAC, DO, TERMINAL_TYPE]));
    
    // SEND subnegotiation
    setTimeout(() => {
      socket.write(Buffer.from([IAC, SB, TERMINAL_TYPE, 1, IAC, SE]));
    }, 100);
  }
  
  /**
   * Binary Modeをリクエスト
   */
  requestBinaryMode(socket) {
    socket.write(Buffer.from([IAC, WILL, BINARY]));
    socket.write(Buffer.from([IAC, DO, BINARY]));
  }
  
  /**
   * EORをリクエスト
   */
  requestEOR(socket) {
    socket.write(Buffer.from([IAC, WILL, EOR]));
  }
  
  /**
   * ネゴシエーションが完了したか
   */
  isNegotiationComplete() {
    return this.negotiationComplete;
  }
  
  /**
   * Terminal Typeを取得
   */
  getTerminalType() {
    return this.terminalType;
  }
  
  /**
   * コマンド名を取得
   */
  commandName(command) {
    const names = {
      [WILL]: 'WILL',
      [WONT]: 'WONT',
      [DO]: 'DO',
      [DONT]: 'DONT'
    };
    return names[command] || `UNKNOWN(${command})`;
  }
}

module.exports = TelnetOptions;
```

---

### 2. Protocol Layer

#### src/protocol/data-stream.js

```javascript
/**
 * 3270データストリーム定義
 */

// コマンド
const Commands = {
  W: 0x01,      // Write
  EW: 0x05,     // Erase/Write
  EWA: 0x0D,    // Erase/Write Alternate
  EAU: 0x0F,    // Erase All Unprotected
  RB: 0x02,     // Read Buffer
  RM: 0x06,     // Read Modified
  RMA: 0x0E,    // Read Modified All
  WSF: 0x11,    // Write Structured Field
  NOP: 0x03     // No Operation
};

// WCC (Write Control Character)
const WCC = {
  RESET: 0x40,
  RESET_MDT: 0x01,
  RESTORE_KEYBOARD: 0x02,
  SOUND_ALARM: 0x04,
  UNLOCK_KEYBOARD: 0x02,
  RESET_PARTITION: 0x20
};

// オーダー
const Orders = {
  SF: 0x1D,     // Start Field
  SFE: 0x29,    // Start Field Extended
  SBA: 0x11,    // Set Buffer Address
  SA: 0x28,     // Set Attribute
  MF: 0x2C,     // Modify Field
  IC: 0x13,     // Insert Cursor
  PT: 0x05,     // Program Tab
  RA: 0x3C,     // Repeat to Address
  EUA: 0x12,    // Erase Unprotected to Address
  GE: 0x08      // Graphic Escape
};

// AID (Attention Identifier)
const AID = {
  NONE: 0x60,
  ENTER: 0x7D,
  PF1: 0xF1,
  PF2: 0xF2,
  PF3: 0xF3,
  PF4: 0xF4,
  PF5: 0xF5,
  PF6: 0xF6,
  PF7: 0xF7,
  PF8: 0xF8,
  PF9: 0xF9,
  PF10: 0x7A,
  PF11: 0x7B,
  PF12: 0x7C,
  PF13: 0xC1,
  PF14: 0xC2,
  PF15: 0xC3,
  PF16: 0xC4,
  PF17: 0xC5,
  PF18: 0xC6,
  PF19: 0xC7,
  PF20: 0xC8,
  PF21: 0xC9,
  PF22: 0x4A,
  PF23: 0x4B,
  PF24: 0x4C,
  PA1: 0x6C,
  PA2: 0x6E,
  PA3: 0x6B,
  CLEAR: 0x6D,
  SELECT: 0x7E
};

// 拡張属性
const ExtendedAttributes = {
  ALL: 0x00,
  HIGHLIGHTING: 0x41,
  COLOR: 0x42,
  CHARSET: 0x43,
  FIELD_OUTLINING: 0x44,
  TRANSPARENCY: 0x45,
  FIELD_VALIDATION: 0x46
};

// カラー
const Colors = {
  DEFAULT: 0x00,
  BLUE: 0xF1,
  RED: 0xF2,
  PINK: 0xF3,
  GREEN: 0xF4,
  TURQUOISE: 0xF5,
  YELLOW: 0xF6,
  WHITE: 0xF7
};

module.exports = {
  Commands,
  WCC,
  Orders,
  AID,
  ExtendedAttributes,
  Colors
};
```

#### src/protocol/generator.js

```javascript
/**
 * 3270データストリーム生成
 */
const { Commands, WCC, Orders } = require('./data-stream');
const BufferAddress = require('./buffer-address');
const FieldAttribute = require('./field-attribute');
const CharsetConverter = require('../charset/converter');

class DataStreamGenerator {
  constructor() {
    this.converter = new CharsetConverter();
  }
  
  /**
   * Erase/Write コマンドを生成
   */
  generateEraseWrite(screenBuffer) {
    const stream = [];
    
    // Command
    stream.push(Commands.EW);
    
    // WCC
    stream.push(WCC.RESET | WCC.RESTORE_KEYBOARD);
    
    // 画面内容を生成
    for (let row = 0; row < screenBuffer.rows; row++) {
      for (let col = 0; col < screenBuffer.cols; col++) {
        const cell = screenBuffer.getCell(row, col);
        
        if (cell.isField) {
          // フィールド定義
          stream.push(Orders.SF);
          stream.push(FieldAttribute.encode(cell.attr));
        } else if (cell.char !== ' ' || col === 0) {
          // 文字データ
          if (col === 0 || screenBuffer.getCell(row, col - 1).isField) {
            // アドレス設定
            stream.push(Orders.SBA);
            stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(row, col)));
          }
          
          // 文字をEBCDICに変換
          const ebcdic = this.converter.utf8ToEbcdic(cell.char);
          stream.push(...ebcdic);
        }
      }
    }
    
    // カーソル位置
    const cursor = screenBuffer.getCursor();
    stream.push(Orders.IC);
    
    // EOR
    stream.push(0xFF, 0xEF);
    
    return Buffer.from(stream);
  }
  
  /**
   * Write コマンドを生成（差分更新）
   */
  generateWrite(changes) {
    const stream = [];
    
    // Command
    stream.push(Commands.W);
    
    // WCC
    stream.push(WCC.RESTORE_KEYBOARD);
    
    // 変更箇所を出力
    for (const change of changes) {
      // アドレス設定
      stream.push(Orders.SBA);
      stream.push(...BufferAddress.encode(
        BufferAddress.fromRowCol(change.row, change.startCol)
      ));
      
      // データ
      for (const cell of change.data) {
        const ebcdic = this.converter.utf8ToEbcdic(cell.char);
        stream.push(...ebcdic);
      }
    }
    
    // EOR
    stream.push(0xFF, 0xEF);
    
    return Buffer.from(stream);
  }
  
  /**
   * Read Modified コマンドを生成
   */
  generateReadModified() {
    const stream = [];
    
    // Command
    stream.push(Commands.RM);
    
    // EOR
    stream.push(0xFF, 0xEF);
    
    return Buffer.from(stream);
  }
}

module.exports = DataStreamGenerator;
```

#### src/protocol/parser.js

```javascript
/**
 * 3270データストリームパーサー
 */
const { Commands, Orders, AID } = require('./data-stream');
const BufferAddress = require('./buffer-address');
const FieldAttribute = require('./field-attribute');
const CharsetConverter = require('../charset/converter');

class DataStreamParser {
  constructor() {
    this.converter = new CharsetConverter();
  }
  
  /**
   * データストリームを解析
   */
  parse(data) {
    let offset = 0;
    
    // AID
    const aid = data[offset++];
    
    // Cursor Position
    let cursor = null;
    if (offset + 1 < data.length) {
      const cursorAddr = BufferAddress.decode(data.slice(offset, offset + 2));
      cursor = BufferAddress.toRowCol(cursorAddr);
      offset += 2;
    }
    
    // Fields
    const fields = [];
    
    while (offset < data.length) {
      const byte = data[offset++];
      
      if (byte === Orders.SBA) {
        // Set Buffer Address
        if (offset + 1 < data.length) {
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
            fields.push({
              address: addr,
              position: BufferAddress.toRowCol(addr),
              data: this.converter.ebcdicToUtf8(Buffer.from(fieldData))
            });
          }
        }
      } else if (byte === Orders.SF) {
        // Start Field - 属性バイトをスキップ
        if (offset < data.length) {
          offset++;
        }
      } else if (byte === 0xFF) {
        // IAC - Telnetコマンド、終了
        break;
      }
    }
    
    return {
      aid,
      cursor,
      fields
    };
  }
}

module.exports = DataStreamParser;
```

#### src/protocol/buffer-address.js

```javascript
/**
 * 3270バッファアドレス処理
 */

class BufferAddress {
  /**
   * 行列座標をバッファアドレスに変換
   */
  static fromRowCol(row, col) {
    return row * 80 + col;
  }
  
  /**
   * バッファアドレスを行列座標に変換
   */
  static toRowCol(addr) {
    return {
      row: Math.floor(addr / 80),
      col: addr % 80
    };
  }
  
  /**
   * バッファアドレスを2バイトにエンコード
   */
  static encode(addr) {
    const high = ((addr >> 6) & 0x3F) | 0x40;
    const low = (addr & 0x3F) | 0x40;
    return [high, low];
  }
  
  /**
   * 2バイトをバッファアドレスにデコード
   */
  static decode(buf) {
    const high = (buf[0] & 0x3F) << 6;
    const low = buf[1] & 0x3F;
    return high | low;
  }
}

module.exports = BufferAddress;
```

#### src/protocol/field-attribute.js

```javascript
/**
 * 3270フィールド属性処理
 */

class FieldAttribute {
  /**
   * 属性オブジェクトをバイトにエンコード
   */
  static encode(attr) {
    let byte = 0;
    
    // Protection (bits 7-6)
    if (attr.protected) {
      byte |= 0x20;
      if (attr.numeric) {
        byte |= 0x10;
      }
    } else if (attr.numeric) {
      byte |= 0x10;
    }
    
    // Display (bits 5-4)
    if (attr.hidden) {
      byte |= 0x0C;
    } else if (attr.intensified) {
      byte |= 0x08;
    } else if (attr.detectable) {
      byte |= 0x04;
    }
    
    // MDT (bit 2)
    if (attr.modified) {
      byte |= 0x01;
    }
    
    return byte;
  }
  
  /**
   * バイトを属性オブジェクトにデコード
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
}

module.exports = FieldAttribute;
```

---

### 3. Character Conversion Layer

#### src/charset/converter.js

```javascript
/**
 * 文字コード変換
 */
const iconv = require('iconv-lite');

class CharsetConverter {
  constructor(codePage = 'cp037') {
    this.codePage = codePage;
    this.japaneseCodePage = 'cp939';
  }
  
  /**
   * EBCDIC → UTF-8
   */
  ebcdicToUtf8(ebcdic) {
    try {
      return iconv.decode(ebcdic, this.codePage);
    } catch (error) {
      // エラー時は置換文字を使用
      return '?'.repeat(ebcdic.length);
    }
  }
  
  /**
   * UTF-8 → EBCDIC
   */
  utf8ToEbcdic(utf8) {
    try {
      // 日本語文字が含まれているかチェック
      if (this.containsJapanese(utf8)) {
        return iconv.encode(utf8, this.japaneseCodePage);
      } else {
        return iconv.encode(utf8, this.codePage);
      }
    } catch (error) {
      // エラー時は'?'に置換
      return iconv.encode('?'.repeat(utf8.length), this.codePage);
    }
  }
  
  /**
   * 日本語文字が含まれているかチェック
   */
  containsJapanese(text) {
    // ひらがな、カタカナ、漢字の範囲
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
  }
  
  /**
   * 文字幅を取得
   */
  getCharWidth(char) {
    // 全角文字は2、半角文字は1
    const code = char.charCodeAt(0);
    
    // 全角範囲
    if ((code >= 0x3000 && code <= 0x9FFF) ||  // CJK
        (code >= 0xFF00 && code <= 0xFFEF)) {  // 全角英数
      return 2;
    }
    
    return 1;
  }
  
  /**
   * コードページを変更
   */
  setCodePage(codePage) {
    this.codePage = codePage;
  }
}

module.exports = CharsetConverter;
```

---

### 4. Screen Buffer Manager

#### src/screen/buffer.js

```javascript
/**
 * 3270画面バッファ
 */

class ScreenBuffer {
  constructor(rows = 24, cols = 80) {
    this.rows = rows;
    this.cols = cols;
    this.buffer = this.createEmptyBuffer();
    this.cursor = { row: 0, col: 0 };
    this.fields = [];
    this.modified = false;
  }
  
  /**
   * 空のバッファを作成
   */
  createEmptyBuffer() {
    const buffer = [];
    for (let row = 0; row < this.rows; row++) {
      buffer[row] = [];
      for (let col = 0; col < this.cols; col++) {
        buffer[row][col] = {
          char: ' ',
          attr: this.getDefaultAttribute(),
          modified: false,
          isField: false
        };
      }
    }
    return buffer;
  }
  
  /**
   * デフォルト属性
   */
  getDefaultAttribute() {
    return {
      fg: 'green',
      bg: 'black',
      bold: false,
      underline: false,
      reverse: false,
      blink: false
    };
  }
  
  /**
   * セルを取得
   */
  getCell(row, col) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      return this.buffer[row][col];
    }
    return null;
  }
  
  /**
   * 文字を書き込み
   */
  writeChar(row, col, char, attr = null) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.buffer[row][col].char = char;
      if (attr) {
        this.buffer[row][col].attr = { ...attr };
      }
      this.buffer[row][col].modified = true;
      this.modified = true;
    }
  }
  
  /**
   * 文字列を書き込み
   */
  writeString(row, col, text, attr = null) {
    let currentCol = col;
    for (const char of text) {
      if (currentCol >= this.cols) break;
      this.writeChar(row, currentCol, char, attr);
      currentCol++;
    }
  }
  
  /**
   * フィールドを定義
   */
  defineField(row, col, length, attr) {
    const field = {
      row,
      col,
      length,
      attr: { ...attr }
    };
    
    this.fields.push(field);
    
    // フィールドマーカーを設定
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.buffer[row][col].isField = true;
      this.buffer[row][col].attr = { ...attr };
    }
  }
  
  /**
   * 画面をクリア
   */
  clear() {
    this.buffer = this.createEmptyBuffer();
    this.cursor = { row: 0, col: 0 };
    this.fields = [];
    this.modified = true;
  }
  
  /**
   * カーソル位置を設定
   */
  setCursor(row, col) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.cursor = { row, col };
    }
  }
  
  /**
   * カーソル位置を取得
   */
  getCursor() {
    return { ...this.cursor };
  }
  
  /**
   * 変更された領域を取得
   */
  getModifiedRegions() {
    const regions = [];
    
    for (let row = 0; row < this.rows; row++) {
      let startCol = -1;
      let endCol = -1;
      
      for (let col = 0; col < this.cols; col++) {
        if (this.buffer[row][col].modified) {
          if (startCol === -1) {
            startCol = col;
          }
          endCol = col;
        } else if (startCol !== -1) {
          regions.push({
            row,
            startCol,
            endCol,
            data: this.buffer[row].slice(startCol, endCol + 1)
          });
          startCol = -1;
          endCol = -1;
        }
      }
      
      if (startCol !== -1) {
        regions.push({
          row,
          startCol,
          endCol,
          data: this.buffer[row].slice(startCol, endCol + 1)
        });
      }
    }
    
    return regions;
  }
  
  /**
   * 変更フラグをクリア
   */
  clearModified() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.buffer[row][col].modified = false;
      }
    }
    this.modified = false;
  }
  
  /**
   * バッファの内容を取得
   */
  getContent() {
    return this.buffer.map(row => row.map(cell => ({ ...cell })));
  }
}

module.exports = ScreenBuffer;
```

---

## 実装の続きとテスト計画は次のドキュメントへ

残りのモジュール（Terminal Abstraction Layer、Authentication Layer、PTY Manager）の実装仕様と、包括的なテスト計画は **[TESTING.md](TESTING.md)** に記載します。