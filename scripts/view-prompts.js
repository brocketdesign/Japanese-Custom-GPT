const { MongoClient } = require('mongodb');
require('dotenv').config();

async function viewPrompts() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✓ Connected to MongoDB\n');
        
        const db = client.db(process.env.MONGODB_NAME);
        const collection = db.collection('prompts');
        
        // Get count of documents
        const count = await collection.countDocuments();
        console.log(`📊 Total prompts: ${count}\n`);
        
        if (count === 0) {
            console.log('⚠️  No prompts found in the collection.');
            return;
        }
        
        // Fetch all prompts sorted by order
        const prompts = await collection.find({}).sort({ order: 1 }).toArray();
        
        console.log('='.repeat(80));
        console.log('PROMPTS COLLECTION CONTENT');
        console.log('='.repeat(80) + '\n');
        
        prompts.forEach((prompt, index) => {
            console.log(`[${index + 1}] ID: ${prompt._id}`);
            console.log(`    Order: ${prompt.order}`);
            console.log(`    Title: ${prompt.title}`);
            console.log(`    Gender: ${prompt.gender || 'N/A'}`);
            console.log(`    Cost: ${prompt.cost || 0}`);
            console.log(`    NSFW: ${prompt.nsfw ? 'Yes' : 'No'}`);
            console.log(`    Prompt: ${prompt.prompt.substring(0, 100)}${prompt.prompt.length > 100 ? '...' : ''}`);
            console.log(`    Image: ${prompt.image ? prompt.image.substring(0, 50) + '...' : 'N/A'}`);
            console.log('');
        });
        
        console.log('='.repeat(80));
        console.log(`✅ Successfully retrieved ${count} prompt(s)`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.close();
        console.log('✓ Database connection closed');
    }
}

// Run the script
viewPrompts();
