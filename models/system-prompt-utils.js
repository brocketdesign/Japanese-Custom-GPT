/**
 * Utility functions for system prompt management
 */

/**
 * Get the system prompt from the database
 * @param {Object} db - MongoDB database instance
 * @param {string} id - Optional ID for specific prompt
 * @returns {Promise<Object|Array>} - System prompt(s)
 */
async function getSystemPrompt(db, id = null) {
  try {
    const collection = db.collection('systemPrompts');
    
    if (id) {
      // If ID is provided, get specific prompt
      if (!db.ObjectId.isValid(id)) {
        throw new Error('Invalid system prompt ID');
      }
      
      return await collection.findOne({ _id: new db.ObjectId(id) });
    }
    
    // If no ID, return all prompts
    return await collection.find({}).sort({ createdAt: -1 }).toArray();
  } catch (error) {
    console.error('Error fetching system prompt:', error);
    throw error;
  }
}

/**
 * Save system prompt to database
 * @param {Object} db - MongoDB database instance
 * @param {Object} promptData - Prompt data to save
 * @param {string} id - Optional ID for updating existing prompt
 * @returns {Promise<Object>} - Saved prompt
 */
async function saveSystemPrompt(db, promptData, id = null) {
  try {
    const collection = db.collection('systemPrompts');
    const now = new Date();
    
    const promptToSave = {
      ...promptData,
      updatedAt: now
    };
    
    if (id) {
      // Update existing prompt
      if (!db.ObjectId.isValid(id)) {
        throw new Error('Invalid system prompt ID');
      }
      
      const result = await collection.findOneAndUpdate(
        { _id: new db.ObjectId(id) },
        { $set: promptToSave },
        { returnDocument: 'after' }
      );
      
      return result.value;
    } else {
      // Create new prompt
      promptToSave.createdAt = now;
      promptToSave.active = promptToSave.active || false;
      
      const result = await collection.insertOne(promptToSave);
      return { _id: result.insertedId, ...promptToSave };
    }
  } catch (error) {
    console.error('Error saving system prompt:', error);
    throw error;
  }
}

/**
 * Delete system prompt from database
 * @param {Object} db - MongoDB database instance
 * @param {string} id - ID of prompt to delete
 * @returns {Promise<boolean>} - Success status
 */
async function deleteSystemPrompt(db, id) {
  try {
    if (!db.ObjectId.isValid(id)) {
      throw new Error('Invalid system prompt ID');
    }
    
    const collection = db.collection('systemPrompts');
    const result = await collection.deleteOne({ _id: new db.ObjectId(id) });
    
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting system prompt:', error);
    throw error;
  }
}

/**
 * Set a system prompt as active (and deactivate others)
 * @param {Object} db - MongoDB database instance
 * @param {string} id - ID of prompt to activate
 * @returns {Promise<Object>} - Activated prompt
 */
async function setActiveSystemPrompt(db, id) {
  try {
    if (!db.ObjectId.isValid(id)) {
      throw new Error('Invalid system prompt ID');
    }
    
    const collection = db.collection('systemPrompts');
    
    // Deactivate all prompts
    await collection.updateMany({}, { $set: { active: false } });
    
    // Activate the selected prompt
    const result = await collection.findOneAndUpdate(
      { _id: new db.ObjectId(id) },
      { $set: { active: true, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    return result.value;
  } catch (error) {
    console.error('Error activating system prompt:', error);
    throw error;
  }
}

/**
 * Get the currently active system prompt
 * @param {Object} db - MongoDB database instance
 * @returns {Promise<Object|null>} - Active system prompt or null
 */
async function getActiveSystemPrompt(db) {
  try {
    const collection = db.collection('systemPrompts');
    return await collection.findOne({ active: true });
  } catch (error) {
    console.error('Error fetching active system prompt:', error);
    throw error;
  }
}

module.exports = {
  getSystemPrompt,
  saveSystemPrompt,
  deleteSystemPrompt,
  setActiveSystemPrompt,
  getActiveSystemPrompt
};