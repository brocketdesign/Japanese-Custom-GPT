/**
 * Publish Calendar API Routes
 * Handles calendar CRUD operations and slot management
 */

const { ObjectId } = require('mongodb');

const {
  createCalendar,
  getUserCalendars,
  getCalendarById,
  updateCalendar,
  deleteCalendar,
  addSlot,
  removeSlot,
  updateSlot,
  getUserCalendarStats
} = require('../models/calendar-utils');

const {
  getNextAvailableSlot,
  addToQueue,
  getUserQueueItems,
  getCalendarQueue,
  removeFromQueue,
  rescheduleItem
} = require('../models/calendar-queue-utils');

async function routes(fastify, options) {
  const db = fastify.mongo.db;

  /**
   * GET /api/calendars
   * Get user's publish calendars
   */
  fastify.get('/api/calendars', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const filters = {
        isActive: request.query.isActive === 'true' ? true : request.query.isActive === 'false' ? false : undefined,
        page: parseInt(request.query.page) || 1,
        limit: parseInt(request.query.limit) || 20
      };

      const result = await getUserCalendars(db, user._id, filters);

      return reply.send({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[Calendar API] Get calendars error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to get calendars' });
    }
  });

  /**
   * GET /api/calendars/stats
   * Get user's calendar statistics
   */
  fastify.get('/api/calendars/stats', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const stats = await getUserCalendarStats(user._id, db);

      return reply.send({
        success: true,
        stats
      });
    } catch (error) {
      console.error('[Calendar API] Get stats error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to get statistics' });
    }
  });

  /**
   * POST /api/calendars
   * Create a new publish calendar
   */
  fastify.post('/api/calendars', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const { name, description, timezone, slots } = request.body;

      if (!name || name.trim().length === 0) {
        return reply.code(400).send({ success: false, error: 'Calendar name is required' });
      }

      const calendar = await createCalendar({
        userId: user._id,
        name,
        description,
        timezone,
        slots
      }, db);

      return reply.code(201).send({
        success: true,
        calendar
      });
    } catch (error) {
      console.error('[Calendar API] Create calendar error:', error);
      return reply.code(500).send({ success: false, error: error.message || 'Failed to create calendar' });
    }
  });

  /**
   * GET /api/calendars/:calendarId
   * Get a single calendar
   */
  fastify.get('/api/calendars/:calendarId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const { calendarId } = request.params;

      if (!ObjectId.isValid(calendarId)) {
        return reply.code(400).send({ success: false, error: 'Invalid calendar ID' });
      }

      const calendar = await getCalendarById(calendarId, db);

      if (!calendar) {
        return reply.code(404).send({ success: false, error: 'Calendar not found' });
      }

      // Verify ownership
      if (calendar.userId.toString() !== user._id.toString()) {
        return reply.code(403).send({ success: false, error: 'Not authorized' });
      }

      return reply.send({
        success: true,
        calendar
      });
    } catch (error) {
      console.error('[Calendar API] Get calendar error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to get calendar' });
    }
  });

  /**
   * PUT /api/calendars/:calendarId
   * Update a calendar
   */
  fastify.put('/api/calendars/:calendarId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const { calendarId } = request.params;

      if (!ObjectId.isValid(calendarId)) {
        return reply.code(400).send({ success: false, error: 'Invalid calendar ID' });
      }

      const updated = await updateCalendar(calendarId, user._id, request.body, db);

      if (!updated) {
        return reply.code(404).send({ success: false, error: 'Calendar not found or not authorized' });
      }

      return reply.send({
        success: true,
        message: 'Calendar updated'
      });
    } catch (error) {
      console.error('[Calendar API] Update calendar error:', error);
      return reply.code(500).send({ success: false, error: error.message || 'Failed to update calendar' });
    }
  });

  /**
   * DELETE /api/calendars/:calendarId
   * Delete a calendar
   */
  fastify.delete('/api/calendars/:calendarId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const { calendarId } = request.params;

      if (!ObjectId.isValid(calendarId)) {
        return reply.code(400).send({ success: false, error: 'Invalid calendar ID' });
      }

      const result = await deleteCalendar(calendarId, user._id, db);

      if (!result.deleted) {
        return reply.code(404).send({ success: false, error: 'Calendar not found or not authorized' });
      }

      return reply.send({
        success: true,
        message: 'Calendar deleted',
        cancelledQueueItems: result.cancelledQueueItems
      });
    } catch (error) {
      console.error('[Calendar API] Delete calendar error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to delete calendar' });
    }
  });

  /**
   * GET /api/calendars/:calendarId/next-slot
   * Get the next available slot for a calendar
   */
  fastify.get('/api/calendars/:calendarId/next-slot', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const { calendarId } = request.params;

      if (!ObjectId.isValid(calendarId)) {
        return reply.code(400).send({ success: false, error: 'Invalid calendar ID' });
      }

      const calendar = await getCalendarById(calendarId, db);

      if (!calendar) {
        return reply.code(404).send({ success: false, error: 'Calendar not found' });
      }

      // Verify ownership
      if (calendar.userId.toString() !== user._id.toString()) {
        return reply.code(403).send({ success: false, error: 'Not authorized' });
      }

      const nextSlot = await getNextAvailableSlot(calendar, db);

      if (!nextSlot) {
        return reply.send({
          success: true,
          nextSlot: null,
          message: 'No available slots in the next 14 days'
        });
      }

      return reply.send({
        success: true,
        nextSlot: {
          slotId: nextSlot.slotId,
          publishAt: nextSlot.publishAt
        }
      });
    } catch (error) {
      console.error('[Calendar API] Get next slot error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to get next slot' });
    }
  });

  /**
   * POST /api/calendars/:calendarId/slots
   * Add a time slot to calendar
   */
  fastify.post('/api/calendars/:calendarId/slots', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const { calendarId } = request.params;
      const { dayOfWeek, hour, minute, isEnabled } = request.body;

      if (!ObjectId.isValid(calendarId)) {
        return reply.code(400).send({ success: false, error: 'Invalid calendar ID' });
      }

      if (dayOfWeek === undefined || hour === undefined) {
        return reply.code(400).send({ success: false, error: 'dayOfWeek and hour are required' });
      }

      const slot = await addSlot(calendarId, user._id, {
        dayOfWeek,
        hour,
        minute,
        isEnabled
      }, db);

      return reply.code(201).send({
        success: true,
        slot
      });
    } catch (error) {
      console.error('[Calendar API] Add slot error:', error);
      return reply.code(500).send({ success: false, error: error.message || 'Failed to add slot' });
    }
  });

  /**
   * PUT /api/calendars/:calendarId/slots/:slotId
   * Update a time slot
   */
  fastify.put('/api/calendars/:calendarId/slots/:slotId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const { calendarId, slotId } = request.params;

      if (!ObjectId.isValid(calendarId) || !ObjectId.isValid(slotId)) {
        return reply.code(400).send({ success: false, error: 'Invalid calendar or slot ID' });
      }

      const updated = await updateSlot(calendarId, user._id, slotId, request.body, db);

      if (!updated) {
        return reply.code(404).send({ success: false, error: 'Slot not found or not authorized' });
      }

      return reply.send({
        success: true,
        message: 'Slot updated'
      });
    } catch (error) {
      console.error('[Calendar API] Update slot error:', error);
      return reply.code(500).send({ success: false, error: error.message || 'Failed to update slot' });
    }
  });

  /**
   * DELETE /api/calendars/:calendarId/slots/:slotId
   * Remove a time slot from calendar
   */
  fastify.delete('/api/calendars/:calendarId/slots/:slotId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const { calendarId, slotId } = request.params;

      if (!ObjectId.isValid(calendarId) || !ObjectId.isValid(slotId)) {
        return reply.code(400).send({ success: false, error: 'Invalid calendar or slot ID' });
      }

      const removed = await removeSlot(calendarId, user._id, slotId, db);

      if (!removed) {
        return reply.code(404).send({ success: false, error: 'Slot not found or not authorized' });
      }

      return reply.send({
        success: true,
        message: 'Slot removed'
      });
    } catch (error) {
      console.error('[Calendar API] Remove slot error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to remove slot' });
    }
  });

  /**
   * GET /api/calendars/:calendarId/queue
   * Get queue items for a specific calendar
   */
  fastify.get('/api/calendars/:calendarId/queue', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const { calendarId } = request.params;

      if (!ObjectId.isValid(calendarId)) {
        return reply.code(400).send({ success: false, error: 'Invalid calendar ID' });
      }

      // Verify calendar ownership
      const calendar = await getCalendarById(calendarId, db);
      if (!calendar || calendar.userId.toString() !== user._id.toString()) {
        return reply.code(403).send({ success: false, error: 'Not authorized' });
      }

      const filters = {
        status: request.query.status,
        page: parseInt(request.query.page) || 1,
        limit: parseInt(request.query.limit) || 20
      };

      const result = await getCalendarQueue(calendarId, db, filters);

      return reply.send({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[Calendar API] Get queue error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to get queue' });
    }
  });

  /**
   * GET /api/queue
   * Get user's queue items across all calendars
   */
  fastify.get('/api/queue', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const filters = {
        calendarId: request.query.calendarId,
        status: request.query.status,
        page: parseInt(request.query.page) || 1,
        limit: parseInt(request.query.limit) || 20
      };

      const result = await getUserQueueItems(db, user._id, filters);

      return reply.send({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[Calendar API] Get user queue error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to get queue' });
    }
  });

  /**
   * DELETE /api/queue/:queueId
   * Cancel/remove an item from queue
   */
  fastify.delete('/api/queue/:queueId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const { queueId } = request.params;

      if (!ObjectId.isValid(queueId)) {
        return reply.code(400).send({ success: false, error: 'Invalid queue ID' });
      }

      const removed = await removeFromQueue(queueId, user._id, db);

      if (!removed) {
        return reply.code(404).send({ success: false, error: 'Queue item not found or not authorized' });
      }

      return reply.send({
        success: true,
        message: 'Queue item cancelled'
      });
    } catch (error) {
      console.error('[Calendar API] Remove from queue error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to cancel queue item' });
    }
  });

  /**
   * PUT /api/queue/:queueId/reschedule
   * Reschedule a queue item to a different time
   */
  fastify.put('/api/queue/:queueId/reschedule', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      const { queueId } = request.params;
      const { newPublishAt } = request.body;

      if (!ObjectId.isValid(queueId)) {
        return reply.code(400).send({ success: false, error: 'Invalid queue ID' });
      }

      if (!newPublishAt) {
        return reply.code(400).send({ success: false, error: 'newPublishAt is required' });
      }

      await rescheduleItem(queueId, user._id, newPublishAt, db);

      return reply.send({
        success: true,
        message: 'Queue item rescheduled'
      });
    } catch (error) {
      console.error('[Calendar API] Reschedule error:', error);
      return reply.code(500).send({ success: false, error: error.message || 'Failed to reschedule' });
    }
  });
}

module.exports = routes;
