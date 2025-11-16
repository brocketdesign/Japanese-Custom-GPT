const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function updateGiftPricing() {
    const pricingFile = path.join(__dirname, '../config/gift-pricing.json');
    
    if (!fs.existsSync(pricingFile)) {
        console.error('❌ Error: gift-pricing.json not found at', pricingFile);
        process.exit(1);
    }
    
    const pricingData = JSON.parse(fs.readFileSync(pricingFile, 'utf8'));
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✓ Connected to MongoDB\n');
        
        const db = client.db(process.env.MONGODB_NAME);
        const collection = db.collection('gifts');
        
        console.log('📊 GIFT PRICING UPDATE SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total gifts to update: ${pricingData.gifts.length}\n`);
        
        // Create a summary
        let totalCostChange = 0;
        let increasedCount = 0;
        let decreasedCount = 0;
        const updates = [];
        
        // Display changes preview
        console.log('PREVIEW OF CHANGES:');
        console.log('-'.repeat(80));
        console.log(
            'Title'.padEnd(25) + 
            'Old Cost'.padEnd(12) + 
            'New Cost'.padEnd(12) + 
            'Change'.padEnd(12)
        );
        console.log('-'.repeat(80));
        
        pricingData.gifts.forEach(gift => {
            const change = gift.newCost - gift.oldCost;
            const changeStr = change > 0 ? `+${change}` : `${change}`;
            console.log(
                gift.title.substring(0, 24).padEnd(25) +
                String(gift.oldCost).padEnd(12) +
                String(gift.newCost).padEnd(12) +
                changeStr.padEnd(12)
            );
            
            totalCostChange += change;
            if (change > 0) increasedCount++;
            if (change < 0) decreasedCount++;
            
            updates.push({
                id: gift.id,
                newCost: gift.newCost
            });
        });
        
        console.log('-'.repeat(80));
        console.log(`Total cost change across all gifts: ${totalCostChange} points`);
        console.log(`Gifts increased: ${increasedCount}`);
        console.log(`Gifts decreased: ${decreasedCount}`);
        console.log('\n');
        
        // Display pricing breakdown by category
        console.log('PRICING BREAKDOWN BY CATEGORY:');
        console.log('-'.repeat(80));
        Object.entries(pricingData.summary.categories).forEach(([category, info]) => {
            console.log(`\n${category}`);
            console.log(`  Count: ${info.count}`);
            console.log(`  Price Range: ${info.priceRange} points`);
            console.log(`  Affordability: ${info.affordability}`);
        });
        
        console.log('\n' + '='.repeat(80));
        console.log('🔄 READY TO UPDATE DATABASE');
        console.log('='.repeat(80) + '\n');
        
        // Check for user confirmation
        if (process.argv[2] === '--confirm') {
            console.log('⏳ Starting database updates...\n');
            
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            
            for (const gift of pricingData.gifts) {
                try {
                    const result = await collection.updateOne(
                        { _id: new ObjectId(gift.id) },
                        { $set: { 
                            cost: gift.newCost,
                            category: gift.category
                        } }
                    );
                    
                    if (result.modifiedCount === 1) {
                        successCount++;
                    } else if (result.matchedCount === 0) {
                        errorCount++;
                        errors.push(`❌ ${gift.title} (ID: ${gift.id}) - Not found in database`);
                    }
                } catch (error) {
                    errorCount++;
                    errors.push(`❌ ${gift.title} - Error: ${error.message}`);
                }
            }
            
            console.log('\n' + '='.repeat(80));
            console.log('✅ UPDATE COMPLETE');
            console.log('='.repeat(80));
            console.log(`✓ Successfully updated: ${successCount} gifts`);
            console.log(`✗ Errors: ${errorCount} gifts\n`);
            
            if (errors.length > 0) {
                console.log('ERROR DETAILS:');
                errors.forEach(err => console.log(err));
            }
            
        } else {
            console.log('📋 PREVIEW MODE');
            console.log('\nTo apply these changes to the database, run:');
            console.log(`\n  node scripts/update-gift-pricing.js --confirm\n`);
            console.log('⚠️  Make sure you are satisfied with the pricing before confirming!\n');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.close();
        console.log('✓ Database connection closed');
    }
}

// Run the script
updateGiftPricing();
