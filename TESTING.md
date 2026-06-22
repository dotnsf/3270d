# TN3270 Server - テスト計画

## 概要

このドキュメントでは、3270dサーバーの包括的なテスト戦略、テストケース、テスト環境について説明します。

---

## テスト戦略

### テストレベル

1. **ユニットテスト**: 個別モジュールの機能テスト
2. **統合テスト**: モジュール間の連携テスト
3. **E2Eテスト**: エンドツーエンドのシナリオテスト
4. **パフォーマンステスト**: 負荷テスト、応答時間測定
5. **セキュリティテスト**: 認証、アクセス制御のテスト

### テストフレームワーク

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "@types/jest": "^29.5.11"
  }
}
```

### カバレッジ目標

- **全体**: 80%以上
- **重要モジュール**: 90%以上
  - Protocol Layer
  - Character Conversion Layer
  - Authentication Layer

---

## ユニットテスト

### 1. Protocol Layer

#### test/unit/protocol/buffer-address.test.js

```javascript
const BufferAddress = require('../../../src/protocol/buffer-address');

describe('BufferAddress', () => {
  describe('fromRowCol', () => {
    test('should convert (0,0) to 0', () => {
      expect(BufferAddress.fromRowCol(0, 0)).toBe(0);
    });
    
    test('should convert (0,79) to 79', () => {
      expect(BufferAddress.fromRowCol(0, 79)).toBe(79);
    });
    
    test('should convert (1,0) to 80', () => {
      expect(BufferAddress.fromRowCol(1, 0)).toBe(80);
    });
    
    test('should convert (23,79) to 1919', () => {
      expect(BufferAddress.fromRowCol(23, 79)).toBe(1919);
    });
  });
  
  describe('toRowCol', () => {
    test('should convert 0 to (0,0)', () => {
      expect(BufferAddress.toRowCol(0)).toEqual({ row: 0, col: 0 });
    });
    
    test('should convert 79 to (0,79)', () => {
      expect(BufferAddress.toRowCol(79)).toEqual({ row: 0, col: 79 });
    });
    
    test('should convert 80 to (1,0)', () => {
      expect(BufferAddress.toRowCol(80)).toEqual({ row: 1, col: 0 });
    });
    
    test('should convert 1919 to (23,79)', () => {
      expect(BufferAddress.toRowCol(1919)).toEqual({ row: 23, col: 79 });
    });
  });
  
  describe('encode/decode', () => {
    test('should encode and decode address 0', () => {
      const encoded = BufferAddress.encode(0);
      const decoded = BufferAddress.decode(Buffer.from(encoded));
      expect(decoded).toBe(0);
    });
    
    test('should encode and decode address 1919', () => {
      const encoded = BufferAddress.encode(1919);
      const decoded = BufferAddress.decode(Buffer.from(encoded));
      expect(decoded).toBe(1919);
    });
    
    test('should encode and decode random addresses', () => {
      for (let i = 0; i < 100; i++) {
        const addr = Math.floor(Math.random() * 1920);
        const encoded = BufferAddress.encode(addr);
        const decoded = BufferAddress.decode(Buffer.from(encoded));
        expect(decoded).toBe(addr);
      }
    });
  });
});
```

#### test/unit/protocol/field-attribute.test.js

```javascript
const FieldAttribute = require('../../../src/protocol/field-attribute');

describe('FieldAttribute', () => {
  describe('encode', () => {
    test('should encode unprotected field', () => {
      const attr = {
        protected: false,
        numeric: false,
        hidden: false,
        intensified: false,
        detectable: false,
        modified: false
      };
      expect(FieldAttribute.encode(attr)).toBe(0x00);
    });
    
    test('should encode protected field', () => {
      const attr = {
        protected: true,
        numeric: false,
        hidden: false,
        intensified: false,
        detectable: false,
        modified: false
      };
      expect(FieldAttribute.encode(attr)).toBe(0x20);
    });
    
    test('should encode hidden field', () => {
      const attr = {
        protected: false,
        numeric: false,
        hidden: true,
        intensified: false,
        detectable: false,
        modified: false
      };
      expect(FieldAttribute.encode(attr)).toBe(0x0C);
    });
    
    test('should encode modified field', () => {
      const attr = {
        protected: false,
        numeric: false,
        hidden: false,
        intensified: false,
        detectable: false,
        modified: true
      };
      expect(FieldAttribute.encode(attr)).toBe(0x01);
    });
  });
  
  describe('decode', () => {
    test('should decode unprotected field', () => {
      const decoded = FieldAttribute.decode(0x00);
      expect(decoded.protected).toBe(false);
      expect(decoded.numeric).toBe(false);
      expect(decoded.hidden).toBe(false);
      expect(decoded.modified).toBe(false);
    });
    
    test('should decode protected field', () => {
      const decoded = FieldAttribute.decode(0x20);
      expect(decoded.protected).toBe(true);
    });
    
    test('should decode hidden field', () => {
      const decoded = FieldAttribute.decode(0x0C);
      expect(decoded.hidden).toBe(true);
    });
  });
  
  describe('encode/decode round-trip', () => {
    test('should preserve all attributes', () => {
      const original = {
        protected: true,
        numeric: true,
        hidden: false,
        intensified: true,
        detectable: false,
        modified: true
      };
      
      const encoded = FieldAttribute.encode(original);
      const decoded = FieldAttribute.decode(encoded);
      
      expect(decoded.protected).toBe(original.protected);
      expect(decoded.numeric).toBe(original.numeric);
      expect(decoded.hidden).toBe(original.hidden);
      expect(decoded.intensified).toBe(original.intensified);
      expect(decoded.modified).toBe(original.modified);
    });
  });
});
```

#### test/unit/protocol/parser.test.js

```javascript
const DataStreamParser = require('../../../src/protocol/parser');
const { AID, Orders } = require('../../../src/protocol/data-stream');
const BufferAddress = require('../../../src/protocol/buffer-address');

describe('DataStreamParser', () => {
  let parser;
  
  beforeEach(() => {
    parser = new DataStreamParser();
  });
  
  test('should parse Enter key with no data', () => {
    const data = Buffer.from([
      AID.ENTER,
      0x40, 0x40  // Cursor at (0,0)
    ]);
    
    const result = parser.parse(data);
    
    expect(result.aid).toBe(AID.ENTER);
    expect(result.cursor).toEqual({ row: 0, col: 0 });
    expect(result.fields).toHaveLength(0);
  });
  
  test('should parse field data', () => {
    const data = Buffer.from([
      AID.ENTER,
      0x40, 0x40,  // Cursor at (0,0)
      Orders.SBA,
      0x40, 0x50,  // Address (0,16)
      0xC8, 0xC5, 0xD3, 0xD3, 0xD6  // "HELLO" in EBCDIC
    ]);
    
    const result = parser.parse(data);
    
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].data).toBe('HELLO');
  });
});
```

### 2. Character Conversion Layer

#### test/unit/charset/converter.test.js

```javascript
const CharsetConverter = require('../../../src/charset/converter');

describe('CharsetConverter', () => {
  let converter;
  
  beforeEach(() => {
    converter = new CharsetConverter();
  });
  
  describe('ASCII conversion', () => {
    test('should convert ASCII characters', () => {
      const utf8 = 'Hello World';
      const ebcdic = converter.utf8ToEbcdic(utf8);
      const result = converter.ebcdicToUtf8(ebcdic);
      expect(result).toBe(utf8);
    });
    
    test('should convert numbers', () => {
      const utf8 = '0123456789';
      const ebcdic = converter.utf8ToEbcdic(utf8);
      const result = converter.ebcdicToUtf8(ebcdic);
      expect(result).toBe(utf8);
    });
    
    test('should convert special characters', () => {
      const utf8 = '!@#$%^&*()';
      const ebcdic = converter.utf8ToEbcdic(utf8);
      const result = converter.ebcdicToUtf8(ebcdic);
      expect(result).toBe(utf8);
    });
  });
  
  describe('Japanese conversion', () => {
    test('should detect Japanese characters', () => {
      expect(converter.containsJapanese('こんにちは')).toBe(true);
      expect(converter.containsJapanese('Hello')).toBe(false);
      expect(converter.containsJapanese('Hello こんにちは')).toBe(true);
    });
    
    test('should get character width', () => {
      expect(converter.getCharWidth('A')).toBe(1);
      expect(converter.getCharWidth('あ')).toBe(2);
      expect(converter.getCharWidth('漢')).toBe(2);
    });
  });
});
```

### 3. Screen Buffer Manager

#### test/unit/screen/buffer.test.js

```javascript
const ScreenBuffer = require('../../../src/screen/buffer');

describe('ScreenBuffer', () => {
  let buffer;
  
  beforeEach(() => {
    buffer = new ScreenBuffer(24, 80);
  });
  
  test('should initialize with correct dimensions', () => {
    expect(buffer.rows).toBe(24);
    expect(buffer.cols).toBe(80);
  });
  
  test('should write character at position', () => {
    buffer.writeChar(0, 0, 'A');
    const cell = buffer.getCell(0, 0);
    expect(cell.char).toBe('A');
    expect(cell.modified).toBe(true);
  });
  
  test('should write string at position', () => {
    buffer.writeString(0, 0, 'Hello');
    expect(buffer.getCell(0, 0).char).toBe('H');
    expect(buffer.getCell(0, 1).char).toBe('e');
    expect(buffer.getCell(0, 2).char).toBe('l');
    expect(buffer.getCell(0, 3).char).toBe('l');
    expect(buffer.getCell(0, 4).char).toBe('o');
  });
  
  test('should clear buffer', () => {
    buffer.writeString(0, 0, 'Hello');
    buffer.clear();
    expect(buffer.getCell(0, 0).char).toBe(' ');
  });
  
  test('should track cursor position', () => {
    buffer.setCursor(5, 10);
    const cursor = buffer.getCursor();
    expect(cursor.row).toBe(5);
    expect(cursor.col).toBe(10);
  });
  
  test('should get modified regions', () => {
    buffer.writeString(0, 0, 'Hello');
    buffer.writeString(1, 10, 'World');
    
    const regions = buffer.getModifiedRegions();
    expect(regions).toHaveLength(2);
    expect(regions[0].row).toBe(0);
    expect(regions[0].startCol).toBe(0);
    expect(regions[0].endCol).toBe(4);
    expect(regions[1].row).toBe(1);
    expect(regions[1].startCol).toBe(10);
    expect(regions[1].endCol).toBe(14);
  });
});
```

---

## 統合テスト

### 1. 接続テスト

#### test/integration/connection-test.js

```javascript
const net = require('net');
const TelnetServer = require('../../src/network/telnet-server');

describe('Connection Integration Test', () => {
  let server;
  let client;
  
  beforeAll(async () => {
    server = new TelnetServer({ port: 2323 });
    await server.start();
  });
  
  afterAll(async () => {
    await server.stop();
  });
  
  afterEach(() => {
    if (client) {
      client.destroy();
      client = null;
    }
  });
  
  test('should accept connection', (done) => {
    client = net.connect(2323, 'localhost', () => {
      expect(client.readyState).toBe('open');
      done();
    });
  });
  
  test('should negotiate terminal type', (done) => {
    client = net.connect(2323, 'localhost');
    
    const IAC = 255;
    const DO = 253;
    const WILL = 251;
    const TERMINAL_TYPE = 24;
    
    client.on('data', (data) => {
      // Server should request terminal type
      if (data[0] === IAC && data[1] === DO && data[2] === TERMINAL_TYPE) {
        // Respond with WILL
        client.write(Buffer.from([IAC, WILL, TERMINAL_TYPE]));
        done();
      }
    });
  });
  
  test('should reject connection when max connections reached', async () => {
    const clients = [];
    
    // Create max connections
    for (let i = 0; i < 2; i++) {
      const c = net.connect(2323, 'localhost');
      clients.push(c);
      await new Promise(resolve => c.on('connect', resolve));
    }
    
    // Try to create one more
    const extraClient = net.connect(2323, 'localhost');
    
    await new Promise((resolve) => {
      extraClient.on('close', () => {
        resolve();
      });
    });
    
    // Cleanup
    clients.forEach(c => c.destroy());
  });
});
```

### 2. 認証テスト

#### test/integration/auth-test.js

```javascript
const PAMAuthenticator = require('../../src/auth/pam-auth');

describe('Authentication Integration Test', () => {
  let authenticator;
  
  beforeAll(() => {
    authenticator = new PAMAuthenticator();
  });
  
  test('should authenticate valid user', async () => {
    // Note: This test requires a test user to be set up
    const result = await authenticator.authenticate('testuser', 'testpass');
    expect(result.success).toBe(true);
    expect(result.userContext).toBeDefined();
    expect(result.userContext.username).toBe('testuser');
  });
  
  test('should reject invalid password', async () => {
    await expect(
      authenticator.authenticate('testuser', 'wrongpass')
    ).rejects.toThrow('Authentication failed');
  });
  
  test('should reject non-existent user', async () => {
    await expect(
      authenticator.authenticate('nonexistent', 'password')
    ).rejects.toThrow('Authentication failed');
  });
});
```

### 3. シェル統合テスト

#### test/integration/shell-test.js

```javascript
const PTYManager = require('../../src/pty/pty-manager');

describe('Shell Integration Test', () => {
  let ptyManager;
  let pty;
  
  beforeAll(() => {
    ptyManager = new PTYManager();
  });
  
  afterEach(() => {
    if (pty) {
      pty.close();
      pty = null;
    }
  });
  
  test('should spawn shell', async () => {
    pty = ptyManager.createPTY({
      shell: '/bin/bash',
      rows: 24,
      cols: 80
    });
    
    expect(pty).toBeDefined();
    
    // Wait for shell prompt
    await new Promise((resolve) => {
      pty.onData((data) => {
        if (data.includes('$') || data.includes('#')) {
          resolve();
        }
      });
    });
  });
  
  test('should execute command', async () => {
    pty = ptyManager.createPTY({
      shell: '/bin/bash',
      rows: 24,
      cols: 80
    });
    
    let output = '';
    
    pty.onData((data) => {
      output += data;
    });
    
    // Wait for prompt
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Execute command
    pty.write('echo "Hello World"\n');
    
    // Wait for output
    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(output).toContain('Hello World');
  });
});
```

---

## E2Eテスト

### test/e2e/full-session-test.js

```javascript
const net = require('net');
const TelnetServer = require('../../src/network/telnet-server');
const SessionManager = require('../../src/auth/session');

describe('Full Session E2E Test', () => {
  let server;
  let sessionManager;
  let client;
  
  beforeAll(async () => {
    server = new TelnetServer({ port: 2323 });
    sessionManager = new SessionManager();
    await server.start();
  });
  
  afterAll(async () => {
    await server.stop();
  });
  
  afterEach(() => {
    if (client) {
      client.destroy();
      client = null;
    }
  });
  
  test('complete login and command execution flow', async () => {
    client = net.connect(2323, 'localhost');
    
    // 1. Connect
    await new Promise(resolve => client.on('connect', resolve));
    
    // 2. Negotiate (simplified)
    // ... Telnet negotiation ...
    
    // 3. Receive login screen
    let receivedLoginScreen = false;
    client.on('data', (data) => {
      if (data.includes('Login') || data.includes('Username')) {
        receivedLoginScreen = true;
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(receivedLoginScreen).toBe(true);
    
    // 4. Send credentials
    // ... Send username and password ...
    
    // 5. Receive shell prompt
    // ... Wait for prompt ...
    
    // 6. Execute command
    // ... Send command ...
    
    // 7. Receive output
    // ... Verify output ...
  });
});
```

---

## パフォーマンステスト

### test/performance/load-test.js

```javascript
const net = require('net');
const TelnetServer = require('../../src/network/telnet-server');

describe('Performance Test', () => {
  let server;
  
  beforeAll(async () => {
    server = new TelnetServer({ port: 2323, maxConnections: 10 });
    await server.start();
  });
  
  afterAll(async () => {
    await server.stop();
  });
  
  test('should handle multiple concurrent connections', async () => {
    const connections = [];
    const startTime = Date.now();
    
    // Create 5 concurrent connections
    for (let i = 0; i < 5; i++) {
      const client = net.connect(2323, 'localhost');
      connections.push(client);
      await new Promise(resolve => client.on('connect', resolve));
    }
    
    const connectTime = Date.now() - startTime;
    
    // All connections should be established within 1 second
    expect(connectTime).toBeLessThan(1000);
    
    // Cleanup
    connections.forEach(c => c.destroy());
  });
  
  test('should respond to input within 100ms', async () => {
    const client = net.connect(2323, 'localhost');
    await new Promise(resolve => client.on('connect', resolve));
    
    // ... Complete negotiation and login ...
    
    const startTime = Date.now();
    
    // Send input
    client.write('test input\n');
    
    // Wait for response
    await new Promise((resolve) => {
      client.on('data', () => {
        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(100);
        resolve();
      });
    });
    
    client.destroy();
  });
});
```

---

## テスト環境

### 開発環境

```bash
# Node.js
node --version  # v18.0.0以上

# テスト実行
npm test

# カバレッジ
npm run test:coverage

# 特定のテストのみ実行
npm test -- test/unit/protocol

# ウォッチモード
npm run test:watch
```

### CI/CD環境

#### .github/workflows/test.yml

```yaml
name: Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run tests
      run: npm test
    
    - name: Generate coverage report
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
```

### テストユーザーのセットアップ

```bash
#!/bin/bash
# scripts/setup-test-user.sh

# テストユーザーを作成
sudo useradd -m -s /bin/bash testuser
echo "testuser:testpass" | sudo chpasswd

# PAM設定
sudo cp config/pam.d/3270d /etc/pam.d/3270d

echo "Test user created: testuser / testpass"
```

---

## テストカバレッジレポート

### Jest設定

#### jest.config.js

```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/protocol/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/charset/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  testMatch: [
    '**/test/**/*.test.js'
  ],
  verbose: true
};
```

---

## マニュアルテスト

### x3270を使用したテスト

```bash
# x3270でサーバーに接続
x3270 localhost:23

# または
c3270 localhost:23
```

### テストシナリオ

#### シナリオ1: ログインテスト

1. x3270を起動してサーバーに接続
2. ログイン画面が表示されることを確認
3. ユーザー名を入力してEnter
4. パスワードを入力してEnter
5. シェルプロンプトが表示されることを確認

#### シナリオ2: コマンド実行テスト

1. ログイン後、`ls -la`を入力してEnter
2. ディレクトリ一覧が表示されることを確認
3. `pwd`を入力してEnter
4. カレントディレクトリが表示されることを確認

#### シナリオ3: 日本語テスト

1. `echo "こんにちは"`を入力してEnter
2. 日本語が正しく表示されることを確認
3. 日本語ファイル名のファイルを作成
4. `ls`で日本語ファイル名が表示されることを確認

#### シナリオ4: PFキーテスト

1. PF1-PF12キーを押す
2. 適切なエスケープシーケンスが送信されることを確認

---

## トラブルシューティング

### よくある問題

#### 1. 接続できない

```bash
# ポートが使用中か確認
sudo netstat -tulpn | grep 23

# ファイアウォール設定を確認
sudo ufw status

# サーバーログを確認
tail -f /var/log/3270d/server.log
```

#### 2. 認証が失敗する

```bash
# PAM設定を確認
cat /etc/pam.d/3270d

# ユーザーが存在するか確認
id testuser

# パスワードをリセット
sudo passwd testuser
```

#### 3. 文字化けする

```bash
# ロケール設定を確認
locale

# LANG環境変数を設定
export LANG=ja_JP.UTF-8
```

---

## 次のステップ

テスト計画が完了しました。最後に実装ガイドラインを作成します：

1. **README.md** - プロジェクト概要とクイックスタート
2. **CONTRIBUTING.md** - 開発ガイドライン