// Function to get the current counter value from the database
async function getCounter(db) {
  const counterDoc = await db.collection('counters').findOne({ _id: 'storyCounter' });
  return counterDoc && !isNaN(counterDoc.value) ? counterDoc.value : 0;
}

  // Function to update the counter value in the database
  async function updateCounter(db, value) {
    await db.collection('counters').updateOne({ _id: 'storyCounter' }, { $set: { value: value } }, { upsert: true });
  }
  module.exports = { getCounter, updateCounter, }