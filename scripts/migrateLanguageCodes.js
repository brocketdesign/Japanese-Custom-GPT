/**
 * Migration script to normalize language codes in chatsCollection
 * Maps: english → en, french → fr, japanese → ja
 * Run with: node migrateLanguageCodes.js
 */
const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');


const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = process.env.MONGODB_NAME;

if (!MONGODB_URI || !MONGODB_NAME) {
  console.error('Missing MONGODB_URI or MONGODB_NAME in environment');
  process.exit(1);
}




const LANGUAGE_MAP = {
  'english': 'en',
  'en': 'en',
  'french': 'fr',
  'fr': 'fr',
  'japanese': 'ja',
  'ja': 'ja'
};

const migrateLanguageCodes = async () => {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
                
    const db = client.db(MONGODB_NAME);
    const chatsCollection = db.collection('chats');
    
    // Get all unique language values currently in the database
    const currentLanguages = await chatsCollection.distinct('language');
    console.log(`\n📊 Current languages in database:`, currentLanguages);
    
    let totalUpdated = 0;
    
    // Process each language variant
    for (const [oldLang, newLang] of Object.entries(LANGUAGE_MAP)) {
      if (oldLang === newLang) continue; // Skip if already standardized
      
      const result = await chatsCollection.updateMany(
        { language: oldLang },
        { $set: { language: newLang, updatedAt: new Date() } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`🔄 Updated '${oldLang}' → '${newLang}': ${result.modifiedCount} documents`);
        totalUpdated += result.modifiedCount;
      }
    }
    
    // Verify migration
    const finalLanguages = await chatsCollection.distinct('language');
    console.log(`\n✅ Migration complete!`);
    console.log(`📊 Final languages in database:`, finalLanguages.sort());
    console.log(`📈 Total documents updated: ${totalUpdated}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
};

migrateLanguageCodes();
