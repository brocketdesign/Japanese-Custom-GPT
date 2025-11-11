const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const dbName = process.env.MONGODB_NAME || process.env.DB_NAME || 'lamix';

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function connect() {
  try {
    if (!uri) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }
    await client.connect();
    console.log('Connected to MongoDB');
    console.log('Using database:', dbName);
    return client.db(dbName);
  } catch (error) {
    console.error('Could not connect to db', error);
    console.error('MongoDB URI defined:', !!uri);
    console.error('Database name:', dbName);
    process.exit(1);
  }
}

module.exports = { connect };
