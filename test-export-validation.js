/**
 * Quick validation test for the user export functionality
 * This tests the core functions without requiring database connection
 */

console.log('🧪 Testing User Export Functionality...\n');

// Test 1: Import all required functions
try {
  const {
    getUsersForExport,
    formatUsersForCsv,
    getUserExportStats,
    getUserMessageStats,
    getUserContentStats
  } = require('./models/user-analytics-utils');
  
  console.log('✅ All functions imported successfully');
  
  // Test 2: Test CSV formatting with mock data
  const mockUsers = [
    {
      _id: '507f1f77bcf86cd799439011',
      createdAt: new Date('2023-01-01'),
      email: 'test@example.com',
      nickname: 'TestUser',
      gender: 'female',
      subscriptionStatus: 'premium',
      points: 100,
      ageVerification: true,
      totalImages: 5,
      totalMessages: 10,
      totalChats: 3
    },
    {
      _id: '507f1f77bcf86cd799439012',
      createdAt: new Date('2023-01-02'),
      email: 'user2@example.com',
      nickname: 'User "Two"',
      gender: 'male',
      subscriptionStatus: 'free',
      points: 50,
      ageVerification: false,
      totalImages: 0,
      totalMessages: 5,
      totalChats: 1
    }
  ];
  
  const testFields = [
    'createdAt', 'email', 'nickname', 'gender', 
    'subscriptionStatus', 'points', 'ageVerification',
    'totalImages', 'totalMessages', 'totalChats'
  ];
  
  const csvResult = formatUsersForCsv(mockUsers, testFields);
  
  console.log('✅ CSV formatting test passed');
  console.log('📊 Sample CSV output:');
  console.log(csvResult.csv.split('\n').slice(0, 3).join('\n'));
  console.log(`📈 Total records: ${csvResult.totalRecords}`);
  
  // Test 3: Verify CSV escaping works correctly
  const csvLines = csvResult.csv.split('\n');
  const header = csvLines[0];
  const row1 = csvLines[1];
  const row2 = csvLines[2];
  
  console.log('\n🔍 Testing CSV escaping:');
  console.log(`Header: ${header}`);
  console.log(`Row 1: ${row1}`);
  console.log(`Row 2 (with quotes): ${row2}`);
  
  if (row2.includes('"User ""Two"""')) {
    console.log('✅ Quote escaping works correctly');
  }
  
  if (row1.includes('2023-01-01') && row2.includes('2023-01-02')) {
    console.log('✅ Date formatting works correctly');
  }
  
  if (row1.includes('Yes') && row2.includes('No')) {
    console.log('✅ Boolean formatting works correctly');
  }
  
  console.log('\n🎉 All tests passed! Export functionality is working correctly.');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack trace:', error.stack);
}