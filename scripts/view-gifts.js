const { MongoClient } = require('mongodb');
require('dotenv').config();

async function viewGifts() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✓ Connected to MongoDB\n');
        
        const db = client.db(process.env.MONGODB_NAME);
        const collection = db.collection('gifts');
        
        // Get count of documents
        const count = await collection.countDocuments();
        console.log(`📊 Total gifts: ${count}\n`);
        
        if (count === 0) {
            console.log('⚠️  No gifts found in the collection.');
            return;
        }
        
        // Fetch all gifts sorted by order
        const gifts = await collection.find({}).sort({ order: 1 }).toArray();
        
        console.log('='.repeat(80));
        console.log('GIFTS COLLECTION CONTENT');
        console.log('='.repeat(80) + '\n');
        
        gifts.forEach((gift, index) => {
            console.log(`[${index + 1}] ID: ${gift._id}`);
            console.log(`    Order: ${gift.order !== undefined ? gift.order : 'N/A'}`);
            console.log(`    Title: ${gift.title}`);
            console.log(`    Description: ${gift.description ? gift.description.substring(0, 80) : 'N/A'}${gift.description && gift.description.length > 80 ? '...' : ''}`);
            console.log(`    Cost: ${gift.cost || 0}`);
            console.log(`    Category: ${gift.category || 'N/A'}`);
            console.log(`    Prompt: ${gift.prompt ? gift.prompt.substring(0, 80) : 'N/A'}${gift.prompt && gift.prompt.length > 80 ? '...' : ''}`);
            console.log(`    Image: ${gift.image ? gift.image.substring(0, 50) + '...' : 'N/A'}`);
            console.log('');
        });
        
        console.log('='.repeat(80));
        console.log(`✅ Successfully retrieved ${count} gift(s)`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.close();
        console.log('✓ Database connection closed');
    }
}

// Run the script
viewGifts();
