const { ObjectId } = require('mongodb');
const https = require('https');
const http = require('http');

/**
 * User Behavior Tracking Utilities
 * 
 * This module handles tracking of user behaviors for analytics:
 * - Start Chat: When a user initiates a chat
 * - Message Sent: When a user sends a message
 * - Premium View: When the premium modal is displayed
 * - User Location: Geographic location based on IP
 */

// Collection name for behavior tracking
const TRACKING_COLLECTION = 'user_behavior_tracking';
const USER_LOCATIONS_COLLECTION = 'user_locations';

/**
 * Track event types enum
 */
const TrackingEventTypes = {
  START_CHAT: 'start_chat',
  MESSAGE_SENT: 'message_sent',
  PREMIUM_VIEW: 'premium_view',
  PAGE_VIEW: 'page_view'
};

/**
 * Chat start source identifiers
 */
const ChatStartSources = {
  CHARACTER_INTRO_MODAL: 'character_intro_modal',
  CHARACTER_PAGE: 'character_page',
  CHAT_LIST: 'chat_list',
  HOME_FEATURED: 'home_featured',
  HOME_CAROUSEL: 'home_carousel',
  EXPLORE_CARD: 'explore_card',
  SEARCH_RESULTS: 'search_results',
  RECOMMENDATION: 'recommendation',
  COLD_ONBOARDING: 'cold_onboarding',
  PAYMENT_SUCCESS: 'payment_success',
  DIRECT_URL: 'direct_url',
  UNKNOWN: 'unknown'
};

/**
 * Premium view source identifiers
 */
const PremiumViewSources = {
  CHAT_TOOL_SETTINGS: 'chat_tool_settings',
  IMAGE_GENERATION: 'image_generation',
  DASHBOARD_GENERATION: 'dashboard_generation',
  SETTINGS_PAGE: 'settings_page',
  CHARACTER_CREATION: 'character_creation',
  CREATOR_APPLICATION: 'creator_application',
  AFFILIATION_DASHBOARD: 'affiliation_dashboard',
  CIVITAI_SEARCH: 'civitai_search',
  WEBSOCKET_TRIGGER: 'websocket_trigger',
  MENU_UPGRADE: 'menu_upgrade',
  UNKNOWN: 'unknown'
};

/**
 * Initialize the tracking collections with proper indexes
 * @param {Object} db - MongoDB database instance
 */
async function initializeTrackingCollections(db) {
  try {
    const trackingCollection = db.collection(TRACKING_COLLECTION);
    const locationsCollection = db.collection(USER_LOCATIONS_COLLECTION);

    // Create indexes for tracking collection
    await trackingCollection.createIndex({ userId: 1 });
    await trackingCollection.createIndex({ eventType: 1 });
    await trackingCollection.createIndex({ createdAt: 1 });
    await trackingCollection.createIndex({ userId: 1, eventType: 1 });
    await trackingCollection.createIndex({ 'metadata.source': 1 });

    // Create indexes for user locations collection
    await locationsCollection.createIndex({ userId: 1 }, { unique: true });
    await locationsCollection.createIndex({ country: 1 });
    await locationsCollection.createIndex({ city: 1 });
    await locationsCollection.createIndex({ updatedAt: 1 });

    console.log('✅ [Tracking] Collections and indexes initialized successfully');
  } catch (error) {
    console.error('❌ [Tracking] Error initializing collections:', error);
  }
}

/**
 * Track a "Start Chat" event
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID being started
 * @param {string} source - Source identifier (where the user clicked)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} The created tracking record
 */
async function trackStartChat(db, userId, chatId, source, metadata = {}) {
  try {
    const trackingCollection = db.collection(TRACKING_COLLECTION);
    
    const record = {
      userId: new ObjectId(userId),
      eventType: TrackingEventTypes.START_CHAT,
      chatId: chatId ? new ObjectId(chatId) : null,
      metadata: {
        source: source || ChatStartSources.UNKNOWN,
        sourceElementId: metadata.sourceElementId || null,
        sourceElementClass: metadata.sourceElementClass || null,
        pageUrl: metadata.pageUrl || null,
        referrer: metadata.referrer || null,
        ...metadata
      },
      createdAt: new Date()
    };

    const result = await trackingCollection.insertOne(record);
    console.log(`📊 [Tracking] Start Chat tracked: User ${userId}, Source: ${source}`);
    
    return { success: true, insertedId: result.insertedId };
  } catch (error) {
    console.error('❌ [Tracking] Error tracking start chat:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Track a "Message Sent" event
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID where message was sent
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} The created tracking record
 */
async function trackMessageSent(db, userId, chatId, metadata = {}) {
  try {
    const trackingCollection = db.collection(TRACKING_COLLECTION);
    
    const record = {
      userId: new ObjectId(userId),
      eventType: TrackingEventTypes.MESSAGE_SENT,
      chatId: chatId ? new ObjectId(chatId) : null,
      metadata: {
        messageType: metadata.messageType || 'text',
        hasImage: metadata.hasImage || false,
        ...metadata
      },
      createdAt: new Date()
    };

    const result = await trackingCollection.insertOne(record);
    
    return { success: true, insertedId: result.insertedId };
  } catch (error) {
    console.error('❌ [Tracking] Error tracking message sent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Track a "Premium View" event (when premium modal is shown)
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} source - Source that triggered the premium modal
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} The created tracking record
 */
async function trackPremiumView(db, userId, source, metadata = {}) {
  try {
    const trackingCollection = db.collection(TRACKING_COLLECTION);
    
    const record = {
      userId: new ObjectId(userId),
      eventType: TrackingEventTypes.PREMIUM_VIEW,
      metadata: {
        source: source || PremiumViewSources.UNKNOWN,
        triggerAction: metadata.triggerAction || null,
        pageUrl: metadata.pageUrl || null,
        ...metadata
      },
      createdAt: new Date()
    };

    const result = await trackingCollection.insertOne(record);
    console.log(`📊 [Tracking] Premium View tracked: User ${userId}, Source: ${source}`);
    
    return { success: true, insertedId: result.insertedId };
  } catch (error) {
    console.error('❌ [Tracking] Error tracking premium view:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user location from IP address using free IP geolocation service
 * @param {string} ipAddress - User's IP address
 * @returns {Promise<Object>} Location data
 */
async function getLocationFromIP(ipAddress) {
  return new Promise((resolve, reject) => {
    // Clean the IP address
    let cleanIP = ipAddress;
    if (cleanIP.startsWith('::ffff:')) {
      cleanIP = cleanIP.substring(7);
    }
    
    // Handle localhost/private IPs
    if (cleanIP === '127.0.0.1' || cleanIP === '::1' || cleanIP.startsWith('192.168.') || cleanIP.startsWith('10.')) {
      resolve({
        ip: cleanIP,
        country: 'Local',
        countryCode: 'LO',
        region: 'Local',
        city: 'Local',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC',
        isLocal: true
      });
      return;
    }

    // Use ip-api.com (free, no API key required, 45 requests/minute)
    const options = {
      hostname: 'ip-api.com',
      path: `/json/${cleanIP}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp`,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          
          if (parsed.status === 'success') {
            resolve({
              ip: cleanIP,
              country: parsed.country,
              countryCode: parsed.countryCode,
              region: parsed.regionName,
              city: parsed.city,
              latitude: parsed.lat,
              longitude: parsed.lon,
              timezone: parsed.timezone,
              isp: parsed.isp,
              isLocal: false
            });
          } else {
            resolve({
              ip: cleanIP,
              country: 'Unknown',
              countryCode: 'XX',
              region: 'Unknown',
              city: 'Unknown',
              latitude: 0,
              longitude: 0,
              timezone: 'UTC',
              isLocal: false,
              error: parsed.message
            });
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ [Tracking] IP geolocation error:', error);
      resolve({
        ip: cleanIP,
        country: 'Unknown',
        countryCode: 'XX',
        region: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC',
        isLocal: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ip: cleanIP,
        country: 'Unknown',
        countryCode: 'XX',
        region: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC',
        isLocal: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

/**
 * Save or update user location
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} ipAddress - User's IP address
 * @returns {Promise<Object>} Location data
 */
async function saveUserLocation(db, userId, ipAddress) {
  try {
    const locationsCollection = db.collection(USER_LOCATIONS_COLLECTION);
    
    // Get location from IP
    const locationData = await getLocationFromIP(ipAddress);
    
    const record = {
      userId: new ObjectId(userId),
      ...locationData,
      lastIpAddress: ipAddress,
      updatedAt: new Date()
    };

    // Upsert: update if exists, insert if not
    const result = await locationsCollection.updateOne(
      { userId: new ObjectId(userId) },
      { 
        $set: record,
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    console.log(`📍 [Tracking] User location saved: ${userId} - ${locationData.city}, ${locationData.country}`);
    
    return { success: true, location: locationData };
  } catch (error) {
    console.error('❌ [Tracking] Error saving user location:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's saved location
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Location data or null
 */
async function getUserLocation(db, userId) {
  try {
    const locationsCollection = db.collection(USER_LOCATIONS_COLLECTION);
    return await locationsCollection.findOne({ userId: new ObjectId(userId) });
  } catch (error) {
    console.error('❌ [Tracking] Error getting user location:', error);
    return null;
  }
}

/**
 * Get tracking statistics for a user
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User tracking statistics
 */
async function getUserTrackingStats(db, userId) {
  try {
    const trackingCollection = db.collection(TRACKING_COLLECTION);
    
    const stats = await trackingCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
          lastOccurrence: { $max: '$createdAt' }
        }
      }
    ]).toArray();

    const result = {
      startChatCount: 0,
      messageSentCount: 0,
      premiumViewCount: 0,
      lastStartChat: null,
      lastMessageSent: null,
      lastPremiumView: null
    };

    stats.forEach(stat => {
      switch (stat._id) {
        case TrackingEventTypes.START_CHAT:
          result.startChatCount = stat.count;
          result.lastStartChat = stat.lastOccurrence;
          break;
        case TrackingEventTypes.MESSAGE_SENT:
          result.messageSentCount = stat.count;
          result.lastMessageSent = stat.lastOccurrence;
          break;
        case TrackingEventTypes.PREMIUM_VIEW:
          result.premiumViewCount = stat.count;
          result.lastPremiumView = stat.lastOccurrence;
          break;
      }
    });

    return result;
  } catch (error) {
    console.error('❌ [Tracking] Error getting user tracking stats:', error);
    return null;
  }
}

/**
 * Get aggregate tracking statistics for admin dashboard
 * @param {Object} db - MongoDB database instance
 * @param {Date} startDate - Start date for filtering (optional)
 * @param {Date} endDate - End date for filtering (optional)
 * @returns {Promise<Object>} Aggregate tracking statistics
 */
async function getAggregateTrackingStats(db, startDate = null, endDate = null) {
  try {
    const trackingCollection = db.collection(TRACKING_COLLECTION);
    const locationsCollection = db.collection(USER_LOCATIONS_COLLECTION);
    
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    // Get event counts
    const eventStats = await trackingCollection.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      }
    ]).toArray();

    // Get start chat sources distribution
    const startChatSources = await trackingCollection.aggregate([
      { 
        $match: { 
          eventType: TrackingEventTypes.START_CHAT,
          ...(Object.keys(matchStage).length > 0 ? matchStage : {})
        } 
      },
      {
        $group: {
          _id: '$metadata.source',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    // Get premium view sources distribution
    const premiumViewSources = await trackingCollection.aggregate([
      { 
        $match: { 
          eventType: TrackingEventTypes.PREMIUM_VIEW,
          ...(Object.keys(matchStage).length > 0 ? matchStage : {})
        } 
      },
      {
        $group: {
          _id: '$metadata.source',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    // Get location distribution
    const locationStats = await locationsCollection.aggregate([
      {
        $group: {
          _id: '$country',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).toArray();

    // Get city distribution
    const cityStats = await locationsCollection.aggregate([
      {
        $group: {
          _id: { city: '$city', country: '$country' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).toArray();

    // Format results
    const result = {
      events: {
        startChat: { count: 0, uniqueUsers: 0 },
        messageSent: { count: 0, uniqueUsers: 0 },
        premiumView: { count: 0, uniqueUsers: 0 }
      },
      startChatSources: startChatSources.map(s => ({
        source: s._id || 'unknown',
        count: s.count
      })),
      premiumViewSources: premiumViewSources.map(s => ({
        source: s._id || 'unknown',
        count: s.count
      })),
      locations: {
        byCountry: locationStats.map(l => ({
          country: l._id || 'Unknown',
          count: l.count
        })),
        byCity: cityStats.map(c => ({
          city: c._id.city || 'Unknown',
          country: c._id.country || 'Unknown',
          count: c.count
        }))
      }
    };

    eventStats.forEach(stat => {
      switch (stat._id) {
        case TrackingEventTypes.START_CHAT:
          result.events.startChat = {
            count: stat.count,
            uniqueUsers: stat.uniqueUsers.length
          };
          break;
        case TrackingEventTypes.MESSAGE_SENT:
          result.events.messageSent = {
            count: stat.count,
            uniqueUsers: stat.uniqueUsers.length
          };
          break;
        case TrackingEventTypes.PREMIUM_VIEW:
          result.events.premiumView = {
            count: stat.count,
            uniqueUsers: stat.uniqueUsers.length
          };
          break;
      }
    });

    return result;
  } catch (error) {
    console.error('❌ [Tracking] Error getting aggregate tracking stats:', error);
    return null;
  }
}

/**
 * Get daily tracking trends
 * @param {Object} db - MongoDB database instance
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Daily tracking trends
 */
async function getDailyTrackingTrends(db, days = 7) {
  try {
    const trackingCollection = db.collection(TRACKING_COLLECTION);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const trends = await trackingCollection.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            eventType: '$eventType'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]).toArray();

    // Organize by date and event type
    const result = {};
    trends.forEach(t => {
      const date = t._id.date;
      if (!result[date]) {
        result[date] = {
          date,
          startChat: 0,
          messageSent: 0,
          premiumView: 0
        };
      }
      switch (t._id.eventType) {
        case TrackingEventTypes.START_CHAT:
          result[date].startChat = t.count;
          break;
        case TrackingEventTypes.MESSAGE_SENT:
          result[date].messageSent = t.count;
          break;
        case TrackingEventTypes.PREMIUM_VIEW:
          result[date].premiumView = t.count;
          break;
      }
    });

    return Object.values(result);
  } catch (error) {
    console.error('❌ [Tracking] Error getting daily tracking trends:', error);
    return [];
  }
}

module.exports = {
  // Constants
  TrackingEventTypes,
  ChatStartSources,
  PremiumViewSources,
  TRACKING_COLLECTION,
  USER_LOCATIONS_COLLECTION,
  
  // Initialization
  initializeTrackingCollections,
  
  // Tracking functions
  trackStartChat,
  trackMessageSent,
  trackPremiumView,
  
  // Location functions
  getLocationFromIP,
  saveUserLocation,
  getUserLocation,
  
  // Statistics functions
  getUserTrackingStats,
  getAggregateTrackingStats,
  getDailyTrackingTrends
};
