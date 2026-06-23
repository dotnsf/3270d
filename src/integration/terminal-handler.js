/**
 * ターミナルハンドラーモジュール
 * 
 * 3270プロトコル、PTY、認証を統合し、
 * 3270端末とLinuxシェル間のデータフローを管理します。
 */

const logger = require('../logger');
const Authenticator = require('../auth/authenticator');
const UserContext = require('../auth/user-context');
const PTYManager = require('../pty/pty-manager');
const ScreenBuffer = require('../screen/buffer');
const Converter = require('../charset/converter');
const DataStreamParser = require('../protocol/parser');
const DataStreamGenerator = require('../protocol/generator');
const { AID, Commands } = require('../protocol/data-stream');

/**
 * ターミナル状態
 */
const TerminalState = {
  AUTHENTICATING: 'authenticating', // 認証中
  READY: 'ready',                   // 準備完了（シェル起動前）
  RUNNING: 'running',               // シェル実行中
  CLOSED: 'closed'                  // 終了
};

/**
 * TerminalHandlerクラス
 * 
 * 3270端末セッションを管理し、認証、PTY、画面バッファを統合します。
 */
class TerminalHandler {
  /**
   * コンストラクタ
   * 
   * @param {Object} connection - Connection インスタンス
   */
  constructor(connection) {
    this.connection = connection;
    this.state = TerminalState.AUTHENTICATING;
    
    this.authenticator = new Authenticator(connection);
    this.userContext = null;
    this.ptyManager = null;
    this.screenBuffer = new ScreenBuffer();
    
    this.lastScreen = null; // 最後に送信した画面内容
    
    logger.info('TerminalHandler created', {
      connectionId: connection.id
    });
  }
  
  /**
   * ターミナルセッションを開始
   * 
   * @returns {Promise<Buffer>} 初期画面データ
   */
  async start() {
    logger.info('Starting terminal session', {
      connectionId: this.connection.id
    });
    
    // 認証プロセスを開始
    const loginScreen = await this.authenticator.start();
    this.lastScreen = loginScreen;
    
    return loginScreen;
  }
  
  /**
   * 3270データを処理
   * 
   * @param {Buffer} data - 3270データストリーム
   * @returns {Promise<Buffer|null>} 応答データストリーム
   */
  async handleData(data) {
    try {
      if (this.state === TerminalState.AUTHENTICATING) {
        return await this.handleAuthenticationData(data);
      } else if (this.state === TerminalState.RUNNING) {
        return await this.handleTerminalData(data);
      } else {
        logger.warn('Received data in invalid state', {
          connectionId: this.connection.id,
          state: this.state
        });
        return null;
      }
    } catch (error) {
      logger.error('Error handling terminal data', {
        connectionId: this.connection.id,
        error: error.message,
        stack: error.stack
      });
      
      const generator = new DataStreamGenerator();
      return generator.generateErrorScreen('データ処理中にエラーが発生しました');
    }
  }
  
  /**
   * 認証データを処理
   * 
   * @param {Buffer} data - 3270データストリーム
   * @returns {Promise<Buffer|null>} 応答データストリーム
   * @private
   */
  async handleAuthenticationData(data) {
    const result = await this.authenticator.handleInput(data);
    
    if (result.success) {
      // 認証成功 - シェルを起動
      logger.info('Authentication successful, starting shell', {
        connectionId: this.connection.id,
        username: result.session.username
      });
      
      this.state = TerminalState.READY;
      
      // ユーザーコンテキストを作成
      this.userContext = new UserContext(result.session);
      
      // PTYを起動
      await this.startShell();
      
      // ウェルカム画面を表示後、シェルに切り替え
      this.lastScreen = result.response;
      
      // 少し待ってからシェル画面に切り替え
      setTimeout(() => {
        this.switchToShell();
      }, 2000);
      
      return result.response;
      
    } else if (result.disconnect) {
      // 接続を切断
      logger.info('Disconnecting due to authentication failure', {
        connectionId: this.connection.id
      });
      
      this.lastScreen = result.response;
      
      // エラー画面を表示後、切断
      setTimeout(() => {
        this.connection.close();
      }, 3000);
      
      return result.response;
      
    } else {
      // 認証失敗 - ログイン画面を再表示
      this.lastScreen = result.response;
      return result.response;
    }
  }
  
  /**
   * ターミナルデータを処理
   * 
   * @param {Buffer} data - 3270データストリーム
   * @returns {Promise<Buffer|null>} 応答データストリーム
   * @private
   */
  async handleTerminalData(data) {
    // データストリームを解析
    const parsed = Parser.parse(data);
    
    logger.debug('Terminal data received', {
      connectionId: this.connection.id,
      aid: parsed.aid,
      cursorAddress: parsed.cursorAddress,
      fieldCount: parsed.fields.length
    });
    
    // AIDに応じて処理
    switch (parsed.aid) {
      case AID.ENTER:
        return await this.handleEnter(parsed);
        
      case AID.CLEAR:
        return await this.handleClear();
        
      case AID.PF3:
        // PF3 = 終了
        return await this.handleExit();
        
      default:
        // その他のAIDは無視
        logger.debug('Ignoring AID', {
          connectionId: this.connection.id,
          aid: parsed.aid
        });
        return null;
    }
  }
  
  /**
   * Enterキーを処理
   * 
   * @param {Object} parsed - 解析済みデータ
   * @returns {Promise<Buffer|null>} 応答データストリーム
   * @private
   */
  async handleEnter(parsed) {
    // 入力フィールドからコマンドを取得
    const command = parsed.fields[0]?.value?.trim() || '';
    
    if (!command) {
      return null;
    }
    
    logger.debug('Command entered', {
      connectionId: this.connection.id,
      command
    });
    
    // PTYにコマンドを送信
    if (this.ptyManager) {
      this.ptyManager.write(command + '\n');
    }
    
    return null;
  }
  
  /**
   * Clearキーを処理
   * 
   * @returns {Promise<Buffer>} 応答データストリーム
   * @private
   */
  async handleClear() {
    logger.debug('Clear key pressed', {
      connectionId: this.connection.id
    });
    
    // 画面をクリア
    this.screenBuffer.clear();
    
    // 画面を再描画
    return this.renderScreen();
  }
  
  /**
   * 終了を処理
   * 
   * @returns {Promise<Buffer>} 応答データストリーム
   * @private
   */
  async handleExit() {
    logger.info('Exit requested', {
      connectionId: this.connection.id
    });
    
    // シェルを終了
    if (this.ptyManager) {
      this.ptyManager.kill();
    }
    
    this.state = TerminalState.CLOSED;
    
    // さようなら画面を表示
    const generator = new DataStreamGenerator();
    const goodbyeScreen = generator.generateWelcomeScreen(
      this.userContext?.getUsername() || 'ユーザー'
    );
    
    // 画面表示後、切断
    setTimeout(() => {
      this.connection.close();
    }, 2000);
    
    return goodbyeScreen;
  }
  
  /**
   * シェルを起動
   * 
   * @returns {Promise<void>}
   * @private
   */
  async startShell() {
    logger.info('Starting shell', {
      connectionId: this.connection.id,
      username: this.userContext.getUsername(),
      shell: this.userContext.getShell()
    });
    
    // PTYマネージャーを作成
    this.ptyManager = new PTYManager();
    
    // PTYオプションを取得
    const ptyOptions = this.userContext.getPtyOptions();
    
    // シェルを起動
    await this.ptyManager.spawn(
      this.userContext.getShell(),
      [],
      ptyOptions
    );
    
    // PTY出力を処理
    this.ptyManager.on('data', (data) => {
      this.handlePtyOutput(data);
    });
    
    // PTY終了を処理
    this.ptyManager.on('exit', (code) => {
      this.handlePtyExit(code);
    });
    
    this.state = TerminalState.RUNNING;
    
    logger.info('Shell started', {
      connectionId: this.connection.id,
      pid: this.ptyManager.getPid()
    });
  }
  
  /**
   * シェル画面に切り替え
   * 
   * @private
   */
  switchToShell() {
    if (this.state !== TerminalState.RUNNING) {
      return;
    }
    
    logger.debug('Switching to shell screen', {
      connectionId: this.connection.id
    });
    
    // 初期画面を送信
    const screen = this.renderScreen();
    this.connection.write(screen);
  }
  
  /**
   * PTY出力を処理
   * 
   * @param {string} data - PTY出力データ
   * @private
   */
  handlePtyOutput(data) {
    logger.debug('PTY output received', {
      connectionId: this.connection.id,
      length: data.length
    });
    
    // UTF-8データを画面バッファに書き込み
    this.screenBuffer.writeString(data);
    
    // 画面を更新
    const screen = this.renderScreen();
    this.connection.write(screen);
  }
  
  /**
   * PTY終了を処理
   * 
   * @param {number} code - 終了コード
   * @private
   */
  handlePtyExit(code) {
    logger.info('PTY exited', {
      connectionId: this.connection.id,
      exitCode: code
    });
    
    this.state = TerminalState.CLOSED;
    
    // 終了メッセージを表示
    const generator = new DataStreamGenerator();
    const exitScreen = generator.generateWelcomeScreen(
      this.userContext?.getUsername() || 'ユーザー'
      `シェルが終了しました (終了コード: ${code})\n接続を切断します。`
    );
    
    this.connection.write(exitScreen);
    
    // 接続を切断
    setTimeout(() => {
      this.connection.close();
    }, 2000);
  }
  
  /**
   * 画面をレンダリング
   * 
   * @returns {Buffer} 3270データストリーム
   * @private
   */
  renderScreen() {
    // 画面バッファの内容を取得
    const content = this.screenBuffer.getContent();
    
    // UTF-8 → EBCDIC変換
    const ebcdicContent = content.map(line => 
      Converter.utf8ToEbcdic(line)
    );
    
    // 3270データストリームを生成
    const generator = new DataStreamGenerator();
    const screen = generator.generateEraseWrite(
      this.screenBuffer
    );
    
    this.lastScreen = screen;
    
    return screen;
  }
  
  /**
   * クリーンアップ
   */
  cleanup() {
    logger.info('Cleaning up terminal handler', {
      connectionId: this.connection.id
    });
    
    // 認証をクリーンアップ
    if (this.authenticator) {
      this.authenticator.cleanup();
    }
    
    // PTYを終了
    if (this.ptyManager) {
      this.ptyManager.kill();
      this.ptyManager = null;
    }
    
    // 画面バッファをクリア
    if (this.screenBuffer) {
      this.screenBuffer.clear();
    }
    
    this.state = TerminalState.CLOSED;
  }
  
  /**
   * 状態を取得
   * 
   * @returns {string} 状態
   */
  getState() {
    return this.state;
  }
  
  /**
   * セッションを取得
   * 
   * @returns {Session|null} セッション
   */
  getSession() {
    return this.authenticator?.getSession() || null;
  }
}

module.exports = TerminalHandler;
module.exports.TerminalState = TerminalState;

// Made with Bob
