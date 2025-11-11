require('dotenv').config();

async function testModels() {
  try {
    console.log('Testing database models...');
    
    // Test database connection first
    const { connect } = require('./models/db');
    const db = await connect();
    console.log('✅ Database connected');
    
    // Test models loading
    const { getAvailableModelsFormatted } = require('./models/chat-model-utils');
    const models = await getAvailableModelsFormatted();
    
    console.log('✅ Models loaded from database:');
    Object.entries(models).forEach(([key, model]) => {
      console.log(`  - ${key}: ${model.displayName} (${model.provider}, ${model.category})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testModels();
