const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const defaultSettings = {
    minImages: 1,
    videoPrompt: 'Generate a short, engaging video with smooth transitions and vibrant colors.',
    characterTone: 'casual',
    relationshipType: 'companion',
    selectedVoice: 'nova',
    voiceProvider: 'standard',
    minimaxVoice: 'Wise_Woman',
    autoMergeFace: true,
    selectedModel: 'openai-gpt4o',
    suggestionsEnabled: true,
    speechRecognitionEnabled: true,
    speechAutoSend: true,
    scenariosEnabled: false
};

async function resetAllSettings() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✓ Connected to MongoDB');
        
        const db = client.db(process.env.MONGODB_NAME);
        const collection = db.collection('chatToolSettings');
        
        // Get count before deletion
        const countBefore = await collection.countDocuments();
        console.log(`\n📊 Current document count: ${countBefore}`);
        
        // Delete all documents
        const deleteResult = await collection.deleteMany({});
        console.log(`\n🗑️  Deleted ${deleteResult.deletedCount} documents`);
        
        // Verify deletion
        const countAfter = await collection.countDocuments();
        console.log(`\n✓ Verification - Remaining documents: ${countAfter}`);
        
        console.log('\n✅ Reset complete! All chatToolSettings have been deleted.');
        console.log('   Users will now use default settings on their next login/session.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n✓ Database connection closed');
    }
}

// Run the script
resetAllSettings();
