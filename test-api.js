require('dotenv').config();

async function testAPI() {
  try {
    console.log('Testing chat settings models API...');
    
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    
    // Test API endpoint
    const response = await fetch('http://localhost:3000/api/chat-tool-settings/models/507f1f77bcf86cd799439011');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ API Response Status:', response.status);
    console.log('✅ API working - Models returned:');
    
    if (data.models && Object.keys(data.models).length > 0) {
      Object.entries(data.models).forEach(([key, model]) => {
        console.log(`  - ${key}: ${model.displayName} (Provider: ${model.provider}, Category: ${model.category})`);
      });
    } else {
      console.log('  No models found in response');
    }
    
    console.log('✅ User Premium Status:', data.isPremium);
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testAPI();
