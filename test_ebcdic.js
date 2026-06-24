const Converter = require('./src/charset/converter');

const conv = new Converter();

// テスト文字列
const testStrings = [
  '=',
  'Username:',
  'Password:',
  'TN3270 Login',
  'Press Enter to login'
];

console.log('=== EBCDIC Conversion Test ===\n');

testStrings.forEach(str => {
  const ebcdic = conv.utf8ToEbcdic(str);
  const back = conv.ebcdicToUtf8(ebcdic);
  
  console.log(`Original: "${str}"`);
  console.log(`EBCDIC hex: ${ebcdic.toString('hex')}`);
  console.log(`Back to UTF-8: "${back}"`);
  console.log(`Match: ${str === back ? 'YES' : 'NO'}`);
  console.log('');
});

// 特定の文字をテスト
console.log('=== Individual Character Test ===\n');
const chars = ['=', 'S', 'n', ' ', ':'];
chars.forEach(char => {
  const ascii = char.charCodeAt(0);
  const ebcdic = conv.utf8ToEbcdic(char);
  const ebcdicHex = ebcdic[0];
  const back = conv.ebcdicToUtf8(ebcdic);
  
  console.log(`'${char}' (ASCII 0x${ascii.toString(16).padStart(2, '0')}) -> EBCDIC 0x${ebcdicHex.toString(16).padStart(2, '0')} -> '${back}'`);
});

// Made with Bob
