/**
 * Test script for user export functionality
 * Run with: node test-user-export.js
 */

const { MongoClient } = require('mongodb');
const { getUsersForExport, formatUsersForCsv } = require('./models/user-analytics-utils');

async function testUserExport() {
  let client;
  
  try {
    // Connect to MongoDB (adjust connection string as needed)
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB || 'japanese-gpt';
    
    client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db(dbName);
    
    console.log('✅ Connected to MongoDB');
    
    // Test 1: Basic export functionality
    console.log('\n📊 Testing basic user export...');
    const basicUsers = await getUsersForExport(db, {
      userType: 'registered',
      fields: ['createdAt', 'email', 'nickname', 'gender', 'subscriptionStatus'],
      limit: 5 // Limit to 5 users for testing
    });
    
    console.log(`✅ Retrieved ${basicUsers.length} users for basic export`);
    
    // Test 2: Format CSV
    console.log('\n📝 Testing CSV formatting...');
    const csvData = formatUsersForCsv(basicUsers, ['createdAt', 'email', 'nickname', 'gender', 'subscriptionStatus']);
    
    console.log(`✅ Generated CSV with ${csvData.totalRecords} records`);
    console.log('📄 Sample CSV data:');
    console.log(csvData.csv.split('\n').slice(0, 3).join('\n')); // Show header + first 2 rows
    
    // Test 3: All users export
    console.log('\n🌍 Testing all users export (limited)...');
    const allUsers = await getUsersForExport(db, {
      userType: 'all',
      fields: ['createdAt', 'nickname', 'lang'],
      limit: 3
    });
    
    console.log(`✅ Retrieved ${allUsers.length} users for all users export`);
    
    // Test 4: Recent users export
    console.log('\n⏰ Testing recent users export...');
    const recentUsers = await getUsersForExport(db, {
      userType: 'recent',
      fields: ['createdAt', 'nickname'],
      limit: 10
    });
    
    console.log(`✅ Retrieved ${recentUsers.length} recent users`);
    
    console.log('\n🎉 All tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    if (client) {
      await client.close();
      console.log('📝 Database connection closed');
    }
  }
}

// Run the test
if (require.main === module) {
  testUserExport();
}

module.exports = { testUserExport };