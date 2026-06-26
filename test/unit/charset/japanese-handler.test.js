/**
 * JapaneseHandler モジュールのユニットテスチE
 */

const japaneseHandler = require('../../../src/charset/japanese-handler');

describe('JapaneseHandler', () => {
  describe('isDBCS', () => {
    test('should detect hiragana as DBCS', () => {
      expect(japaneseHandler.isDBCS('ぁE)).toBe(true);
      expect(japaneseHandler.isDBCS('めE)).toBe(true);
    });

    test('should detect katakana as DBCS', () => {
      expect(japaneseHandler.isDBCS('ア')).toBe(true);
      expect(japaneseHandler.isDBCS('ン')).toBe(true);
    });

    test('should detect kanji as DBCS', () => {
      expect(japaneseHandler.isDBCS('漢')).toBe(true);
      expect(japaneseHandler.isDBCS('孁E)).toBe(true);
    });

    test('should detect ASCII as not DBCS', () => {
      expect(japaneseHandler.isDBCS('A')).toBe(false);
      expect(japaneseHandler.isDBCS('1')).toBe(false);
      expect(japaneseHandler.isDBCS(' ')).toBe(false);
    });

    test('should handle empty string', () => {
      expect(japaneseHandler.isDBCS('')).toBe(false);
    });
  });

  describe('getCharWidth', () => {
    test('should return 2 for hiragana', () => {
      expect(japaneseHandler.getCharWidth('ぁE)).toBe(2);
      expect(japaneseHandler.getCharWidth('めE)).toBe(2);
    });

    test('should return 2 for katakana', () => {
      expect(japaneseHandler.getCharWidth('ア')).toBe(2);
      expect(japaneseHandler.getCharWidth('ン')).toBe(2);
    });

    test('should return 2 for kanji', () => {
      expect(japaneseHandler.getCharWidth('漢')).toBe(2);
      expect(japaneseHandler.getCharWidth('孁E)).toBe(2);
    });

    test('should return 1 for ASCII', () => {
      expect(japaneseHandler.getCharWidth('A')).toBe(1);
      expect(japaneseHandler.getCharWidth('1')).toBe(1);
      expect(japaneseHandler.getCharWidth(' ')).toBe(1);
    });

    test('should return 0 for empty string', () => {
      expect(japaneseHandler.getCharWidth('')).toBe(0);
    });
  });

  describe('getDisplayWidth', () => {
    test('should calculate width for ASCII text', () => {
      expect(japaneseHandler.getDisplayWidth('Hello')).toBe(5);
      expect(japaneseHandler.getDisplayWidth('12345')).toBe(5);
    });

    test('should calculate width for Japanese text', () => {
      expect(japaneseHandler.getDisplayWidth('こんにちは')).toBe(10);
      expect(japaneseHandler.getDisplayWidth('カタカチE)).toBe(8);
      expect(japaneseHandler.getDisplayWidth('漢孁E)).toBe(4);
    });

    test('should calculate width for mixed text', () => {
      expect(japaneseHandler.getDisplayWidth('Hello世界')).toBe(9);
      expect(japaneseHandler.getDisplayWidth('ABC漢孁E23')).toBe(10);
    });

    test('should return 0 for empty string', () => {
      expect(japaneseHandler.getDisplayWidth('')).toBe(0);
    });
  });

  describe('truncate', () => {
    test('should truncate ASCII text', () => {
      const result = japaneseHandler.truncate('Hello World', 5);
      expect(result.text).toBe('Hello');
      expect(result.width).toBe(5);
    });

    test('should truncate Japanese text', () => {
      const result = japaneseHandler.truncate('こんにちは', 6);
      expect(result.text).toBe('こんに');
      expect(result.width).toBe(6);
    });

    test('should handle DBCS at boundary', () => {
      // 幁Eで「こんに、E6)は入らなぁE�Eで「こん、E4)まで
      const result = japaneseHandler.truncate('こんにちは', 5);
      expect(result.text).toBe('こん');
      expect(result.width).toBe(4);
    });

    test('should handle mixed text', () => {
      const result = japaneseHandler.truncate('Hello世界', 7);
      expect(result.text).toBe('Hello丁E);
      expect(result.width).toBe(7);
    });
  });

  describe('pad', () => {
    test('should pad left', () => {
      expect(japaneseHandler.pad('ABC', 10, 'left')).toBe('ABC       ');
    });

    test('should pad right', () => {
      expect(japaneseHandler.pad('ABC', 10, 'right')).toBe('       ABC');
    });

    test('should pad center', () => {
      expect(japaneseHandler.pad('ABC', 10, 'center')).toBe('   ABC    ');
    });

    test('should handle Japanese text', () => {
      expect(japaneseHandler.pad('こん', 10, 'left')).toBe('こん      ');
    });

    test('should truncate if text is too long', () => {
      const result = japaneseHandler.pad('Hello World', 5, 'left');
      expect(result).toBe('Hello');
    });
  });

  describe('wrapText', () => {
    test('should wrap ASCII text', () => {
      const lines = japaneseHandler.wrapText('Hello World', 5);
      expect(lines).toEqual(['Hello', ' Worl', 'd']);
    });

    test('should wrap Japanese text', () => {
      const lines = japaneseHandler.wrapText('こんにちは', 6);
      expect(lines).toEqual(['こんに', 'ちは']);
    });

    test('should handle newlines', () => {
      const lines = japaneseHandler.wrapText('Hello\nWorld', 10);
      expect(lines).toEqual(['Hello', 'World']);
    });

    test('should handle mixed text', () => {
      const lines = japaneseHandler.wrapText('Hello世界World', 10);
      expect(lines).toEqual(['Hello世界W', 'orld']);
    });
  });

  describe('splitAt', () => {
    test('should split ASCII text', () => {
      const result = japaneseHandler.splitAt('Hello World', 5);
      expect(result.before).toBe('Hello');
      expect(result.after).toBe(' World');
      expect(result.actualPosition).toBe(5);
    });

    test('should split Japanese text', () => {
      const result = japaneseHandler.splitAt('こんにちは', 6);
      expect(result.before).toBe('こんに');
      expect(result.after).toBe('ちは');
      expect(result.actualPosition).toBe(6);
    });

    test('should handle DBCS at boundary', () => {
      const result = japaneseHandler.splitAt('こんにちは', 5);
      expect(result.before).toBe('こん');
      expect(result.after).toBe('にちは');
      expect(result.actualPosition).toBe(4);
    });
  });

  describe('isValidBoundary', () => {
    test('should validate ASCII boundaries', () => {
      expect(japaneseHandler.isValidBoundary('Hello', 0)).toBe(true);
      expect(japaneseHandler.isValidBoundary('Hello', 3)).toBe(true);
      expect(japaneseHandler.isValidBoundary('Hello', 5)).toBe(true);
    });

    test('should validate Japanese boundaries', () => {
      expect(japaneseHandler.isValidBoundary('こんにちは', 0)).toBe(true);
      expect(japaneseHandler.isValidBoundary('こんにちは', 2)).toBe(true);
      expect(japaneseHandler.isValidBoundary('こんにちは', 4)).toBe(true);
      expect(japaneseHandler.isValidBoundary('こんにちは', 10)).toBe(true);
    });

    test('should invalidate boundaries in DBCS', () => {
      expect(japaneseHandler.isValidBoundary('こんにちは', 1)).toBe(false);
      expect(japaneseHandler.isValidBoundary('こんにちは', 3)).toBe(false);
      expect(japaneseHandler.isValidBoundary('こんにちは', 5)).toBe(false);
    });
  });

  describe('containsJapanese', () => {
    test('should detect hiragana', () => {
      expect(japaneseHandler.containsJapanese('こんにちは')).toBe(true);
      expect(japaneseHandler.containsJapanese('Hello ぁEWorld')).toBe(true);
    });

    test('should detect katakana', () => {
      expect(japaneseHandler.containsJapanese('カタカチE)).toBe(true);
      expect(japaneseHandler.containsJapanese('Hello ア World')).toBe(true);
    });

    test('should detect kanji', () => {
      expect(japaneseHandler.containsJapanese('漢孁E)).toBe(true);
      expect(japaneseHandler.containsJapanese('Hello 漢 World')).toBe(true);
    });

    test('should not detect ASCII', () => {
      expect(japaneseHandler.containsJapanese('Hello World')).toBe(false);
      expect(japaneseHandler.containsJapanese('12345')).toBe(false);
    });
  });

  describe('getCharType', () => {
    test('should identify hiragana', () => {
      expect(japaneseHandler.getCharType('ぁE)).toBe('hiragana');
      expect(japaneseHandler.getCharType('めE)).toBe('hiragana');
    });

    test('should identify katakana', () => {
      expect(japaneseHandler.getCharType('ア')).toBe('katakana');
      expect(japaneseHandler.getCharType('ン')).toBe('katakana');
    });

    test('should identify kanji', () => {
      expect(japaneseHandler.getCharType('漢')).toBe('kanji');
      expect(japaneseHandler.getCharType('孁E)).toBe('kanji');
    });

    test('should identify ASCII', () => {
      expect(japaneseHandler.getCharType('A')).toBe('ascii');
      expect(japaneseHandler.getCharType('1')).toBe('ascii');
      expect(japaneseHandler.getCharType(' ')).toBe('ascii');
    });
  });

  describe('getTextStats', () => {
    test('should calculate stats for ASCII text', () => {
      const stats = japaneseHandler.getTextStats('Hello');
      expect(stats.length).toBe(5);
      expect(stats.displayWidth).toBe(5);
      expect(stats.ascii).toBe(5);
      expect(stats.sbcs).toBe(5);
      expect(stats.dbcs).toBe(0);
    });

    test('should calculate stats for Japanese text', () => {
      const stats = japaneseHandler.getTextStats('こんにちは');
      expect(stats.length).toBe(5);
      expect(stats.displayWidth).toBe(10);
      expect(stats.hiragana).toBe(5);
      expect(stats.dbcs).toBe(5);
      expect(stats.sbcs).toBe(0);
    });

    test('should calculate stats for mixed text', () => {
      const stats = japaneseHandler.getTextStats('Hello世界');
      expect(stats.length).toBe(7);
      expect(stats.displayWidth).toBe(9);
      expect(stats.ascii).toBe(5);
      expect(stats.kanji).toBe(2);
      expect(stats.sbcs).toBe(5);
      expect(stats.dbcs).toBe(2);
    });
  });
});

