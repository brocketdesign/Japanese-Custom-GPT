const { ObjectId } = require('mongodb');

async function routes(fastify, options) {
  // Like/Dislike message endpoint
  fastify.post('/api/message/:messageIndex/action', async (request, reply) => {
    try {
      const { messageIndex } = request.params;
      const { action, userChatId } = request.body; // 'like', 'dislike', or 'remove'
      const user = request.user;
      const userId = new fastify.mongo.ObjectId(user._id);

      if (!['like', 'dislike', 'remove'].includes(action)) {
        return reply.code(400).send({ error: 'Invalid action. Must be like, dislike, or remove.' });
      }

      const db = fastify.mongo.db;
      const collectionUserChat = db.collection('userChat');

      // Get the user chat document
      const userChatDocument = await collectionUserChat.findOne({
        _id: new fastify.mongo.ObjectId(userChatId)
      });

      if (!userChatDocument) {
        return reply.code(404).send({ error: 'User chat not found' });
      }

      const messageIdx = parseInt(messageIndex);
      if (messageIdx < 0 || messageIdx >= userChatDocument.messages.length) {
        return reply.code(400).send({ error: 'Invalid message index' });
      }

      const message = userChatDocument.messages[messageIdx];
      
      // Initialize actions array if it doesn't exist
      if (!message.actions) {
        message.actions = [];
      }

      if (action === 'remove') {
        // Remove any existing like/dislike actions
        message.actions = message.actions.filter(a => !['like', 'dislike'].includes(a.type));
      } else {
        // Remove any existing like/dislike actions first
        message.actions = message.actions.filter(a => !['like', 'dislike'].includes(a.type));
        
        // Add the new action
        message.actions.push({
          type: action,
          date: new Date(),
          userId: userId
        });
      }

      // Update the document
      await collectionUserChat.updateOne(
        { _id: new fastify.mongo.ObjectId(userChatId) },
        { $set: { [`messages.${messageIdx}.actions`]: message.actions } }
      );

      reply.send({ 
        success: true, 
        message: `Message ${action === 'remove' ? 'action removed' : action + 'd'} successfully`,
        actions: message.actions
      });

    } catch (error) {
      console.error('Error updating message action:', error);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Regenerate message endpoint
  fastify.post('/api/message/regenerate', async (request, reply) => {
    try {
      const { userChatId, chatId } = request.body;
      const user = request.user;
      const userId = user._id;

      const db = fastify.mongo.db;
      const collectionUserChat = db.collection('userChat');

      // Get the user chat document
      const userChatDocument = await collectionUserChat.findOne({
        _id: new fastify.mongo.ObjectId(userChatId)
      });

      if (!userChatDocument) {
        return reply.code(404).send({ error: 'User chat not found' });
      }

      const messages = userChatDocument.messages;
      if (messages.length === 0) {
        return reply.code(400).send({ error: 'No messages to regenerate' });
      }

      // Check if the last message is from assistant
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role !== 'assistant') {
        return reply.code(400).send({ error: 'Last message is not from assistant' });
      }

      // Remove the last assistant message
      await collectionUserChat.updateOne(
        { _id: new fastify.mongo.ObjectId(userChatId) },
        { $pop: { messages: 1 } }
      );

      reply.send({ 
        success: true, 
        message: 'Last message removed, ready for regeneration',
        userChatId,
        chatId
      });

    } catch (error) {
      console.error('Error regenerating message:', error);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = routes;