const { ObjectId } = require('mongodb');
const crypto = require('crypto');

async function generateSlug() {
    // Generate a more user-friendly slug (8 characters)
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function createAffiliateLink(db, userId, customSlug = null) {
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
        throw new Error('User not found');
    }

    const affiliateLinkCollection = db.collection('affiliateLinks');
    
    let slug = customSlug;
    if (!slug) {
        // Generate unique slug
        let isUnique = false;
        while (!isUnique) {
            slug = await generateSlug();
            const existing = await affiliateLinkCollection.findOne({ slug });
            if (!existing) {
                isUnique = true;
            }
        }
    } else {
        // Check if custom slug is already taken
        const existing = await affiliateLinkCollection.findOne({ slug, userId: { $ne: new ObjectId(userId) } });
        if (existing) {
            throw new Error('Slug already taken');
        }
    }

    // Remove existing affiliate link for this user
    await affiliateLinkCollection.deleteMany({ userId: new ObjectId(userId) });

    const linkData = {
        userId: new ObjectId(userId),
        slug: slug,
        link: `${process.env.BASE_URL || 'https://app.chatlamix.com'}?referrer=${slug}`,
        clicks: 0,
        conversions: 0,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    await affiliateLinkCollection.insertOne(linkData);
    return linkData;
}

async function getAffiliateLink(db, userId) {
    const affiliateLinkCollection = db.collection('affiliateLinks');
    return affiliateLinkCollection.findOne({ userId: new ObjectId(userId) });
}

async function getReferrals(db, userId) {
    const usersCollection = db.collection('users');
    return usersCollection.find({ referrer: new ObjectId(userId) }).toArray();
}

async function countSubscribedReferrals(db, userId) {
    const usersCollection = db.collection('users');
    return usersCollection.countDocuments({ referrer: new ObjectId(userId), subscriptionStatus: 'active' });
}

async function trackClick(db, slug) {
    const affiliateLinkCollection = db.collection('affiliateLinks');
    await affiliateLinkCollection.updateOne(
        { slug },
        { $inc: { clicks: 1 }, $set: { lastClickAt: new Date() } }
    );
}

async function trackConversion(db, referrerSlug) {
    const affiliateLinkCollection = db.collection('affiliateLinks');
    const affiliateLink = await affiliateLinkCollection.findOne({ slug: referrerSlug });
    
    if (affiliateLink) {
        await affiliateLinkCollection.updateOne(
            { slug: referrerSlug },
            { $inc: { conversions: 1 }, $set: { lastConversionAt: new Date() } }
        );
        return affiliateLink.userId;
    }
    return null;
}

async function getReferralStats(db, userId) {
    const affiliateLinkCollection = db.collection('affiliateLinks');
    const usersCollection = db.collection('users');
    
    // Get affiliate link data
    const affiliateLink = await affiliateLinkCollection.findOne({ userId: new ObjectId(userId) });
    
    // Get referral counts
    const totalReferrals = await usersCollection.countDocuments({ referrer: new ObjectId(userId) });
    const activeReferrals = await usersCollection.countDocuments({ 
        referrer: new ObjectId(userId), 
        subscriptionStatus: 'active' 
    });
    
    // Calculate earnings (example: $5 per active referral)
    const earnings = activeReferrals * 5;
    
    return {
        clicks: affiliateLink?.clicks || 0,
        conversions: affiliateLink?.conversions || 0,
        totalReferrals,
        activeReferrals,
        earnings,
        conversionRate: affiliateLink?.clicks > 0 ? ((affiliateLink?.conversions || 0) / affiliateLink.clicks * 100).toFixed(2) : 0
    };
}

module.exports = {
    createAffiliateLink,
    getAffiliateLink,
    getReferrals,
    countSubscribedReferrals,
    trackClick,
    trackConversion,
    getReferralStats,
    generateSlug
};
