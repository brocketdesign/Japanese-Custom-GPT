const { checkUserAdmin, handleFileUpload } = require('../models/tool');
const { getUserPoints } = require('../models/user-points-utils'); // Import getUserPoints

async function routes(fastify, options) {
  
  // Create Gift
  fastify.post('/api/gifts/create', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const db = fastify.mongo.db;
      const collection = db.collection('gifts');
      const parts = request.parts();
      let title = '';
      let description = '';
      let prompt = '';
      let cost = 0;
      let imageUrl = '';
      
      // Calculate order for the new gift
      const order = await collection.countDocuments({});

      for await (const part of parts) {
        if (part.file && part.fieldname === 'image') {
          imageUrl = await handleFileUpload(part, db);
        } else if (part.fieldname === 'title') {
          title = part.value;
        } else if (part.fieldname === 'description') {
          description = part.value;
        } else if (part.fieldname === 'prompt') {
            prompt = part.value;
        } else if (part.fieldname === 'cost') {
          cost = parseInt(part.value) || 0;
        }
      }
      
      if (!title || !description || !prompt || !imageUrl) {
        return reply.status(400).send({ success: false, message: 'Title, description, and image are required.' });
      }

      await collection.insertOne({
        title,
        description,
        prompt,
        cost,
        image: imageUrl,
        order,
        createdAt: new Date(),
      });
      
      reply.send({ success: true, message: 'Gift created successfully' });
    } catch (error) {
      console.error('Error creating gift:', error);
      reply.status(500).send({ success: false, message: 'Error creating gift' });
    }
  });
  
  // Get All Gifts
  fastify.get('/api/gifts', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      const gifts = await db.collection('gifts').find({}).sort({order: 1, _id: -1}).toArray();
      reply.send(gifts);
    } catch (error) {
      console.error('Error fetching gifts:', error);
      reply.status(500).send({ success: false, message: 'Error fetching gifts' });
    }
  });
  
  // Get Single Gift
  fastify.get('/api/gifts/:id', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      const { id } = request.params;
      const gift = await db.collection('gifts').findOne({ _id: new fastify.mongo.ObjectId(id) });
      if (!gift) {
        return reply.status(404).send({ success: false, message: 'Gift not found' });
      }
      reply.send(gift);
    } catch (error) {
      console.error('Error fetching gift:', error);
      reply.status(500).send({ success: false, message: 'Error fetching gift' });
    }
  });
  
  // Get Gift Status for a specific user (avoids conflict with /:id)
  fastify.get('/api/gifts/user-status/:userId', async (request, reply) => {
    try {
      const { userId } = request.params;
      const db = fastify.mongo.db;

      if (!fastify.mongo.ObjectId.isValid(userId)) {
        return reply.status(400).send({ error: 'Invalid user ID' });
      }

      // Get user's current points balance
      const userPoints = await getUserPoints(db, userId);
      
      // Get all available gifts
      const allGifts = await db.collection('gifts').find({}).sort({order: 1, _id: -1}).toArray();

      // Determine which gifts the user can afford
      const giftsWithAccess = allGifts.map(gift => {
        const cost = gift.cost || 0;
        return {
          _id: gift._id,
          cost: cost,
          canAfford: userPoints >= cost
        };
      });

      reply.send({
        userPoints: userPoints,
        gifts: giftsWithAccess
      });

    } catch (error) {
      console.error('Error fetching gifts status for user:', error);
      reply.status(500).send({ success: false, message: 'Error fetching gifts status' });
    }
  });
  
  // Update Gift
  fastify.put('/api/gifts/:id', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const db = fastify.mongo.db;
      const { id } = request.params;
      const parts = request.parts();
      
      const updatePayload = { $set: { updatedAt: new Date() } };

    for await (const part of parts) {
        if (part.file) {
            if (part.fieldname === 'image' && part.file.filename) {
            const imageUrl = await handleFileUpload(part, db);
            if (imageUrl) updatePayload.$set.image = imageUrl;
            }
        } else {
            if (part.fieldname === 'title') updatePayload.$set.title = part.value;
            if (part.fieldname === 'description') updatePayload.$set.description = part.value;
            if (part.fieldname === 'prompt') updatePayload.$set.prompt = part.value; // Add this line
            if (part.fieldname === 'cost') updatePayload.$set.cost = parseInt(part.value) || 0;
        }
    }

      const result = await db.collection('gifts').updateOne(
        { _id: new fastify.mongo.ObjectId(id) },
        updatePayload
      );

      if (result.matchedCount === 0) {
        return reply.status(404).send({ success: false, message: 'Gift not found' });
      }

      reply.send({ success: true, message: 'Gift updated successfully' });
    } catch (error) {
      console.error('Error updating gift:', error);
      reply.status(500).send({ success: false, message: 'Error updating gift' });
    }
  });

  // Update individual field (for inline editing)
  fastify.patch('/api/gifts/:id/field', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const db = fastify.mongo.db;
      const { id } = request.params;
      const updateData = request.body;
      
      // Validate the field being updated
      const allowedFields = ['title', 'description', 'prompt', 'cost'];
      const fieldName = Object.keys(updateData)[0];
      
      if (!allowedFields.includes(fieldName)) {
        return reply.status(400).send({ success: false, message: 'Invalid field name' });
      }
      
      let fieldValue = updateData[fieldName];
      
      // Type conversion and validation
      if (fieldName === 'cost') {
        fieldValue = parseInt(fieldValue);
        if (isNaN(fieldValue) || fieldValue < 0) {
          return reply.status(400).send({ success: false, message: 'Invalid cost value' });
        }
      }
      
      const updatePayload = {
        $set: {
          [fieldName]: fieldValue,
          updatedAt: new Date()
        }
      };
      
      const result = await db.collection('gifts').findOneAndUpdate(
        { _id: new fastify.mongo.ObjectId(id) },
        updatePayload,
        { returnDocument: 'after' }
      );
      
      if (!result.value) {
        return reply.status(404).send({ success: false, message: 'Gift not found' });
      }
      
      reply.send(result.value);
    } catch (error) {
      console.error('Error updating gift field:', error);
      reply.status(500).send({ success: false, message: 'Error updating gift field' });
    }
  });

  // Delete Gift
  fastify.delete('/api/gifts/:id', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const db = fastify.mongo.db;
      const { id } = request.params;
      const result = await db.collection('gifts').deleteOne({ _id: new fastify.mongo.ObjectId(id) });
      if (result.deletedCount === 0) {
        return reply.status(404).send({ success: false, message: 'Gift not found' });
      }
      reply.send({ success: true, message: 'Gift deleted successfully' });
    } catch (error) {
      console.error('Error deleting gift:', error);
      reply.status(500).send({ success: false, message: 'Error deleting gift' });
    }
  });

  // Reorder Gifts
  fastify.post('/api/gifts/reorder', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const db = fastify.mongo.db;
      const { orderedIds } = request.body;

      if (!Array.isArray(orderedIds)) {
        return reply.status(400).send({ success: false, message: 'Invalid payload: orderedIds must be an array.' });
      }

      const collection = db.collection('gifts');
      const operations = orderedIds.map((id, index) => {
        return {
          updateOne: {
            filter: { _id: new fastify.mongo.ObjectId(id) },
            update: { $set: { order: index } }
          }
        };
      });

      if (operations.length > 0) {
        await collection.bulkWrite(operations);
      }

      reply.send({ success: true, message: 'Gifts reordered successfully.' });
    } catch (error) {
      console.error('Error reordering gifts:', error);
      reply.status(500).send({ success: false, message: 'Error reordering gifts.' });
    }
  });
  // Add this new endpoint
    fastify.get('/api/user-chat-gifts/:userChatId', async (request, reply) => {
    try {
        const { userChatId } = request.params;
        const db = fastify.mongo.db;
        
        if (!userChatId || !fastify.mongo.ObjectId.isValid(userChatId)) {
        return reply.status(400).send({ error: 'Invalid userChatId' });
        }
        
        const userChat = await db.collection('userChat').findOne(
        { _id: new fastify.mongo.ObjectId(userChatId) },
        { projection: { customGiftIds: 1 } }
        );
        
        const giftIds = userChat?.customGiftIds || [];
        reply.send(giftIds);
    } catch (error) {
        console.error('Error fetching user chat gifts:', error);
        reply.status(500).send({ error: 'Internal Server Error' });
    }
    });
}

module.exports = routes;
