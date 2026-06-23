/**
 * 認証処理モジュール
 * 
 * ユーザー認証のメインロジックを提供します。
 * PAM認証、セッション管理、ログイン画面の制御を行います。
 */

const logger = require('../logger');
const PAMAuth = require('./pam-auth');
const Session = require('./session');
const DataStreamGenerator = require('../protocol/generator');
const Parser = require('../protocol/parser');
const { AID } = require('../protocol/data-stream');

/**
 * 認証状態
 */
const AuthState = {
  INITIAL: 'initial',           // 初期状態
  LOGIN_SCREEN: 'login_screen', // ログイン画面表示中
  AUTHENTICATING: 'authenticating', // 認証処理中
  AUTHENTICATED: 'authenticated',   // 認証済み
  FAILED: 'failed'              // 認証失敗
};

/**
 * Authenticatorクラス
 * 
 * 3270ログイン画面の表示、ユーザー入力の処理、PAM認証の実行を管理します。
 */
class Authenticator {
  /**
   * コンストラクタ
   * 
   * @param {Object} connection - Connection インスタンス
   * @param {Object} options - オプション
   * @param {number} options.maxAttempts - 最大認証試行回数（デフォルト: 3）
   * @param {number} options.timeout - 認証タイムアウト（ミリ秒、デフォルト: 300000 = 5分）
   */
  constructor(connection, options = {}) {
    this.connection = connection;
    this.state = AuthState.INITIAL;
    this.maxAttempts = options.maxAttempts || 3;
    this.timeout = options.timeout || 300000; // 5分
    this.attempts = 0;
    this.username = null;
    this.session = null;
    this.timeoutTimer = null;
    
    this.pamAuth = new PAMAuth();
    
    logger.debug('Authenticator initialized', {
      connectionId: connection.id,
      maxAttempts: this.maxAttempts,
      timeout: this.timeout
    });
  }
  
  /**
   * 認証プロセスを開始
   * 
   * ログイン画面を表示し、認証タイムアウトタイマーを開始します。
   * 
   * @returns {Promise<Buffer>} ログイン画面の3270データストリーム
   */
  async start() {
    logger.info('Starting authentication process', {
      connectionId: this.connection.id
    });
    
    this.state = AuthState.LOGIN_SCREEN;
    this.startTimeout();
    
    // ログイン画面を生成
    const generator = new DataStreamGenerator();
    const loginScreen = generator.generateLoginScreen();
    
    return loginScreen;
  }
  
  /**
   * ユーザー入力を処理
   * 
   * 3270データストリームを解析し、ユーザー名とパスワードを抽出して認証を実行します。
   * 
   * @param {Buffer} data - 3270データストリーム
   * @returns {Promise<Object>} 処理結果
   * @returns {boolean} result.success - 認証成功フラグ
   * @returns {Buffer} result.response - 応答データストリーム
   * @returns {Session} result.session - セッション（認証成功時）
   * @returns {string} result.error - エラーメッセージ（失敗時）
   */
  async handleInput(data) {
    if (this.state !== AuthState.LOGIN_SCREEN) {
      logger.warn('Invalid state for input handling', {
        connectionId: this.connection.id,
        state: this.state
      });
      return {
        success: false,
        error: 'Invalid authentication state'
      };
    }
    
    try {
      // データストリームを解析
      const parsed = Parser.parse(data);
      
      logger.debug('Parsed authentication input', {
        connectionId: this.connection.id,
        aid: parsed.aid,
        cursorAddress: parsed.cursorAddress,
        fieldCount: parsed.fields.length
      });
      
      // Enterキー以外は無視
      if (parsed.aid !== AID.ENTER) {
        logger.debug('Non-Enter AID received, ignoring', {
          connectionId: this.connection.id,
          aid: parsed.aid
        });
        return {
          success: false,
          response: Generator.generateLoginScreen(this.attempts)
        };
      }
      
      // フィールドからユーザー名とパスワードを抽出
      // フィールド0: ユーザー名、フィールド1: パスワード
      const username = parsed.fields[0]?.value?.trim() || '';
      const password = parsed.fields[1]?.value?.trim() || '';
      
      if (!username || !password) {
        logger.warn('Empty username or password', {
          connectionId: this.connection.id,
          hasUsername: !!username,
          hasPassword: !!password
        });
        
        this.attempts++;
        
        if (this.attempts >= this.maxAttempts) {
          return await this.handleMaxAttemptsExceeded();
        }
        
        return {
          success: false,
          response: Generator.generateLoginScreen(this.attempts, 'ユーザー名とパスワードを入力してください')
        };
      }
      
      // 認証を実行
      return await this.authenticate(username, password);
      
    } catch (error) {
      logger.error('Error handling authentication input', {
        connectionId: this.connection.id,
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message,
        response: Generator.generateErrorScreen('認証処理中にエラーが発生しました')
      };
    }
  }
  
  /**
   * 認証を実行
   * 
   * PAMを使用してユーザー認証を行います。
   * 
   * @param {string} username - ユーザー名
   * @param {string} password - パスワード
   * @returns {Promise<Object>} 認証結果
   * @private
   */
  async authenticate(username, password) {
    this.state = AuthState.AUTHENTICATING;
    this.username = username;
    
    logger.info('Attempting authentication', {
      connectionId: this.connection.id,
      username: username,
      attempt: this.attempts + 1,
      maxAttempts: this.maxAttempts
    });
    
    try {
      // PAM認証を実行
      const authResult = await this.pamAuth.authenticate(username, password);
      
      if (authResult.success) {
        // 認証成功
        this.state = AuthState.AUTHENTICATED;
        this.stopTimeout();
        
        // セッションを作成
        this.session = new Session({
          username: username,
          uid: authResult.uid,
          gid: authResult.gid,
          home: authResult.home,
          shell: authResult.shell,
          connectionId: this.connection.id
        });
        
        logger.info('Authentication successful', {
          connectionId: this.connection.id,
          username: username,
          sessionId: this.session.id
        });
        
        // ウェルカム画面を生成
        const welcomeScreen = Generator.generateWelcomeScreen(username);
        
        return {
          success: true,
          response: welcomeScreen,
          session: this.session
        };
        
      } else {
        // 認証失敗
        this.attempts++;
        
        logger.warn('Authentication failed', {
          connectionId: this.connection.id,
          username: username,
          attempt: this.attempts,
          maxAttempts: this.maxAttempts,
          reason: authResult.error
        });
        
        if (this.attempts >= this.maxAttempts) {
          return await this.handleMaxAttemptsExceeded();
        }
        
        this.state = AuthState.LOGIN_SCREEN;
        
        return {
          success: false,
          response: Generator.generateLoginScreen(
            this.attempts,
            'ユーザー名またはパスワードが正しくありません'
          )
        };
      }
      
    } catch (error) {
      logger.error('Authentication error', {
        connectionId: this.connection.id,
        username: username,
        error: error.message,
        stack: error.stack
      });
      
      this.attempts++;
      
      if (this.attempts >= this.maxAttempts) {
        return await this.handleMaxAttemptsExceeded();
      }
      
      this.state = AuthState.LOGIN_SCREEN;
      
      return {
        success: false,
        error: error.message,
        response: Generator.generateLoginScreen(
          this.attempts,
          '認証処理中にエラーが発生しました'
        )
      };
    }
  }
  
  /**
   * 最大試行回数超過時の処理
   * 
   * @returns {Promise<Object>} 処理結果
   * @private
   */
  async handleMaxAttemptsExceeded() {
    this.state = AuthState.FAILED;
    this.stopTimeout();
    
    logger.warn('Maximum authentication attempts exceeded', {
      connectionId: this.connection.id,
      username: this.username,
      attempts: this.attempts
    });
    
    return {
      success: false,
      error: 'Maximum authentication attempts exceeded',
      response: Generator.generateErrorScreen(
        '認証試行回数が上限に達しました。\n接続を切断します。'
      ),
      disconnect: true
    };
  }
  
  /**
   * 認証タイムアウトタイマーを開始
   * 
   * @private
   */
  startTimeout() {
    this.stopTimeout();
    
    this.timeoutTimer = setTimeout(() => {
      logger.warn('Authentication timeout', {
        connectionId: this.connection.id,
        username: this.username
      });
      
      this.state = AuthState.FAILED;
      this.connection.close();
    }, this.timeout);
  }
  
  /**
   * 認証タイムアウトタイマーを停止
   * 
   * @private
   */
  stopTimeout() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
  
  /**
   * 認証済みかどうかを確認
   * 
   * @returns {boolean} 認証済みの場合true
   */
  isAuthenticated() {
    return this.state === AuthState.AUTHENTICATED && this.session !== null;
  }
  
  /**
   * セッションを取得
   * 
   * @returns {Session|null} セッション
   */
  getSession() {
    return this.session;
  }
  
  /**
   * クリーンアップ
   * 
   * タイマーを停止し、セッションを破棄します。
   */
  cleanup() {
    logger.debug('Cleaning up authenticator', {
      connectionId: this.connection.id,
      username: this.username
    });
    
    this.stopTimeout();
    
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
    
    this.state = AuthState.INITIAL;
  }
}

module.exports = Authenticator;
module.exports.AuthState = AuthState;

// Made with Bob
