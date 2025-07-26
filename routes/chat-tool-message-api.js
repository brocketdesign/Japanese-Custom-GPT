const { ObjectId } = require('mongodb');
const { addUserPoints } = require('../models/user-points-utils');

async function routes(fastify, options) {
  // Like/Dislike message endpoint - Updated to use message identification instead of index
  fastify.post('/api/message/action', async (request, reply) => {
    try {
      const { action, userChatId, messageId, messageContent, messageTimestamp } = request.body;
      const user = request.user;
      const userId = new fastify.mongo.ObjectId(user._id);

      if (!['like', 'dislike', 'remove'].includes(action)) {
        return reply.code(400).send({ error: 'Invalid action. Must be like, dislike, or remove.' });
      }

      if (!messageId && !messageContent && !messageTimestamp) {
        return reply.code(400).send({ error: 'Message identification required (messageId, content, or timestamp).' });
      }

      const db = fastify.mongo.db;
      const collectionUserChat = db.collection('userChat');

      // Function to find message and update action using multiple identifiers
      const findMessageAndUpdateAction = async (userChatId, messageIdentifiers, action) => {
        
        // Get the user chat document
        const userChatDocument = await collectionUserChat.findOne({
          _id: new fastify.mongo.ObjectId(userChatId)
        });

        if (!userChatDocument || !userChatDocument.messages) {
          throw new Error('User chat not found or has no messages');
        }


        // Find message by multiple criteria for better accuracy
        let messageIndex = -1;
        let foundMessage = null;

        // Try to find by messageId first (most reliable)
        if (messageIdentifiers.messageId) {
          messageIndex = userChatDocument.messages.findIndex(msg => 
            msg._id && msg._id.toString() === messageIdentifiers.messageId
          );
          if (messageIndex !== -1) {
            foundMessage = userChatDocument.messages[messageIndex];
          }
        }

        // If not found by ID, try by timestamp and content combination
        if (messageIndex === -1 && messageIdentifiers.messageTimestamp && messageIdentifiers.messageContent) {
          messageIndex = userChatDocument.messages.findIndex(msg => 
            msg.timestamp === messageIdentifiers.messageTimestamp &&
            msg.content === messageIdentifiers.messageContent
          );
          if (messageIndex !== -1) {
            foundMessage = userChatDocument.messages[messageIndex];
            console.log(`[findMessageAndUpdateAction] Found message by timestamp+content at index ${messageIndex}`);
          }
        }

        // If still not found, try by content only (less reliable)
        if (messageIndex === -1 && messageIdentifiers.messageContent) {
          messageIndex = userChatDocument.messages.findIndex(msg => 
            msg.content === messageIdentifiers.messageContent
          );
          if (messageIndex !== -1) {
            foundMessage = userChatDocument.messages[messageIndex];
            console.log(`[findMessageAndUpdateAction] Found message by content only at index ${messageIndex}`);
          }
        }

        // Final fallback: try by timestamp only
        if (messageIndex === -1 && messageIdentifiers.messageTimestamp) {
          messageIndex = userChatDocument.messages.findIndex(msg => 
            msg.timestamp === messageIdentifiers.messageTimestamp
          );
          if (messageIndex !== -1) {
            foundMessage = userChatDocument.messages[messageIndex];
            console.log(`[findMessageAndUpdateAction] Found message by timestamp only at index ${messageIndex}`);
          }
        }

        if (messageIndex === -1 || !foundMessage) {
          console.log(`[findMessageAndUpdateAction] Message not found with identifiers:`, messageIdentifiers);
          throw new Error('Message not found');
        }
        

        // Initialize actions array if it doesn't exist
        if (!foundMessage.actions) {
          foundMessage.actions = [];
        }

        const originalActionsCount = foundMessage.actions.length;

        if (action === 'remove') {
          // Remove any existing like/dislike actions
          foundMessage.actions = foundMessage.actions.filter(a => !['like', 'dislike'].includes(a.type));
        } else {
          // Remove any existing like/dislike actions first
          foundMessage.actions = foundMessage.actions.filter(a => !['like', 'dislike'].includes(a.type));
          
          // Add the new action
          foundMessage.actions.push({
            type: action,
            date: new Date(),
            userId: userId
          });
        }

        // Update the specific message in the array
        userChatDocument.messages[messageIndex] = foundMessage;

        // Update the entire messages array in the database
        const updateResult = await collectionUserChat.updateOne(
          { _id: new fastify.mongo.ObjectId(userChatId) },
          { $set: { messages: userChatDocument.messages } }
        );

        return foundMessage.actions;
      };

      // Execute the update
      const messageIdentifiers = {
        messageId,
        messageContent,
        messageTimestamp
      };

      const updatedActions = await findMessageAndUpdateAction(userChatId, messageIdentifiers, action);

      // Add 1 point for feedback actions and send a notification
      if (action !== 'remove') {
        const user = await fastify.mongo.db.collection('users').findOne({ _id: userId });
        const userPointsTranslations = fastify.getUserPointsTranslations ? fastify.getUserPointsTranslations(user?.lang || 'en') : {};
        
        await addUserPoints(
          db,
          userId,
          1,
          userPointsTranslations.points?.actions?.chat_feedback || 'Provided feedback on message',
          'chat_feedback',
          fastify
        );

        // Send notification to user about earning points
        if (fastify.sendNotificationToUser) {
          const pointsMessage = userPointsTranslations.feedback_grant_points?.replace('{points}', '1') || 'You have earned 1 point for your feedback';
          
          try {
            fastify.sendNotificationToUser(userId,
              'showNotification',
              {
                message: pointsMessage,
                icon: 'success'
              });
          } catch (notificationError) {
            console.error('Failed to send points notification:', notificationError);
          }
        }
      }

      reply.send({ 
        success: true, 
        message: `Message ${action === 'remove' ? 'action removed' : action + 'd'} successfully`,
        actions: updatedActions
      });

    } catch (error) {
      console.error('Error updating message action:', error);
      reply.code(500).send({ error: error.message || 'Internal Server Error' });
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