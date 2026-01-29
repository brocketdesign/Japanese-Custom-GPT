/**
 * Calendar Queue Service
 * Handles queueing content for scheduled publishing via publish calendars
 */

const { ObjectId } = require('mongodb');
const { getCalendarById } = require('./calendar-utils');

/**
 * Queue statuses
 */
const QUEUE_STATUSES = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Get the next available slot for a calendar
 * @param {Object} calendar - The publish calendar document
 * @param {Object} db - Database connection
 * @param {Date} afterTime - Find slot after this time (default: now)
 * @returns {Object|null} { slotId, publishAt } or null if no slots available
 */
async function getNextAvailableSlot(calendar, db, afterTime = new Date()) {
  const enabledSlots = (calendar.slots || []).filter(s => s.isEnabled);

  if (enabledSlots.length === 0) {
    return null;
  }

  const now = new Date(afterTime);

  // Check slots for today and next 14 days (2 weeks)
  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const dayOfWeek = checkDate.getDay(); // 0-6 (Sunday-Saturday)

    // Find slots for this day of week, sorted by time
    const daySlots = enabledSlots
      .filter(s => s.dayOfWeek === dayOfWeek)
      .sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));

    for (const slot of daySlots) {
      // Create the slot time
      const slotTime = new Date(checkDate);
      slotTime.setHours(slot.hour, slot.minute, 0, 0);

      // Skip if slot time is in the past (with 1 minute buffer)
      const bufferTime = new Date(now.getTime() + 60000);
      if (slotTime <= bufferTime) {
        continue;
      }

      // Check if this slot time is already taken by another queued item
      const isSlotTaken = await db.collection('calendarQueue').findOne({
        calendarId: calendar._id,
        scheduledPublishAt: slotTime,
        status: { $in: [QUEUE_STATUSES.QUEUED, QUEUE_STATUSES.PROCESSING] }
      });

      if (!isSlotTaken) {
        return {
          slotId: slot._id,
          publishAt: slotTime
        };
      }
    }
  }

  return null; // No available slots in the next 14 days
}

/**
 * Add content to the calendar queue
 * @param {Object} data - Queue item data
 * @param {Object} db - Database connection
 * @returns {Object} Created queue item with assigned slot
 */
async function addToQueue(data, db) {
  const {
    userId,
    calendarId,
    scheduleId,
    postId,
    contentType,
    socialPlatforms = [],
    socialAccountIds = [],
    caption = '',
    priority = 0
  } = data;

  // Get the calendar
  const calendar = await getCalendarById(calendarId, db);
  if (!calendar) {
    throw new Error('Calendar not found');
  }

  if (!calendar.isActive) {
    throw new Error('Calendar is not active');
  }

  // Get next available slot
  const nextSlot = await getNextAvailableSlot(calendar, db);
  if (!nextSlot) {
    throw new Error('No available slots in the next 14 days');
  }

  const queueItem = {
    userId: new ObjectId(userId),
    calendarId: new ObjectId(calendarId),
    scheduleId: scheduleId ? new ObjectId(scheduleId) : null,
    postId: new ObjectId(postId),
    contentType,
    socialPlatforms,
    socialAccountIds,
    caption,
    status: QUEUE_STATUSES.QUEUED,
    priority: parseInt(priority) || 0,
    assignedSlotId: nextSlot.slotId,
    scheduledPublishAt: nextSlot.publishAt,
    attempts: 0,
    lastAttemptAt: null,
    error: null,
    publishedAt: null,
    generatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('calendarQueue').insertOne(queueItem);
  return { _id: result.insertedId, ...queueItem };
}

/**
 * Get queue items ready to publish
 * @param {Object} db - Database connection
 * @param {Date} beforeTime - Get items scheduled before this time (default: now)
 * @returns {Array} Queue items ready to publish
 */
async function getReadyQueueItems(db, beforeTime = new Date()) {
  return await db.collection('calendarQueue')
    .find({
      status: QUEUE_STATUSES.QUEUED,
      scheduledPublishAt: { $lte: beforeTime }
    })
    .sort({ priority: -1, scheduledPublishAt: 1 })
    .toArray();
}

/**
 * Get user's queue items
 * @param {Object} db - Database connection
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Object} Queue items and pagination
 */
async function getUserQueueItems(db, userId, filters = {}) {
  const {
    calendarId,
    status,
    page = 1,
    limit = 20
  } = filters;

  const query = { userId: new ObjectId(userId) };

  if (calendarId) {
    query.calendarId = new ObjectId(calendarId);
  }

  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const items = await db.collection('calendarQueue')
    .aggregate([
      { $match: query },
      { $sort: { scheduledPublishAt: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'unifiedPosts',
          localField: 'postId',
          foreignField: '_id',
          as: 'post'
        }
      },
      {
        $lookup: {
          from: 'publishCalendars',
          localField: 'calendarId',
          foreignField: '_id',
          as: 'calendar'
        }
      },
      {
        $addFields: {
          post: { $arrayElemAt: ['$post', 0] },
          calendar: { $arrayElemAt: ['$calendar', 0] }
        }
      }
    ])
    .toArray();

  const total = await db.collection('calendarQueue').countDocuments(query);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get queue item by ID
 * @param {string} queueId - Queue item ID
 * @param {Object} db - Database connection
 * @returns {Object} Queue item
 */
async function getQueueItemById(queueId, db) {
  if (!ObjectId.isValid(queueId)) {
    return null;
  }
  return await db.collection('calendarQueue').findOne({
    _id: new ObjectId(queueId)
  });
}

/**
 * Update queue item status
 * @param {string} queueId - Queue item ID
 * @param {string} status - New status
 * @param {Object} db - Database connection
 * @param {Object} additionalUpdates - Additional fields to update
 */
async function updateQueueItemStatus(queueId, status, db, additionalUpdates = {}) {
  const update = {
    status,
    updatedAt: new Date(),
    ...additionalUpdates
  };

  await db.collection('calendarQueue').updateOne(
    { _id: new ObjectId(queueId) },
    { $set: update }
  );
}

/**
 * Mark queue item as published
 * @param {string} queueId - Queue item ID
 * @param {Object} db - Database connection
 */
async function markAsPublished(queueId, db) {
  await updateQueueItemStatus(queueId, QUEUE_STATUSES.PUBLISHED, db, {
    publishedAt: new Date()
  });
}

/**
 * Mark queue item as failed
 * @param {string} queueId - Queue item ID
 * @param {string} error - Error message
 * @param {Object} db - Database connection
 */
async function markAsFailed(queueId, error, db) {
  const item = await getQueueItemById(queueId, db);
  const attempts = (item?.attempts || 0) + 1;

  // After 3 attempts, mark as failed permanently
  const status = attempts >= 3 ? QUEUE_STATUSES.FAILED : QUEUE_STATUSES.QUEUED;

  await updateQueueItemStatus(queueId, status, db, {
    attempts,
    lastAttemptAt: new Date(),
    error
  });
}

/**
 * Remove item from queue (cancel)
 * @param {string} queueId - Queue item ID
 * @param {string} userId - User ID (for ownership verification)
 * @param {Object} db - Database connection
 */
async function removeFromQueue(queueId, userId, db) {
  const result = await db.collection('calendarQueue').updateOne(
    {
      _id: new ObjectId(queueId),
      userId: new ObjectId(userId),
      status: { $in: [QUEUE_STATUSES.QUEUED, QUEUE_STATUSES.FAILED] }
    },
    {
      $set: {
        status: QUEUE_STATUSES.CANCELLED,
        updatedAt: new Date()
      }
    }
  );

  return result.modifiedCount > 0;
}

/**
 * Delete queue item completely
 * @param {string} queueId - Queue item ID
 * @param {string} userId - User ID (for ownership verification)
 * @param {Object} db - Database connection
 */
async function deleteQueueItem(queueId, userId, db) {
  const result = await db.collection('calendarQueue').deleteOne({
    _id: new ObjectId(queueId),
    userId: new ObjectId(userId)
  });

  return result.deletedCount > 0;
}

/**
 * Update queue item priority
 * @param {string} queueId - Queue item ID
 * @param {string} userId - User ID
 * @param {number} priority - New priority
 * @param {Object} db - Database connection
 */
async function updatePriority(queueId, userId, priority, db) {
  const result = await db.collection('calendarQueue').updateOne(
    {
      _id: new ObjectId(queueId),
      userId: new ObjectId(userId),
      status: QUEUE_STATUSES.QUEUED
    },
    {
      $set: {
        priority: parseInt(priority) || 0,
        updatedAt: new Date()
      }
    }
  );

  return result.modifiedCount > 0;
}

/**
 * Reschedule queue item to a different slot
 * @param {string} queueId - Queue item ID
 * @param {string} userId - User ID
 * @param {Date} newPublishAt - New publish time
 * @param {Object} db - Database connection
 */
async function rescheduleItem(queueId, userId, newPublishAt, db) {
  const item = await getQueueItemById(queueId, db);
  if (!item || item.userId.toString() !== userId) {
    throw new Error('Queue item not found or not authorized');
  }

  if (item.status !== QUEUE_STATUSES.QUEUED) {
    throw new Error('Can only reschedule queued items');
  }

  const publishTime = new Date(newPublishAt);
  if (publishTime <= new Date()) {
    throw new Error('New publish time must be in the future');
  }

  // Check if the new slot is available
  const isSlotTaken = await db.collection('calendarQueue').findOne({
    _id: { $ne: new ObjectId(queueId) },
    calendarId: item.calendarId,
    scheduledPublishAt: publishTime,
    status: { $in: [QUEUE_STATUSES.QUEUED, QUEUE_STATUSES.PROCESSING] }
  });

  if (isSlotTaken) {
    throw new Error('The selected time slot is already taken');
  }

  await db.collection('calendarQueue').updateOne(
    { _id: new ObjectId(queueId) },
    {
      $set: {
        scheduledPublishAt: publishTime,
        updatedAt: new Date()
      }
    }
  );

  return true;
}

/**
 * Get queue for specific calendar
 * @param {string} calendarId - Calendar ID
 * @param {Object} db - Database connection
 * @param {Object} filters - Filter options
 * @returns {Object} Queue items
 */
async function getCalendarQueue(calendarId, db, filters = {}) {
  const {
    status,
    page = 1,
    limit = 20
  } = filters;

  const query = {
    calendarId: new ObjectId(calendarId)
  };

  if (status) {
    query.status = status;
  } else {
    // Default to showing queued items
    query.status = QUEUE_STATUSES.QUEUED;
  }

  const skip = (page - 1) * limit;

  const items = await db.collection('calendarQueue')
    .aggregate([
      { $match: query },
      { $sort: { scheduledPublishAt: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'unifiedPosts',
          localField: 'postId',
          foreignField: '_id',
          as: 'post'
        }
      },
      {
        $addFields: {
          post: { $arrayElemAt: ['$post', 0] }
        }
      }
    ])
    .toArray();

  const total = await db.collection('calendarQueue').countDocuments(query);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get upcoming queue items for preview
 * @param {string} calendarId - Calendar ID
 * @param {Object} db - Database connection
 * @param {number} limit - Number of items to return
 * @returns {Array} Upcoming queue items
 */
async function getUpcomingQueueItems(calendarId, db, limit = 5) {
  return await db.collection('calendarQueue')
    .aggregate([
      {
        $match: {
          calendarId: new ObjectId(calendarId),
          status: QUEUE_STATUSES.QUEUED,
          scheduledPublishAt: { $gte: new Date() }
        }
      },
      { $sort: { scheduledPublishAt: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'unifiedPosts',
          localField: 'postId',
          foreignField: '_id',
          as: 'post'
        }
      },
      {
        $addFields: {
          post: { $arrayElemAt: ['$post', 0] }
        }
      }
    ])
    .toArray();
}

module.exports = {
  QUEUE_STATUSES,
  getNextAvailableSlot,
  addToQueue,
  getReadyQueueItems,
  getUserQueueItems,
  getQueueItemById,
  updateQueueItemStatus,
  markAsPublished,
  markAsFailed,
  removeFromQueue,
  deleteQueueItem,
  updatePriority,
  rescheduleItem,
  getCalendarQueue,
  getUpcomingQueueItems
};
