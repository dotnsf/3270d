/**
 * 3270 Data Stream Generator
 * 3270データストリームの生成
 */
const { Commands, WCC, Orders } = require('./data-stream');
const BufferAddress = require('./buffer-address');
const FieldAttribute = require('./field-attribute');
const Converter = require('../charset/converter');
const logger = require('../logger');

class DataStreamGenerator {
  constructor() {
    // Telnet IAC and EOR
    this.IAC = 0xFF;
    this.EOR = 0xEF;
    
    // 文字コード変換器
    this.converter = new Converter();
  }

  /**
   * IAC（0xFF）をエスケープ
   * TN3270データストリーム内のIACは2回送信する必要がある
   * @param {Array} stream - データストリーム配列
   * @returns {Buffer} - エスケープ済みバッファ
   */
  escapeIAC(stream) {
    const escaped = [];
    for (let i = 0; i < stream.length; i++) {
      const byte = stream[i];
      escaped.push(byte);
      // IAC（0xFF）の場合、もう一度追加（ただしEORの直前のIACは除く）
      if (byte === this.IAC && i < stream.length - 1 && stream[i + 1] !== this.EOR) {
        escaped.push(this.IAC);
      }
    }
    return Buffer.from(escaped);
  }

  /**
   * Erase/Write コマンドを生成
   * 画面全体をクリアして新しい内容を書き込む
   * @param {ScreenBuffer} screenBuffer - 画面バッファ
   * @returns {Buffer} - 3270データストリーム
   */
  generateEraseWrite(screenBuffer) {
    const stream = [];

    // Command: Erase/Write
    stream.push(Commands.EW);

    // WCC: Reset + Restore Keyboard
    stream.push(WCC.RESET | WCC.RESTORE_KEYBOARD);

    // 画面内容を生成
    this.writeScreenContent(stream, screenBuffer);

    // カーソル位置を設定
    const cursor = screenBuffer.getCursor();
    stream.push(Orders.IC);

    // EOR (End of Record)
    stream.push(this.IAC, this.EOR);

    return Buffer.from(stream);
  }

  /**
   * Write コマンドを生成（差分更新）
   * @param {Array<Object>} changes - 変更リスト
   * @returns {Buffer} - 3270データストリーム
   */
  generateWrite(changes) {
    const stream = [];

    // Command: Write
    stream.push(Commands.W);

    // WCC: Restore Keyboard
    stream.push(WCC.RESTORE_KEYBOARD);

    // 変更箇所を出力
    for (const change of changes) {
      // Set Buffer Address
      stream.push(Orders.SBA);
      const addr = BufferAddress.fromRowCol(change.row, change.startCol);
      stream.push(...BufferAddress.encode(addr));

      // データ
      for (const cell of change.data) {
        if (cell.char && cell.char !== ' ') {
          stream.push(cell.char.charCodeAt(0));
        } else {
          stream.push(0x40); // EBCDIC space
        }
      }
    }

    // EOR
    stream.push(this.IAC, this.EOR);

    return Buffer.from(stream);
  }

  /**
   * Read Modified コマンドを生成
   * @returns {Buffer} - 3270データストリーム
   */
  generateReadModified() {
    const stream = [];

    // Command: Read Modified
    stream.push(Commands.RM);

    // EOR
    stream.push(this.IAC, this.EOR);

    return Buffer.from(stream);
  }

  /**
   * Read Buffer コマンドを生成
   * @returns {Buffer} - 3270データストリーム
   */
  generateReadBuffer() {
    const stream = [];

    // Command: Read Buffer
    stream.push(Commands.RB);

    // EOR
    stream.push(this.IAC, this.EOR);

    return Buffer.from(stream);
  }

  /**
   * 画面内容を書き込み
   * @param {Array} stream - 出力ストリーム
   * @param {ScreenBuffer} screenBuffer - 画面バッファ
   */
  writeScreenContent(stream, screenBuffer) {
    const rows = screenBuffer.rows;
    const cols = screenBuffer.cols;
    let lastAttr = null;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = screenBuffer.getCell(row, col);

        if (!cell) continue;

        // フィールド定義
        if (cell.isField) {
          stream.push(Orders.SF);
          stream.push(FieldAttribute.encode(cell.fieldAttr || FieldAttribute.getDefault()));
          lastAttr = cell.fieldAttr;
          continue;
        }

        // 文字データ
        if (cell.char && cell.char !== ' ') {
          // 位置が変わった場合はSBAを挿入
          if (col === 0 || screenBuffer.getCell(row, col - 1)?.isField) {
            stream.push(Orders.SBA);
            const addr = BufferAddress.fromRowCol(row, col);
            stream.push(...BufferAddress.encode(addr));
          }

          // 文字を追加（ASCIIコード）
          stream.push(cell.char.charCodeAt(0));
        }
      }
    }
  }

  /**
   * ログイン画面を生成
   * @returns {Buffer}
   */
  generateLoginScreen() {
    const stream = [];

    // Command: Erase/Write
    stream.push(Commands.EW);

    // WCC: Reset + Restore Keyboard
    stream.push(WCC.RESET | WCC.RESTORE_KEYBOARD);

    // タイトル (行0, 列30)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(0, 30)));
    this.writeText(stream, 'TN3270 Login');

    // 区切り線 (行2)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(2, 0)));
    this.writeText(stream, '='.repeat(80));

    // ユーザー名ラベル (行5, 列10)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(5, 10)));
    this.writeText(stream, 'Username: ');

    // ユーザー名入力フィールド
    stream.push(Orders.SF);
    stream.push(FieldAttribute.encode(FieldAttribute.getInput()));
    this.writeText(stream, ' '.repeat(20));

    // フィールド終了
    stream.push(Orders.SF);
    stream.push(FieldAttribute.encode(FieldAttribute.getProtected()));

    // パスワードラベル (行7, 列10)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(7, 10)));
    this.writeText(stream, 'Password: ');

    // パスワード入力フィールド（非表示）
    stream.push(Orders.SF);
    stream.push(FieldAttribute.encode(FieldAttribute.getHidden()));
    this.writeText(stream, ' '.repeat(20));

    // フィールド終了
    stream.push(Orders.SF);
    stream.push(FieldAttribute.encode(FieldAttribute.getProtected()));

    // 説明 (行10, 列10)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(10, 10)));
    this.writeText(stream, 'Press Enter to login');

    // 区切り線 (行22)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(22, 0)));
    this.writeText(stream, '='.repeat(80));

    // ステータス行 (行23)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(23, 0)));
    stream.push(Orders.SF);
    stream.push(FieldAttribute.encode(FieldAttribute.getIntensified()));
    this.writeText(stream, 'TN3270 Server v1.0');

    // カーソルをユーザー名フィールドに配置
    stream.push(Orders.IC);

    // EOR
    stream.push(this.IAC, this.EOR);

    return Buffer.from(stream);
  }

  /**
   * ウェルカム画面を生成
   * @param {string} username - ユーザー名
   * @returns {Buffer}
   */
  generateWelcomeScreen(username) {
    const stream = [];

    // Command: Erase/Write
    stream.push(Commands.EW);

    // WCC: Reset + Restore Keyboard
    stream.push(WCC.RESET | WCC.RESTORE_KEYBOARD);

    // タイトル (行0, 列25)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(0, 25)));
    stream.push(Orders.SF);
    stream.push(FieldAttribute.encode(FieldAttribute.getIntensified()));
    this.writeText(stream, 'Welcome to TN3270 Server');

    // ユーザー名 (行2, 列10)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(2, 10)));
    stream.push(Orders.SF);
    stream.push(FieldAttribute.encode(FieldAttribute.getProtected()));
    this.writeText(stream, `Logged in as: ${username}`);

    // メッセージ (行5, 列10)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(5, 10)));
    this.writeText(stream, 'Shell session starting...');

    // EOR
    stream.push(this.IAC, this.EOR);

    return Buffer.from(stream);
  }

  /**
   * エラー画面を生成
   * @param {string} message - エラーメッセージ
   * @returns {Buffer}
   */
  generateErrorScreen(message) {
    const stream = [];

    // Command: Erase/Write
    stream.push(Commands.EW);

    // WCC: Reset + Restore Keyboard + Sound Alarm
    stream.push(WCC.RESET | WCC.RESTORE_KEYBOARD | WCC.SOUND_ALARM);

    // タイトル (行0, 列35)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(0, 35)));
    stream.push(Orders.SF);
    stream.push(FieldAttribute.encode(FieldAttribute.getIntensified()));
    this.writeText(stream, 'ERROR');

    // エラーメッセージ (行5, 列10)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(5, 10)));
    stream.push(Orders.SF);
    stream.push(FieldAttribute.encode(FieldAttribute.getProtected()));
    this.writeText(stream, message);

    // 説明 (行10, 列10)
    stream.push(Orders.SBA);
    stream.push(...BufferAddress.encode(BufferAddress.fromRowCol(10, 10)));
    this.writeText(stream, 'Press Clear to continue');

    // EOR
    stream.push(this.IAC, this.EOR);

    return Buffer.from(stream);
  }

  /**
   * テキストを書き込み（EBCDICに変換）
   * @param {Array} stream - 出力ストリーム
   * @param {string} text - テキスト
   */
  writeText(stream, text) {
    // UTF-8からEBCDICに変換
    const ebcdic = this.converter.utf8ToEbcdic(text);
    for (let i = 0; i < ebcdic.length; i++) {
      stream.push(ebcdic[i]);
    }
  }

  /**
   * データストリームをダンプ（デバッグ用）
   * @param {Buffer} data - データストリーム
   */
  dump(data) {
    logger.debug('=== Generated Data Stream ===');
    logger.debug(`Length: ${data.length}`);
    logger.debug(`Hex: ${data.toString('hex')}`);

    let offset = 0;

    // Command
    if (offset < data.length) {
      const cmd = data[offset++];
      logger.debug(`Command: 0x${cmd.toString(16)}`);
    }

    // WCC
    if (offset < data.length) {
      const wcc = data[offset++];
      logger.debug(`WCC: 0x${wcc.toString(16)}`);
      if (wcc & WCC.RESET) logger.debug('  - RESET');
      if (wcc & WCC.RESTORE_KEYBOARD) logger.debug('  - RESTORE_KEYBOARD');
      if (wcc & WCC.SOUND_ALARM) logger.debug('  - SOUND_ALARM');
    }
  }
}

module.exports = DataStreamGenerator;

// Made with Bob
