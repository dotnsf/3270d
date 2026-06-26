/**
 * Configuration Manager
 * 設定ファイルと環境変数を管理
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class Config {
  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * 設定ファイルを読み込み
   */
  loadConfig() {
    const configPath = path.join(__dirname, '../config/default.json');
    
    let config = {};
    
    // デフォルト設定を読み込み
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configData);
    }
    
    // 環境変数で上書き
    if (process.env.PORT) {
      config.server.port = parseInt(process.env.PORT, 10);
    }
    if (process.env.HOST) {
      config.server.host = process.env.HOST;
    }
    if (process.env.MAX_CONNECTIONS) {
      config.server.maxConnections = parseInt(process.env.MAX_CONNECTIONS, 10);
    }
    if (process.env.LOG_LEVEL) {
      config.logging.level = process.env.LOG_LEVEL;
    }
    if (process.env.LOG_FILE) {
      config.logging.file = process.env.LOG_FILE;
    }
    if (process.env.AUTH_ENABLED) {
      config.auth.enabled = process.env.AUTH_ENABLED === 'true';
    }
    if (process.env.AUTH_MAX_RETRIES) {
      config.auth.maxRetries = parseInt(process.env.AUTH_MAX_RETRIES, 10);
    }
    
    return config;
  }

  /**
   * 設定値を取得
   */
  get(key) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * すべての設定を取得
   */
  getAll() {
    return { ...this.config };
  }
}

// シングルトンインスタンス
const config = new Config();

module.exports = config;
