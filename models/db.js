const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function connect() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    return client.db('quizApp'); // change db name as per your requirement
  } catch (error) {
    console.error('Could not connect to db', error);
    process.exit(1);
  }
}

module.exports = { connect };
