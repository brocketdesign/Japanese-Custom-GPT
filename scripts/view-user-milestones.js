const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function viewUserMilestones() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    // Get user ID from command-line arguments
    const userIdArg = process.argv[2];
    const query = userIdArg ? { userId: new ObjectId(userIdArg) } : {};
    
    try {
        await client.connect();
        console.log('✓ Connected to MongoDB\n');
        
        const db = client.db(process.env.MONGODB_NAME);
        const collection = db.collection('user_milestones');
        
        // Get count of documents
        const count = await collection.countDocuments(query);
        const filterMsg = userIdArg ? ` for user ${userIdArg}` : '';
        console.log(`📊 Total user milestones${filterMsg}: ${count}\n`);
        
        if (count === 0) {
            console.log(`⚠️  No user milestones found in the collection${filterMsg}.`);
            return;
        }
        
        // Fetch milestones sorted by grantedAt descending
        const milestones = await collection.find(query).sort({ grantedAt: -1 }).toArray();
        
        console.log('='.repeat(80));
        console.log(`USER MILESTONES COLLECTION CONTENT${filterMsg.toUpperCase()}`);
        console.log('='.repeat(80) + '\n');
        
        milestones.forEach((milestone, index) => {
            console.log(`[${index + 1}] ID: ${milestone._id}`);
            console.log(`    User ID: ${milestone.userId}`);
            console.log(`    Type: ${milestone.type}`);
            console.log(`    Granted At: ${milestone.grantedAt}`);
            console.log(`    Chat ID: ${milestone.chatId || 'N/A'}`);
            console.log(`    Milestone: ${milestone.milestone || 'N/A'}`);
            console.log(`    Reward Points: ${milestone.rewardPoints || 0}`);
            console.log('');
        });
        
        console.log('='.repeat(80));
        console.log(`✅ Successfully retrieved ${count} milestone(s)${filterMsg}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.close();
        console.log('✓ Database connection closed');
    }
}

// Run the script
viewUserMilestones();
