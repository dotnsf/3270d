/**
 * ユーザーコンテキストモジュール
 * 
 * 認証済みユーザーの実行コンテキストを管理します。
 * 環境変数、作業ディレクトリ、権限などを提供します。
 */

const path = require('path');
const logger = require('../logger');

/**
 * UserContextクラス
 * 
 * ユーザーの実行コンテキスト情報を保持します。
 */
class UserContext {
  /**
   * コンストラクタ
   * 
   * @param {Object} session - セッション
   */
  constructor(session) {
    this.session = session;
    this.username = session.username;
    this.uid = session.uid;
    this.gid = session.gid;
    this.home = session.home;
    this.shell = session.shell;
    
    this.cwd = session.home; // 初期作業ディレクトリはホーム
    this.env = this.buildEnvironment();
    
    logger.debug('UserContext created', {
      username: this.username,
      uid: this.uid,
      home: this.home,
      shell: this.shell
    });
  }
  
  /**
   * 環境変数を構築
   * 
   * @returns {Object} 環境変数
   * @private
   */
  buildEnvironment() {
    const env = {
      // ユーザー情報
      USER: this.username,
      LOGNAME: this.username,
      HOME: this.home,
      SHELL: this.shell,
      
      // パス
      PATH: '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin',
      
      // 端末情報
      TERM: 'IBM-3279-2-E',
      LINES: '24',
      COLUMNS: '80',
      
      // ロケール（日本語対応）
      LANG: 'ja_JP.UTF-8',
      LC_ALL: 'ja_JP.UTF-8',
      
      // その他
      PWD: this.cwd,
      OLDPWD: this.home,
      SHLVL: '1',
      
      // 3270固有
      TN3270: '1',
      TN3270_SESSION: this.session.id
    };
    
    // ユーザー固有のパスを追加
    const userBin = path.join(this.home, 'bin');
    const userLocalBin = path.join(this.home, '.local', 'bin');
    env.PATH = `${userLocalBin}:${userBin}:${env.PATH}`;
    
    return env;
  }
  
  /**
   * 環境変数を取得
   * 
   * @returns {Object} 環境変数
   */
  getEnvironment() {
    return { ...this.env };
  }
  
  /**
   * 環境変数を設定
   * 
   * @param {string} key - キー
   * @param {string} value - 値
   */
  setEnvironment(key, value) {
    this.env[key] = value;
    
    logger.debug('Environment variable set', {
      username: this.username,
      key,
      value
    });
  }
  
  /**
   * 環境変数を削除
   * 
   * @param {string} key - キー
   */
  unsetEnvironment(key) {
    delete this.env[key];
    
    logger.debug('Environment variable unset', {
      username: this.username,
      key
    });
  }
  
  /**
   * 作業ディレクトリを取得
   * 
   * @returns {string} 作業ディレクトリ
   */
  getCwd() {
    return this.cwd;
  }
  
  /**
   * 作業ディレクトリを設定
   * 
   * @param {string} dir - ディレクトリパス
   */
  setCwd(dir) {
    const oldCwd = this.cwd;
    this.cwd = dir;
    
    // 環境変数を更新
    this.env.OLDPWD = oldCwd;
    this.env.PWD = dir;
    
    logger.debug('Working directory changed', {
      username: this.username,
      from: oldCwd,
      to: dir
    });
  }
  
  /**
   * PTY用のオプションを取得
   * 
   * @returns {Object} PTYオプション
   */
  getPtyOptions() {
    return {
      name: this.env.TERM,
      cols: parseInt(this.env.COLUMNS, 10),
      rows: parseInt(this.env.LINES, 10),
      cwd: this.cwd,
      env: this.env,
      uid: this.uid,
      gid: this.gid
    };
  }
  
  /**
   * シェルコマンドを取得
   * 
   * @returns {string} シェルパス
   */
  getShell() {
    return this.shell;
  }
  
  /**
   * ホームディレクトリを取得
   * 
   * @returns {string} ホームディレクトリ
   */
  getHome() {
    return this.home;
  }
  
  /**
   * ユーザーIDを取得
   * 
   * @returns {number} ユーザーID
   */
  getUid() {
    return this.uid;
  }
  
  /**
   * グループIDを取得
   * 
   * @returns {number} グループID
   */
  getGid() {
    return this.gid;
  }
  
  /**
   * ユーザー名を取得
   * 
   * @returns {string} ユーザー名
   */
  getUsername() {
    return this.username;
  }
  
  /**
   * セッションを取得
   * 
   * @returns {Session} セッション
   */
  getSession() {
    return this.session;
  }
  
  /**
   * コンテキスト情報を取得
   * 
   * @returns {Object} コンテキスト情報
   */
  getInfo() {
    return {
      username: this.username,
      uid: this.uid,
      gid: this.gid,
      home: this.home,
      shell: this.shell,
      cwd: this.cwd,
      sessionId: this.session.id
    };
  }
  
  /**
   * コンテキスト情報を文字列化
   * 
   * @returns {string} コンテキスト情報
   */
  toString() {
    return `UserContext(username=${this.username}, uid=${this.uid}, ` +
           `home=${this.home}, cwd=${this.cwd}, ` +
           `sessionId=${this.session.id})`;
  }
}

module.exports = UserContext;

// Made with Bob
