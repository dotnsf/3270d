#!/usr/bin/env node
/**
 * テスト結果フォーマッター
 * 
 * Jestのテスト結果JSONを読みやすいテキスト形式に変換します。
 * Ubuntu上でテストを実行した結果を、このファイルの内容だけで確認できるようにします。
 */

const fs = require('fs');
const path = require('path');

// テスト結果JSONファイルのパス
const TEST_RESULTS_JSON = path.join(__dirname, '../test-results/test-report.json');
const OUTPUT_FILE = path.join(__dirname, '../test-results/TEST-RESULTS.txt');

/**
 * テスト結果を読み込み
 */
function loadTestResults() {
  try {
    const data = fs.readFileSync(TEST_RESULTS_JSON, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading test results:', error.message);
    process.exit(1);
  }
}

/**
 * テスト結果をフォーマット
 */
function formatTestResults(results) {
  const lines = [];
  
  // ヘッダー
  lines.push('='.repeat(80));
  lines.push('3270d - テスト結果レポート');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`実行日時: ${new Date().toISOString()}`);
  lines.push(`Node.js: ${process.version}`);
  lines.push(`プラットフォーム: ${process.platform} ${process.arch}`);
  lines.push('');
  
  // サマリー
  lines.push('-'.repeat(80));
  lines.push('テストサマリー');
  lines.push('-'.repeat(80));
  lines.push(`総テスト数: ${results.numTotalTests}`);
  lines.push(`成功: ${results.numPassedTests}`);
  lines.push(`失敗: ${results.numFailedTests}`);
  lines.push(`スキップ: ${results.numPendingTests}`);
  lines.push(`実行時間: ${(results.testResults.reduce((sum, r) => sum + (r.perfStats?.runtime || 0), 0) / 1000).toFixed(2)}秒`);
  lines.push(`結果: ${results.success ? '✅ 成功' : '❌ 失敗'}`);
  lines.push('');
  
  // 各テストスイートの結果
  lines.push('-'.repeat(80));
  lines.push('テストスイート詳細');
  lines.push('-'.repeat(80));
  lines.push('');
  
  results.testResults.forEach((suite, index) => {
    const suiteName = path.relative(path.join(__dirname, '..'), suite.name);
    const passed = suite.numPassingTests;
    const failed = suite.numFailingTests;
    const pending = suite.numPendingTests;
    const total = suite.numTotalTests;
    const runtime = ((suite.perfStats?.runtime || 0) / 1000).toFixed(2);
    
    lines.push(`${index + 1}. ${suiteName}`);
    lines.push(`   状態: ${suite.status === 'passed' ? '✅ 成功' : '❌ 失敗'}`);
    lines.push(`   テスト: ${passed}/${total} 成功, ${failed} 失敗, ${pending} スキップ`);
    lines.push(`   実行時間: ${runtime}秒`);
    
    // 失敗したテストの詳細
    if (failed > 0) {
      lines.push('');
      lines.push('   失敗したテスト:');
      suite.testResults.forEach(test => {
        if (test.status === 'failed') {
          lines.push(`   - ${test.fullName}`);
          if (test.failureMessages && test.failureMessages.length > 0) {
            test.failureMessages.forEach(msg => {
              // エラーメッセージを整形（最初の数行のみ）
              const errorLines = msg.split('\n').slice(0, 5);
              errorLines.forEach(line => {
                lines.push(`     ${line}`);
              });
            });
          }
        }
      });
    }
    
    lines.push('');
  });
  
  // カバレッジ情報（利用可能な場合）
  if (results.coverageMap) {
    lines.push('-'.repeat(80));
    lines.push('カバレッジ情報');
    lines.push('-'.repeat(80));
    lines.push('');
    lines.push('カバレッジレポートは coverage/ ディレクトリを参照してください。');
    lines.push('');
  }
  
  // 失敗したテストの詳細サマリー
  if (results.numFailedTests > 0) {
    lines.push('-'.repeat(80));
    lines.push('失敗したテストの詳細');
    lines.push('-'.repeat(80));
    lines.push('');
    
    results.testResults.forEach(suite => {
      suite.testResults.forEach(test => {
        if (test.status === 'failed') {
          lines.push(`テスト: ${test.fullName}`);
          lines.push(`ファイル: ${path.relative(path.join(__dirname, '..'), suite.name)}`);
          lines.push('');
          
          if (test.failureMessages && test.failureMessages.length > 0) {
            lines.push('エラーメッセージ:');
            test.failureMessages.forEach(msg => {
              lines.push(msg);
            });
            lines.push('');
          }
        }
      });
    });
  }
  
  // フッター
  lines.push('='.repeat(80));
  lines.push('テスト結果レポート終了');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push('このファイルをBobに送信して、テスト結果を確認してもらってください。');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * メイン処理
 */
function main() {
  console.log('テスト結果を整形しています...');
  
  // テスト結果を読み込み
  const results = loadTestResults();
  
  // フォーマット
  const formatted = formatTestResults(results);
  
  // test-resultsディレクトリを作成
  const testResultsDir = path.join(__dirname, '../test-results');
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }
  
  // ファイルに書き込み
  fs.writeFileSync(OUTPUT_FILE, formatted, 'utf8');
  
  console.log(`テスト結果を ${OUTPUT_FILE} に出力しました。`);
  console.log('');
  console.log('Ubuntu上でテストを実行した後、このファイルの内容をBobに送信してください。');
  
  // 結果をコンソールにも出力
  console.log('');
  console.log(formatted);
  
  // 終了コード
  process.exit(results.success ? 0 : 1);
}

// 実行
main();

// Made with Bob
