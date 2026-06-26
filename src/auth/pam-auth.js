/**
 * PAM認証モジュール
 * 
 * Linux PAM (Pluggable Authentication Modules) を使用したユーザー認証を提供します。
 * node-linux-pam ライブラリを使用してPAMとインターフェースします。
 */

const logger = require('../logger');
const { execSync } = require('child_process');
const fs = require('fs');

/**
 * PAMAuthクラス
 * 
 * PAMを使用したユーザー認証を実行します。
 * node-linux-pamが利用できない場合は、フォールバック実装を使用します。
 */
class PAMAuth {
  constructor() {
    this.pamAvailable = false;
    this.pam = null;
    
    // PAMライブラリの読み込みを試行
    try {
      this.pam = require('authenticate-pam');
      this.pamAvailable = true;
      logger.info('PAM authentication module loaded successfully');
    } catch (error) {
      logger.warn('PAM module not available, using fallback authentication', {
        error: error.message
      });
    }
  }
  
  /**
   * ユーザー認証を実行
   * 
   * @param {string} username - ユーザー名
   * @param {string} password - パスワード
   * @returns {Promise<Object>} 認証結果
   * @returns {boolean} result.success - 認証成功フラグ
   * @returns {number} result.uid - ユーザーID（成功時）
   * @returns {number} result.gid - グループID（成功時）
   * @returns {string} result.home - ホームディレクトリ（成功時）
   * @returns {string} result.shell - シェル（成功時）
   * @returns {string} result.error - エラーメッセージ（失敗時）
   */
  async authenticate(username, password) {
    logger.debug('Authenticating user', { username });
    
    try {
      if (this.pamAvailable) {
        return await this.authenticateWithPAM(username, password);
      } else {
        return await this.authenticateWithFallback(username, password);
      }
    } catch (error) {
      logger.error('Authentication error', {
        username,
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * PAMを使用して認証
   * 
   * @param {string} username - ユーザー名
   * @param {string} password - パスワード
   * @returns {Promise<Object>} 認証結果
   * @private
   */
  async authenticateWithPAM(username, password) {
    return new Promise((resolve) => {
      this.pam.authenticate(username, password, (err) => {
        if (err) {
          logger.warn('PAM authentication failed', {
            username,
            error: err.message
          });
          
          resolve({
            success: false,
            error: err.message
          });
        } else {
          logger.info('PAM authentication successful', { username });
          
          // ユーザー情報を取得
          const userInfo = this.getUserInfo(username);
          
          resolve({
            success: true,
            ...userInfo
          });
        }
      });
    });
  }
  
  /**
   * フォールバック認証（開発/テスト用）
   * 
   * PAMが利用できない場合の代替認証方法。
   * /etc/shadow へのアクセスが必要なため、実運用では使用しないでください。
   * 
   * @param {string} username - ユーザー名
   * @param {string} password - パスワード
   * @returns {Promise<Object>} 認証結果
   * @private
   */
  async authenticateWithFallback(username, password) {
    logger.warn('Using fallback authentication (not recommended for production)', {
      username
    });
    
    try {
      // ユーザーの存在確認
      const userInfo = this.getUserInfo(username);
      
      if (!userInfo) {
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      // 開発環境では簡易的な認証を許可
      // 実運用では必ずPAMを使用してください
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Development mode: allowing authentication without password verification', {
          username
        });
        
        return {
          success: true,
          ...userInfo
        };
      }
      
      // 実運用環境ではPAMが必須
      return {
        success: false,
        error: 'PAM authentication is required in production'
      };
      
    } catch (error) {
      logger.error('Fallback authentication error', {
        username,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * ユーザー情報を取得
   * 
   * /etc/passwd からユーザー情報を読み取ります。
   * 
   * @param {string} username - ユーザー名
   * @returns {Object|null} ユーザー情報
   * @private
   */
  getUserInfo(username) {
    try {
      // getent コマンドでユーザー情報を取得
      const output = execSync(`getent passwd ${username}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      
      if (!output) {
        logger.warn('User not found in passwd database', { username });
        return null;
      }
      
      // passwd エントリをパース
      // フォーマット: username:x:uid:gid:comment:home:shell
      const parts = output.split(':');
      
      if (parts.length < 7) {
        logger.error('Invalid passwd entry format', {
          username,
          entry: output
        });
        return null;
      }
      
      const userInfo = {
        username: parts[0],
        uid: parseInt(parts[2], 10),
        gid: parseInt(parts[3], 10),
        comment: parts[4],
        home: parts[5],
        shell: parts[6]
      };
      
      logger.debug('User info retrieved', {
        username,
        uid: userInfo.uid,
        gid: userInfo.gid,
        home: userInfo.home,
        shell: userInfo.shell
      });
      
      return userInfo;
      
    } catch (error) {
      logger.error('Error retrieving user info', {
        username,
        error: error.message
      });
      
      return null;
    }
  }
  
  /**
   * ユーザーが存在するか確認
   * 
   * @param {string} username - ユーザー名
   * @returns {boolean} ユーザーが存在する場合true
   */
  userExists(username) {
    return this.getUserInfo(username) !== null;
  }
  
  /**
   * ユーザーのホームディレクトリを取得
   * 
   * @param {string} username - ユーザー名
   * @returns {string|null} ホームディレクトリパス
   */
  getUserHome(username) {
    const userInfo = this.getUserInfo(username);
    return userInfo ? userInfo.home : null;
  }
  
  /**
   * ユーザーのシェルを取得
   * 
   * @param {string} username - ユーザー名
   * @returns {string|null} シェルパス
   */
  getUserShell(username) {
    const userInfo = this.getUserInfo(username);
    return userInfo ? userInfo.shell : null;
  }
  
  /**
   * PAMが利用可能か確認
   * 
   * @returns {boolean} PAMが利用可能な場合true
   */
  isPAMAvailable() {
    return this.pamAvailable;
  }
}

module.exports = PAMAuth;
