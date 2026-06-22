/**
 * セッション管理モジュール
 * 
 * 認証済みユーザーのセッション情報を管理します。
 * セッションID、ユーザー情報、タイムスタンプ、アクティビティ追跡を提供します。
 */

const crypto = require('crypto');
const logger = require('../logger');

/**
 * Sessionクラス
 * 
 * 認証済みユーザーのセッション情報を保持し、管理します。
 */
class Session {
  /**
   * コンストラクタ
   * 
   * @param {Object} options - セッションオプション
   * @param {string} options.username - ユーザー名
   * @param {number} options.uid - ユーザーID
   * @param {number} options.gid - グループID
   * @param {string} options.home - ホームディレクトリ
   * @param {string} options.shell - シェル
   * @param {string} options.connectionId - 接続ID
   */
  constructor(options) {
    this.id = this.generateSessionId();
    this.username = options.username;
    this.uid = options.uid;
    this.gid = options.gid;
    this.home = options.home;
    this.shell = options.shell;
    this.connectionId = options.connectionId;
    
    this.createdAt = new Date();
    this.lastActivityAt = new Date();
    this.activityCount = 0;
    
    this.metadata = {};
    this.destroyed = false;
    
    logger.info('Session created', {
      sessionId: this.id,
      username: this.username,
      uid: this.uid,
      connectionId: this.connectionId
    });
  }
  
  /**
   * セッションIDを生成
   * 
   * @returns {string} セッションID
   * @private
   */
  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }
  
  /**
   * アクティビティを記録
   * 
   * セッションの最終アクティビティ時刻を更新します。
   */
  recordActivity() {
    if (this.destroyed) {
      logger.warn('Attempted to record activity on destroyed session', {
        sessionId: this.id,
        username: this.username
      });
      return;
    }
    
    this.lastActivityAt = new Date();
    this.activityCount++;
    
    logger.debug('Session activity recorded', {
      sessionId: this.id,
      username: this.username,
      activityCount: this.activityCount
    });
  }
  
  /**
   * セッションがアクティブか確認
   * 
   * @param {number} timeoutMs - タイムアウト時間（ミリ秒）
   * @returns {boolean} アクティブな場合true
   */
  isActive(timeoutMs = 3600000) { // デフォルト: 1時間
    if (this.destroyed) {
      return false;
    }
    
    const now = Date.now();
    const lastActivity = this.lastActivityAt.getTime();
    const elapsed = now - lastActivity;
    
    return elapsed < timeoutMs;
  }
  
  /**
   * セッションの経過時間を取得
   * 
   * @returns {number} 経過時間（ミリ秒）
   */
  getElapsedTime() {
    const now = Date.now();
    const created = this.createdAt.getTime();
    return now - created;
  }
  
  /**
   * 最終アクティビティからの経過時間を取得
   * 
   * @returns {number} 経過時間（ミリ秒）
   */
  getIdleTime() {
    const now = Date.now();
    const lastActivity = this.lastActivityAt.getTime();
    return now - lastActivity;
  }
  
  /**
   * メタデータを設定
   * 
   * @param {string} key - キー
   * @param {*} value - 値
   */
  setMetadata(key, value) {
    if (this.destroyed) {
      logger.warn('Attempted to set metadata on destroyed session', {
        sessionId: this.id,
        username: this.username,
        key
      });
      return;
    }
    
    this.metadata[key] = value;
    
    logger.debug('Session metadata set', {
      sessionId: this.id,
      username: this.username,
      key
    });
  }
  
  /**
   * メタデータを取得
   * 
   * @param {string} key - キー
   * @returns {*} 値
   */
  getMetadata(key) {
    return this.metadata[key];
  }
  
  /**
   * メタデータを削除
   * 
   * @param {string} key - キー
   */
  deleteMetadata(key) {
    delete this.metadata[key];
    
    logger.debug('Session metadata deleted', {
      sessionId: this.id,
      username: this.username,
      key
    });
  }
  
  /**
   * セッション情報を取得
   * 
   * @returns {Object} セッション情報
   */
  getInfo() {
    return {
      id: this.id,
      username: this.username,
      uid: this.uid,
      gid: this.gid,
      home: this.home,
      shell: this.shell,
      connectionId: this.connectionId,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      activityCount: this.activityCount,
      elapsedTime: this.getElapsedTime(),
      idleTime: this.getIdleTime(),
      destroyed: this.destroyed
    };
  }
  
  /**
   * セッションを破棄
   * 
   * セッションを無効化し、リソースをクリーンアップします。
   */
  destroy() {
    if (this.destroyed) {
      logger.warn('Session already destroyed', {
        sessionId: this.id,
        username: this.username
      });
      return;
    }
    
    logger.info('Destroying session', {
      sessionId: this.id,
      username: this.username,
      elapsedTime: this.getElapsedTime(),
      activityCount: this.activityCount
    });
    
    this.destroyed = true;
    this.metadata = {};
  }
  
  /**
   * セッションが破棄されているか確認
   * 
   * @returns {boolean} 破棄されている場合true
   */
  isDestroyed() {
    return this.destroyed;
  }
  
  /**
   * セッション情報を文字列化
   * 
   * @returns {string} セッション情報
   */
  toString() {
    return `Session(id=${this.id}, username=${this.username}, ` +
           `uid=${this.uid}, connectionId=${this.connectionId}, ` +
           `elapsed=${this.getElapsedTime()}ms, ` +
           `idle=${this.getIdleTime()}ms, ` +
           `activities=${this.activityCount}, ` +
           `destroyed=${this.destroyed})`;
  }
}

/**
 * SessionManagerクラス
 * 
 * 複数のセッションを管理します。
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.sessionsByUsername = new Map();
    this.sessionsByConnection = new Map();
    
    logger.info('SessionManager initialized');
  }
  
  /**
   * セッションを追加
   * 
   * @param {Session} session - セッション
   */
  addSession(session) {
    this.sessions.set(session.id, session);
    
    // ユーザー名でインデックス
    if (!this.sessionsByUsername.has(session.username)) {
      this.sessionsByUsername.set(session.username, new Set());
    }
    this.sessionsByUsername.get(session.username).add(session.id);
    
    // 接続IDでインデックス
    this.sessionsByConnection.set(session.connectionId, session.id);
    
    logger.info('Session added to manager', {
      sessionId: session.id,
      username: session.username,
      totalSessions: this.sessions.size
    });
  }
  
  /**
   * セッションを取得
   * 
   * @param {string} sessionId - セッションID
   * @returns {Session|null} セッション
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }
  
  /**
   * 接続IDからセッションを取得
   * 
   * @param {string} connectionId - 接続ID
   * @returns {Session|null} セッション
   */
  getSessionByConnection(connectionId) {
    const sessionId = this.sessionsByConnection.get(connectionId);
    return sessionId ? this.getSession(sessionId) : null;
  }
  
  /**
   * ユーザー名からセッションを取得
   * 
   * @param {string} username - ユーザー名
   * @returns {Session[]} セッション配列
   */
  getSessionsByUsername(username) {
    const sessionIds = this.sessionsByUsername.get(username);
    if (!sessionIds) {
      return [];
    }
    
    return Array.from(sessionIds)
      .map(id => this.getSession(id))
      .filter(session => session !== null);
  }
  
  /**
   * セッションを削除
   * 
   * @param {string} sessionId - セッションID
   */
  removeSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      logger.warn('Attempted to remove non-existent session', { sessionId });
      return;
    }
    
    // セッションを破棄
    session.destroy();
    
    // インデックスから削除
    this.sessions.delete(sessionId);
    
    const userSessions = this.sessionsByUsername.get(session.username);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.sessionsByUsername.delete(session.username);
      }
    }
    
    this.sessionsByConnection.delete(session.connectionId);
    
    logger.info('Session removed from manager', {
      sessionId,
      username: session.username,
      totalSessions: this.sessions.size
    });
  }
  
  /**
   * すべてのセッションを取得
   * 
   * @returns {Session[]} セッション配列
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }
  
  /**
   * アクティブなセッション数を取得
   * 
   * @param {number} timeoutMs - タイムアウト時間（ミリ秒）
   * @returns {number} アクティブなセッション数
   */
  getActiveSessionCount(timeoutMs = 3600000) {
    return this.getAllSessions()
      .filter(session => session.isActive(timeoutMs))
      .length;
  }
  
  /**
   * 非アクティブなセッションをクリーンアップ
   * 
   * @param {number} timeoutMs - タイムアウト時間（ミリ秒）
   * @returns {number} クリーンアップされたセッション数
   */
  cleanupInactiveSessions(timeoutMs = 3600000) {
    const inactiveSessions = this.getAllSessions()
      .filter(session => !session.isActive(timeoutMs));
    
    inactiveSessions.forEach(session => {
      logger.info('Cleaning up inactive session', {
        sessionId: session.id,
        username: session.username,
        idleTime: session.getIdleTime()
      });
      
      this.removeSession(session.id);
    });
    
    return inactiveSessions.length;
  }
  
  /**
   * すべてのセッションをクリーンアップ
   */
  cleanup() {
    logger.info('Cleaning up all sessions', {
      totalSessions: this.sessions.size
    });
    
    this.getAllSessions().forEach(session => {
      this.removeSession(session.id);
    });
    
    this.sessions.clear();
    this.sessionsByUsername.clear();
    this.sessionsByConnection.clear();
  }
}

module.exports = Session;
module.exports.SessionManager = SessionManager;

// Made with Bob
