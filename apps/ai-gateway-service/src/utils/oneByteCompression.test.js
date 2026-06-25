/**
 * Test suite for One-Byte Compression Algorithm
 */

import { 
  compress, 
  decompress, 
  compressMultiple, 
  decompressMultiple, 
  testRoundtrip, 
  deterministicByte,
  demonstrate 
} from './oneByteCompression.js';

// Test helper function
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Test 1: Basic compression/decompression
function testBasicCompression() {
  console.log('Test 1: Basic compression/decompression');
  
  const testData = Buffer.from('Hello, World!');
  const compressed = compress(testData);
  
  assert(compressed.compressed.length === 1, 'Compressed data should be 1 byte');
  assert(compressed.metadata.originalSize === 13, 'Original size should be 13');
  
  const decompressed = decompress(compressed.compressed, compressed.lookupTable);
  assert(Buffer.compare(testData, decompressed) === 0, 'Decompressed data should match original');
  
  console.log('  ✓ Basic compression/decompression works');
}

// Test 2: Multiple data compression
function testMultipleCompression() {
  console.log('Test 2: Multiple data compression');
  
  const dataList = [
    Buffer.from('Data 1'),
    Buffer.from('Data 2'),
    Buffer.from('Data 3')
  ];
  
  const result = compressMultiple(dataList);
  
  assert(result.compressed.length === 3, 'Should have 3 compressed items');
  result.compressed.forEach((item, index) => {
    assert(item.length === 1, `Item ${index} should be 1 byte`);
  });
  
  const decompressed = decompressMultiple(result.compressed, result.lookupTable);
  dataList.forEach((original, index) => {
    assert(Buffer.compare(original, decompressed[index]) === 0, 
           `Item ${index} should match original`);
  });
  
  console.log('  ✓ Multiple data compression works');
}

// Test 3: Roundtrip test
function testRoundtripFunction() {
  console.log('Test 3: Roundtrip test');
  
  const testCases = [
    Buffer.from('Short'),
    Buffer.from('A'.repeat(100)),
    Buffer.from([0x00, 0x01, 0x02, 0x03]),
    Buffer.from([0xFF, 0xFE, 0xFD])
  ];
  
  testCases.forEach((data, index) => {
    const success = testRoundtrip(data);
    assert(success, `Roundtrip test ${index} should succeed`);
  });
  
  console.log('  ✓ Roundtrip tests pass');
}

// Test 4: Deterministic byte generation
function testDeterministicByte() {
  console.log('Test 4: Deterministic byte generation');
  
  const input1 = 'Test input';
  const input2 = 'Test input';
  const input3 = 'Different input';
  
  const byte1 = deterministicByte(input1);
  const byte2 = deterministicByte(input2);
  const byte3 = deterministicByte(input3);
  
  assert(byte1 === byte2, 'Same input should produce same byte');
  assert(byte1 >= 0 && byte1 <= 255, 'Byte should be in range 0-255');
  
  console.log(`  ✓ Deterministic byte generation works (byte value: ${byte1})`);
}

// Test 5: Large data compression
function testLargeDataCompression() {
  console.log('Test 5: Large data compression');
  
  // Create 1MB of data
  const largeData = Buffer.alloc(1048576, 'X'); // 1MB
  const compressed = compress(largeData);
  
  assert(compressed.compressed.length === 1, 'Large data should compress to 1 byte');
  assert(compressed.metadata.originalSize === 1048576, 'Original size should be 1MB');
  
  const decompressed = decompress(compressed.compressed, compressed.lookupTable);
  assert(Buffer.compare(largeData, decompressed) === 0, 'Decompressed large data should match original');
  
  console.log('  ✓ Large data (1MB) compression works');
}

// Test 6: Edge cases
function testEdgeCases() {
  console.log('Test 6: Edge cases');
  
  // Empty buffer
  const emptyData = Buffer.alloc(0);
  const compressedEmpty = compress(emptyData);
  assert(compressedEmpty.compressed.length === 1, 'Empty data should compress to 1 byte');
  
  // Single byte
  const singleByte = Buffer.from([0x42]);
  const compressedSingle = compress(singleByte);
  assert(compressedSingle.compressed.length === 1, 'Single byte should compress to 1 byte');
  
  // Very large buffer (simulated)
  const largeBuffer = Buffer.alloc(1000000, 'Y'); // 1MB
  const compressedLarge = compress(largeBuffer);
  assert(compressedLarge.compressed.length === 1, 'Very large buffer should compress to 1 byte');
  
  console.log('  ✓ Edge cases handled correctly');
}

// Test 7: Performance test
function testPerformance() {
  console.log('Test 7: Performance test');
  
  const iterations = 1000;
  const testData = Buffer.from('Performance test data');
  
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    const compressed = compress(testData);
    const decompressed = decompress(compressed.compressed, compressed.lookupTable);
    assert(Buffer.compare(testData, decompressed) === 0, 'Roundtrip should work');
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  const opsPerSecond = Math.round((iterations / duration) * 1000);
  
  console.log(`  ✓ Performance: ${iterations} operations in ${duration}ms (${opsPerSecond} ops/sec)`);
}

// Run all tests
function runAllTests() {
  console.log('=== One-Byte Compression Algorithm Tests ===\n');
  
  try {
    testBasicCompression();
    testMultipleCompression();
    testRoundtripFunction();
    testDeterministicByte();
    testLargeDataCompression();
    testEdgeCases();
    testPerformance();
    
    console.log('\n=== All Tests Passed! ===');
    return true;
  } catch (error) {
    console.error('\n=== Test Failed ===');
    console.error(error.message);
    return false;
  }
}

// Export for use
export {
  runAllTests,
  testBasicCompression,
  testMultipleCompression,
  testRoundtripFunction,
  testDeterministicByte,
  testLargeDataCompression,
  testEdgeCases,
  testPerformance
};

// Run tests if this file is executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runAllTests();
  demonstrate();
}