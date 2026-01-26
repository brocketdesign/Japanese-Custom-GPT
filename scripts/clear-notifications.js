#!/usr/bin/env node
/**
 * Script to clear all notifications from the notifications collection
 * Usage: node scripts/clear-notifications.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = process.env.MONGODB_NAME;

async function clearNotifications() {
  let client;

  try {
    if (!MONGODB_URI || !MONGODB_NAME) {
      console.error('❌ Error: MONGODB_URI or MONGODB_NAME not found in environment variables');
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_NAME);

    const notificationsCollection = db.collection('notifications');

    // Count notifications before deletion
    const countBefore = await notificationsCollection.countDocuments();
    console.log(`📊 Found ${countBefore} notification(s) in the collection`);

    if (countBefore === 0) {
      console.log('✅ No notifications to delete');
      return;
    }

    // Delete all notifications
    const result = await notificationsCollection.deleteMany({});
    console.log(`✅ Successfully deleted ${result.deletedCount} notification(s)`);

    // Verify deletion
    const countAfter = await notificationsCollection.countDocuments();
    console.log(`📊 Notifications remaining: ${countAfter}`);

  } catch (error) {
    console.error('❌ Error clearing notifications:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
clearNotifications();
