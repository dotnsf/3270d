# TN3270 プロトコル仕様

## 概要

このドキュメントでは、3270dサーバーが実装するTN3270プロトコルの詳細を説明します。

### 参照規格
- **RFC 1576**: TN3270 Current Practices
- **RFC 854**: Telnet Protocol Specification
- **RFC 855**: Telnet Option Specifications
- **IBM 3270 Data Stream Programmer's Reference** (GA23-0059)

---

## Telnetプロトコル

### Telnetコマンド

```javascript
const TelnetCommands = {
  SE: 240,    // End of subnegotiation parameters
  NOP: 241,   // No operation
  DM: 242,    // Data Mark
  BRK: 243,   // Break
  IP: 244,    // Interrupt Process
  AO: 245,    // Abort Output
  AYT: 246,   // Are You There
  EC: 247,    // Erase Character
  EL: 248,    // Erase Line
  GA: 249,    // Go Ahead
  SB: 250,    // Subnegotiation Begin
  WILL: 251,  // Will
  WONT: 252,  // Won't
  DO: 253,    // Do
  DONT: 254,  // Don't
  IAC: 255    // Interpret As Command
};
```

### Telnetオプション

```javascript
const TelnetOptions = {
  BINARY: 0,           // Binary Transmission
  ECHO: 1,             // Echo
  SGA: 3,              // Suppress Go Ahead
  STATUS: 5,           // Status
  TIMING_MARK: 6,      // Timing Mark
  TERMINAL_TYPE: 24,   // Terminal Type
  EOR: 25,             // End of Record
  NAWS: 31,            // Negotiate About Window Size
  TERMINAL_SPEED: 32,  // Terminal Speed
  LINEMODE: 34,        // Linemode
  ENVIRON: 36          // Environment Variables
};
```

### ネゴシエーションシーケンス

#### 1. 端末タイプのネゴシエーション

```
Server → Client: IAC DO TERMINAL-TYPE
                 [255, 253, 24]

Client → Server: IAC WILL TERMINAL-TYPE
                 [255, 251, 24]

Server → Client: IAC SB TERMINAL-TYPE SEND IAC SE
                 [255, 250, 24, 1, 255, 240]

Client → Server: IAC SB TERMINAL-TYPE IS IBM-3279-2-E IAC SE
                 [255, 250, 24, 0, 'I', 'B', 'M', '-', '3', '2', '7', '9', '-', '2', '-', 'E', 255, 240]
```

#### 2. バイナリモードのネゴシエーション

```
Server → Client: IAC WILL BINARY
                 [255, 251, 0]

Client → Server: IAC DO BINARY
                 [255, 253, 0]

Server → Client: IAC DO BINARY
                 [255, 253, 0]

Client → Server: IAC WILL BINARY
                 [255, 251, 0]
```

#### 3. EOR (End of Record) のネゴシエーション

```
Server → Client: IAC WILL EOR
                 [255, 251, 25]

Client → Server: IAC DO EOR
                 [255, 253, 25]
```

#### 4. 完全なネゴシエーション例

```javascript
class TelnetNegotiator {
  async negotiate(socket) {
    // 1. Terminal Type
    await this.sendCommand(socket, [IAC, DO, TERMINAL_TYPE]);
    const termTypeResponse = await this.waitForResponse(socket);
    
    if (this.isWill(termTypeResponse, TERMINAL_TYPE)) {
      await this.sendCommand(socket, [IAC, SB, TERMINAL_TYPE, 1, IAC, SE]);
      const termType = await this.waitForTerminalType(socket);
      
      // 2. Binary Mode
      await this.sendCommand(socket, [IAC, WILL, BINARY]);
      await this.waitForResponse(socket);
      
      await this.sendCommand(socket, [IAC, DO, BINARY]);
      await this.waitForResponse(socket);
      
      // 3. EOR
      await this.sendCommand(socket, [IAC, WILL, EOR]);
      await this.waitForResponse(socket);
      
      return {
        terminalType: termType,
        binaryMode: true,
        eor: true
      };
    }
    
    throw new Error('Terminal type negotiation failed');
  }
}
```

---

## 3270データストリーム

### コマンド

```javascript
const Commands = {
  // Write Commands
  W: 0x01,      // Write
  EW: 0x05,     // Erase/Write
  EWA: 0x0D,    // Erase/Write Alternate
  EAU: 0x0F,    // Erase All Unprotected
  
  // Read Commands
  RB: 0x02,     // Read Buffer
  RM: 0x06,     // Read Modified
  RMA: 0x0E,    // Read Modified All
  
  // Other Commands
  WSF: 0x11,    // Write Structured Field
  NOP: 0x03     // No Operation
};
```

### WCC (Write Control Character)

```javascript
const WCC = {
  RESET: 0x40,           // Reset (bit 6)
  RESET_MDT: 0x01,       // Reset MDT (bit 0)
  RESTORE_KEYBOARD: 0x02, // Restore Keyboard (bit 1)
  SOUND_ALARM: 0x04,     // Sound Alarm (bit 2)
  UNLOCK_KEYBOARD: 0x02, // Unlock Keyboard (bit 1)
  RESET_PARTITION: 0x20  // Reset Partition (bit 5)
};

// WCCの組み合わせ例
const WCC_RESET_UNLOCK = WCC.RESET | WCC.RESTORE_KEYBOARD;  // 0x42
```

### オーダー (Orders)

```javascript
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
```

### AID (Attention Identifier)

```javascript
const AID = {
  // No AID
  NONE: 0x60,
  
  // Enter Keys
  ENTER: 0x7D,
  
  // PF Keys
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
  
  // PA Keys
  PA1: 0x6C,
  PA2: 0x6E,
  PA3: 0x6B,
  
  // Clear Key
  CLEAR: 0x6D,
  
  // Selector Pen
  SELECT: 0x7E
};
```

### フィールド属性

```javascript
/**
 * フィールド属性バイト
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
 */

class FieldAttribute {
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
```

### バッファアドレス

```javascript
/**
 * 3270バッファアドレスのエンコード/デコード
 * 
 * 3270は24行×80列 = 1920セル
 * アドレスは0-1919の範囲
 * 
 * エンコード方式:
 * - 14ビットアドレスを2バイトで表現
 * - 各バイトは6ビット（0x40-0x7F）
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
    return Buffer.from([high, low]);
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
```

---

## データストリーム形式

### Write / Erase Write コマンド

```
+--------+-----+--------+--------+--------+-----+
| Command| WCC | Orders | Data   | Orders | ... |
+--------+-----+--------+--------+--------+-----+
  1 byte  1 byte variable variable variable
```

#### 例: ログイン画面の表示

```javascript
function generateLoginScreen() {
  const buffer = [];
  
  // Command: Erase/Write
  buffer.push(Commands.EW);
  
  // WCC: Reset + Unlock Keyboard
  buffer.push(WCC.RESET | WCC.RESTORE_KEYBOARD);
  
  // タイトル表示 (行0, 列30)
  buffer.push(Orders.SBA);
  buffer.push(...BufferAddress.encode(BufferAddress.fromRowCol(0, 30)));
  buffer.push(...ebcdic('TN3270 Login'));
  
  // ユーザー名フィールド (行5, 列10)
  buffer.push(Orders.SBA);
  buffer.push(...BufferAddress.encode(BufferAddress.fromRowCol(5, 10)));
  buffer.push(...ebcdic('Username: '));
  
  // 入力フィールド定義
  buffer.push(Orders.SF);
  buffer.push(FieldAttribute.encode({
    protected: false,
    numeric: false,
    hidden: false,
    intensified: false,
    modified: false
  }));
  
  // フィールド長（20文字分の空白）
  buffer.push(...ebcdic(' '.repeat(20)));
  
  // フィールド終了
  buffer.push(Orders.SF);
  buffer.push(FieldAttribute.encode({
    protected: true,
    numeric: false,
    hidden: false,
    intensified: false,
    modified: false
  }));
  
  // パスワードフィールド (行7, 列10)
  buffer.push(Orders.SBA);
  buffer.push(...BufferAddress.encode(BufferAddress.fromRowCol(7, 10)));
  buffer.push(...ebcdic('Password: '));
  
  // 入力フィールド定義（非表示）
  buffer.push(Orders.SF);
  buffer.push(FieldAttribute.encode({
    protected: false,
    numeric: false,
    hidden: true,  // パスワードは非表示
    intensified: false,
    modified: false
  }));
  
  // フィールド長
  buffer.push(...ebcdic(' '.repeat(20)));
  
  // フィールド終了
  buffer.push(Orders.SF);
  buffer.push(FieldAttribute.encode({
    protected: true,
    numeric: false,
    hidden: false,
    intensified: false,
    modified: false
  }));
  
  // カーソルをユーザー名フィールドに配置
  buffer.push(Orders.IC);
  
  // EOR (End of Record)
  buffer.push(TelnetCommands.IAC);
  buffer.push(TelnetCommands.EOR);
  
  return Buffer.from(buffer);
}
```

### Read Modified コマンド応答

```
+-----+--------+--------+--------+--------+-----+
| AID | Cursor | Orders | Data   | Orders | ... |
+-----+--------+--------+--------+--------+-----+
 1 byte 2 bytes variable variable variable
```

#### 例: ユーザー入力の読み取り

```javascript
function parseReadModified(data) {
  let offset = 0;
  
  // AID
  const aid = data[offset++];
  
  // Cursor Position
  const cursorAddr = BufferAddress.decode(data.slice(offset, offset + 2));
  offset += 2;
  
  const fields = [];
  
  while (offset < data.length) {
    const byte = data[offset++];
    
    if (byte === Orders.SBA) {
      // Set Buffer Address
      const addr = BufferAddress.decode(data.slice(offset, offset + 2));
      offset += 2;
      
      // フィールドデータを読み取り
      const fieldData = [];
      while (offset < data.length && data[offset] !== Orders.SF && data[offset] !== Orders.SBA) {
        fieldData.push(data[offset++]);
      }
      
      fields.push({
        address: addr,
        data: ebcdicToUtf8(Buffer.from(fieldData))
      });
    } else if (byte === Orders.SF) {
      // Start Field - スキップ
      offset++;
    }
  }
  
  return {
    aid,
    cursor: BufferAddress.toRowCol(cursorAddr),
    fields
  };
}
```

---

## 拡張属性（カラー対応）

### Start Field Extended (SFE)

```javascript
const ExtendedAttributes = {
  ALL: 0x00,           // All character attributes
  HIGHLIGHTING: 0x41,  // Highlighting
  COLOR: 0x42,         // Foreground color
  CHARSET: 0x43,       // Character set
  FIELD_OUTLINING: 0x44, // Field outlining
  TRANSPARENCY: 0x45,  // Transparency
  FIELD_VALIDATION: 0x46 // Field validation
};

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

const Highlighting = {
  DEFAULT: 0x00,
  NORMAL: 0xF0,
  BLINK: 0xF1,
  REVERSE: 0xF2,
  UNDERSCORE: 0xF4
};
```

#### カラーフィールドの定義例

```javascript
function defineColorField(row, col, length, color) {
  const buffer = [];
  
  // Set Buffer Address
  buffer.push(Orders.SBA);
  buffer.push(...BufferAddress.encode(BufferAddress.fromRowCol(row, col)));
  
  // Start Field Extended
  buffer.push(Orders.SFE);
  
  // 属性ペア数
  buffer.push(2);  // 2つの属性（基本属性 + カラー）
  
  // 基本属性
  buffer.push(ExtendedAttributes.ALL);
  buffer.push(FieldAttribute.encode({
    protected: false,
    numeric: false,
    hidden: false,
    intensified: false,
    modified: false
  }));
  
  // カラー属性
  buffer.push(ExtendedAttributes.COLOR);
  buffer.push(color);
  
  return Buffer.from(buffer);
}
```

---

## EBCDICコードページ

### CP037 (US EBCDIC)

```javascript
/**
 * EBCDIC CP037 → ASCII 変換テーブル（抜粋）
 */
const EBCDIC_TO_ASCII = {
  0x40: 0x20,  // Space
  0x4A: 0x5B,  // [
  0x4B: 0x2E,  // .
  0x4C: 0x3C,  // <
  0x4D: 0x28,  // (
  0x4E: 0x2B,  // +
  0x4F: 0x7C,  // |
  0x50: 0x26,  // &
  // ... (完全なテーブルは実装時に定義)
  
  // 数字
  0xF0: 0x30,  // 0
  0xF1: 0x31,  // 1
  0xF2: 0x32,  // 2
  // ...
  0xF9: 0x39,  // 9
  
  // アルファベット (A-Z)
  0xC1: 0x41,  // A
  0xC2: 0x42,  // B
  // ...
  0xE9: 0x5A,  // Z
  
  // アルファベット (a-z)
  0x81: 0x61,  // a
  0x82: 0x62,  // b
  // ...
  0xA9: 0x7A   // z
};
```

### CP939 (Japanese EBCDIC)

```javascript
/**
 * CP939は2バイト文字（DBCS）をサポート
 * 
 * シフトイン/シフトアウト:
 * - SO (Shift Out): 0x0E - DBCS開始
 * - SI (Shift In): 0x0F - DBCS終了
 */

class CP939Converter {
  convert(ebcdic) {
    const result = [];
    let i = 0;
    let dbcsMode = false;
    
    while (i < ebcdic.length) {
      const byte = ebcdic[i];
      
      if (byte === 0x0E) {
        // Shift Out - DBCS開始
        dbcsMode = true;
        i++;
      } else if (byte === 0x0F) {
        // Shift In - DBCS終了
        dbcsMode = false;
        i++;
      } else if (dbcsMode) {
        // DBCS文字（2バイト）
        if (i + 1 < ebcdic.length) {
          const char = this.convertDBCS(ebcdic[i], ebcdic[i + 1]);
          result.push(char);
          i += 2;
        } else {
          i++;
        }
      } else {
        // SBCS文字（1バイト）
        const char = this.convertSBCS(byte);
        result.push(char);
        i++;
      }
    }
    
    return result.join('');
  }
  
  convertSBCS(byte) {
    // CP037と同じ
    return EBCDIC_TO_ASCII[byte] || '?';
  }
  
  convertDBCS(byte1, byte2) {
    // DBCS変換テーブルを使用
    // 実装時にiconv-liteを使用
    return '?';
  }
}
```

---

## プロトコル実装例

### 完全な接続フロー

```javascript
class TN3270Session {
  async handleConnection(socket) {
    try {
      // 1. Telnetネゴシエーション
      const negotiation = await this.negotiateTelnet(socket);
      
      // 2. ログイン画面表示
      await this.sendLoginScreen(socket);
      
      // 3. ユーザー入力待ち
      const loginData = await this.waitForInput(socket);
      
      // 4. 認証
      const authResult = await this.authenticate(
        loginData.username,
        loginData.password
      );
      
      if (!authResult.success) {
        await this.sendErrorScreen(socket, 'Authentication failed');
        socket.close();
        return;
      }
      
      // 5. PTY起動
      const pty = await this.createPTY(authResult.userContext);
      
      // 6. ウェルカム画面表示
      await this.sendWelcomeScreen(socket);
      
      // 7. メインループ
      await this.mainLoop(socket, pty);
      
    } catch (error) {
      logger.error('Session error:', error);
      socket.close();
    }
  }
  
  async mainLoop(socket, pty) {
    // PTY出力 → クライアント
    pty.onData((data) => {
      const commands = this.vt100Parser.parse(data);
      this.screenBuffer.apply(commands);
      const dataStream = this.generator.generate(this.screenBuffer);
      socket.write(dataStream);
    });
    
    // クライアント入力 → PTY
    socket.on('data', (data) => {
      const parsed = this.parser.parse(data);
      
      if (parsed.aid === AID.ENTER) {
        // Enterキー
        pty.write('\n');
      } else if (parsed.aid >= AID.PF1 && parsed.aid <= AID.PF24) {
        // PFキー
        const pfNum = this.getPFNumber(parsed.aid);
        pty.write(this.keyboardMapper.mapPF(pfNum));
      } else {
        // 通常の入力
        const text = this.converter.ebcdicToUtf8(parsed.data);
        pty.write(text);
      }
    });
  }
}
```

---

## デバッグとトラブルシューティング

### データストリームのダンプ

```javascript
class DataStreamDebugger {
  dump(data) {
    console.log('=== Data Stream Dump ===');
    console.log('Length:', data.length);
    console.log('Hex:', data.toString('hex'));
    
    let offset = 0;
    
    // Command
    if (offset < data.length) {
      const cmd = data[offset++];
      console.log(`Command: 0x${cmd.toString(16)} (${this.getCommandName(cmd)})`);
    }
    
    // WCC
    if (offset < data.length) {
      const wcc = data[offset++];
      console.log(`WCC: 0x${wcc.toString(16)}`);
      this.dumpWCC(wcc);
    }
    
    // Orders and Data
    while (offset < data.length) {
      const byte = data[offset++];
      
      if (this.isOrder(byte)) {
        console.log(`Order: 0x${byte.toString(16)} (${this.getOrderName(byte)})`);
        
        if (byte === Orders.SBA) {
          const addr = BufferAddress.decode(data.slice(offset, offset + 2));
          const pos = BufferAddress.toRowCol(addr);
          console.log(`  Address: ${addr} (row=${pos.row}, col=${pos.col})`);
          offset += 2;
        } else if (byte === Orders.SF) {
          const attr = data[offset++];
          console.log(`  Attribute: 0x${attr.toString(16)}`);
          this.dumpAttribute(attr);
        }
      } else {
        // Data
        const start = offset - 1;
        while (offset < data.length && !this.isOrder(data[offset])) {
          offset++;
        }
        const text = ebcdicToUtf8(data.slice(start, offset));
        console.log(`Data: "${text}"`);
      }
    }
  }
  
  dumpWCC(wcc) {
    if (wcc & WCC.RESET) console.log('  - RESET');
    if (wcc & WCC.RESTORE_KEYBOARD) console.log('  - RESTORE_KEYBOARD');
    if (wcc & WCC.SOUND_ALARM) console.log('  - SOUND_ALARM');
    if (wcc & WCC.RESET_MDT) console.log('  - RESET_MDT');
  }
  
  dumpAttribute(attr) {
    const decoded = FieldAttribute.decode(attr);
    console.log('  - Protected:', decoded.protected);
    console.log('  - Numeric:', decoded.numeric);
    console.log('  - Hidden:', decoded.hidden);
    console.log('  - Intensified:', decoded.intensified);
    console.log('  - Modified:', decoded.modified);
  }
}
```

---

## 次のステップ

プロトコル仕様が完了しました。次は以下のドキュメントを作成します：

1. **[IMPLEMENTATION.md](IMPLEMENTATION.md)** - 各モジュールの詳細実装仕様
2. **[TESTING.md](TESTING.md)** - テスト計画とテストケース