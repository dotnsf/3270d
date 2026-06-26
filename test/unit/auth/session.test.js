/**
 * Session モジュールのユニットテスト
 */

const Session = require('../../../src/auth/session');
const { SessionManager } = require('../../../src/auth/session');

describe('Session', () => {
  let session;
  const mockOptions = {
    username: 'testuser',
    uid: 1000,
    gid: 1000,
    home: '/home/testuser',
    shell: '/bin/bash',
    connectionId: 'test-connection-id'
  };

  beforeEach(() => {
    session = new Session(mockOptions);
  });

  afterEach(() => {
    if (session && !session.isDestroyed()) {
      session.destroy();
    }
  });

  describe('constructor', () => {
    test('should create session with correct properties', () => {
      expect(session.id).toBeDefined();
      expect(session.username).toBe('testuser');
      expect(session.uid).toBe(1000);
      expect(session.gid).toBe(1000);
      expect(session.home).toBe('/home/testuser');
      expect(session.shell).toBe('/bin/bash');
      expect(session.connectionId).toBe('test-connection-id');
      expect(session.destroyed).toBe(false);
    });

    test('should initialize timestamps', () => {
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActivityAt).toBeInstanceOf(Date);
      expect(session.activityCount).toBe(0);
    });
  });

  describe('recordActivity', () => {
    test('should update last activity time and count', (done) => {
      const initialActivity = session.lastActivityAt;
      const initialCount = session.activityCount;

      // 少し待つ
      setTimeout(() => {
        session.recordActivity();

        expect(session.lastActivityAt.getTime()).toBeGreaterThan(initialActivity.getTime());
        expect(session.activityCount).toBe(initialCount + 1);
        done();
      }, 10);
    });

    test('should not record activity on destroyed session', () => {
      session.destroy();
      const count = session.activityCount;

      session.recordActivity();

      expect(session.activityCount).toBe(count);
    });
  });

  describe('isActive', () => {
    test('should return true for recent activity', () => {
      session.recordActivity();
      expect(session.isActive(1000)).toBe(true);
    });

    test('should return false for old activity', () => {
      // lastActivityAtを古い時刻に設定
      session.lastActivityAt = new Date(Date.now() - 2000);
      expect(session.isActive(1000)).toBe(false);
    });

    test('should return false for destroyed session', () => {
      session.destroy();
      expect(session.isActive()).toBe(false);
    });
  });

  describe('metadata', () => {
    test('should set and get metadata', () => {
      session.setMetadata('key1', 'value1');
      expect(session.getMetadata('key1')).toBe('value1');
    });

    test('should delete metadata', () => {
      session.setMetadata('key1', 'value1');
      session.deleteMetadata('key1');
      expect(session.getMetadata('key1')).toBeUndefined();
    });

    test('should not set metadata on destroyed session', () => {
      session.destroy();
      session.setMetadata('key1', 'value1');
      expect(session.getMetadata('key1')).toBeUndefined();
    });
  });

  describe('getInfo', () => {
    test('should return session information', () => {
      const info = session.getInfo();

      expect(info.id).toBe(session.id);
      expect(info.username).toBe('testuser');
      expect(info.uid).toBe(1000);
      expect(info.destroyed).toBe(false);
      expect(info.elapsedTime).toBeGreaterThanOrEqual(0);
      expect(info.idleTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('destroy', () => {
    test('should mark session as destroyed', () => {
      session.destroy();

      expect(session.destroyed).toBe(true);
      expect(session.metadata).toEqual({});
    });

    test('should be idempotent', () => {
      session.destroy();
      session.destroy();

      expect(session.destroyed).toBe(true);
    });
  });
});

describe('SessionManager', () => {
  let manager;
  let session1;
  let session2;

  beforeEach(() => {
    manager = new SessionManager();
    
    session1 = new Session({
      username: 'user1',
      uid: 1000,
      gid: 1000,
      home: '/home/user1',
      shell: '/bin/bash',
      connectionId: 'conn1'
    });

    session2 = new Session({
      username: 'user2',
      uid: 1001,
      gid: 1001,
      home: '/home/user2',
      shell: '/bin/bash',
      connectionId: 'conn2'
    });
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('addSession', () => {
    test('should add session to manager', () => {
      manager.addSession(session1);

      expect(manager.getSession(session1.id)).toBe(session1);
      expect(manager.getAllSessions()).toHaveLength(1);
    });

    test('should index session by username', () => {
      manager.addSession(session1);

      const sessions = manager.getSessionsByUsername('user1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toBe(session1);
    });

    test('should index session by connection ID', () => {
      manager.addSession(session1);

      const session = manager.getSessionByConnection('conn1');
      expect(session).toBe(session1);
    });
  });

  describe('removeSession', () => {
    test('should remove session from manager', () => {
      manager.addSession(session1);
      manager.removeSession(session1.id);

      expect(manager.getSession(session1.id)).toBeNull();
      expect(manager.getAllSessions()).toHaveLength(0);
    });

    test('should destroy session when removing', () => {
      manager.addSession(session1);
      manager.removeSession(session1.id);

      expect(session1.isDestroyed()).toBe(true);
    });

    test('should remove from all indexes', () => {
      manager.addSession(session1);
      manager.removeSession(session1.id);

      expect(manager.getSessionsByUsername('user1')).toHaveLength(0);
      expect(manager.getSessionByConnection('conn1')).toBeNull();
    });
  });

  describe('getActiveSessionCount', () => {
    test('should count active sessions', () => {
      manager.addSession(session1);
      manager.addSession(session2);

      session1.recordActivity();
      session2.recordActivity();

      expect(manager.getActiveSessionCount(1000)).toBe(2);
    });

    test('should not count inactive sessions', () => {
      manager.addSession(session1);
      manager.addSession(session2);

      // session1を古くする
      session1.lastActivityAt = new Date(Date.now() - 2000);
      session2.recordActivity();

      expect(manager.getActiveSessionCount(1000)).toBe(1);
    });
  });

  describe('cleanupInactiveSessions', () => {
    test('should remove inactive sessions', () => {
      manager.addSession(session1);
      manager.addSession(session2);

      // session1を古くする
      session1.lastActivityAt = new Date(Date.now() - 2000);
      session2.recordActivity();

      const cleaned = manager.cleanupInactiveSessions(1000);

      expect(cleaned).toBe(1);
      expect(manager.getAllSessions()).toHaveLength(1);
      expect(manager.getSession(session2.id)).toBe(session2);
    });
  });

  describe('cleanup', () => {
    test('should remove all sessions', () => {
      manager.addSession(session1);
      manager.addSession(session2);

      manager.cleanup();

      expect(manager.getAllSessions()).toHaveLength(0);
      expect(session1.isDestroyed()).toBe(true);
      expect(session2.isDestroyed()).toBe(true);
    });
  });
});
