#!/usr/bin/env node
/*
Investigation script: Reconcile task → gallery → userChat for image/merge pipeline
Usage:
  node scripts/investigate-image-task/index.js --taskId <taskId> [--userChatId <userChatId>] [--chatId <chatId>] [--userId <userId>]

Requires env:
  MONGODB_URI, MONGODB_NAME
*/

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

function arg(key, fallback = undefined) {
  const idx = process.argv.findIndex(a => a === `--${key}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch (e) {
    return null;
  }
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

(async () => {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_NAME;
  const taskId = arg('taskId');
  const userChatIdArg = arg('userChatId');
  const chatIdArg = arg('chatId');
  const userIdArg = arg('userId');

  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI or MONGODB_NAME in env');
    process.exit(1);
  }
  if (!taskId) {
    console.error('Usage: --taskId <taskId> [--userChatId <userChatId>] [--chatId <chatId>] [--userId <userId>]');
    process.exit(1);
  }

  const client = new MongoClient(uri, { ignoreUndefined: true });
  await client.connect();
  const db = client.db(dbName);

  try {
    const tasksCol = db.collection('tasks');
    const galleryCol = db.collection('gallery');
    const userChatCol = db.collection('userChat');

    const task = await tasksCol.findOne({ taskId });
    if (!task) {
      console.error(`[investigate] Task not found: ${taskId}`);
      process.exit(2);
    }

    const taskImages = (task.result && Array.isArray(task.result.images)) ? task.result.images : [];

    // Collect identifiers
    const imageUrls = uniq(taskImages.map(i => i.imageUrl));
    const originalImageUrls = uniq(taskImages.map(i => i.originalImageUrl).filter(Boolean));
    const mergeIds = uniq(taskImages.map(i => i.mergeId).filter(Boolean));
    const taskUserChatId = task.userChatId ? task.userChatId.toString() : null;
    const taskChatId = task.chatId ? task.chatId.toString() : null;
    const taskUserId = task.userId ? task.userId.toString() : null;

    // Query gallery by multiple linkage hints
    const galleryDocs = await galleryCol.find({
      $or: [
        { 'images.taskId': taskId },
        { 'images.imageUrl': { $in: imageUrls } },
        { 'images.originalImageUrl': { $in: originalImageUrls } },
        { 'images.mergeId': { $in: mergeIds } }
      ]
    }).toArray();

    // Flatten matched gallery images
    const galleryMatches = [];
    for (const doc of galleryDocs) {
      for (const img of (doc.images || [])) {
        if (
          img.taskId === taskId ||
          imageUrls.includes(img.imageUrl) ||
          (img.originalImageUrl && originalImageUrls.includes(img.originalImageUrl)) ||
          (img.mergeId && mergeIds.includes(img.mergeId))
        ) {
          galleryMatches.push({
            parentId: doc._id.toString(),
            userId: doc.userId ? doc.userId.toString() : null,
            chatId: doc.chatId ? doc.chatId.toString() : null,
            ...img,
            _id: img._id ? img._id.toString() : undefined
          });
        }
      }
    }

    // Build additional lookups from gallery matches:
    const allMergeIds = uniq([
      ...mergeIds,
      ...galleryMatches.map(m => m.mergeId).filter(Boolean)
    ]);
    const allOriginalUrls = uniq([
      ...originalImageUrls,
      ...galleryMatches.map(m => m.originalImageUrl).filter(Boolean)
    ]);
    const allResultUrls = uniq([
      ...imageUrls,
      ...galleryMatches.map(m => m.imageUrl).filter(Boolean)
    ]);

    // Find userChat candidates
    const candidateUserChatId = userChatIdArg || taskUserChatId || null;

    let userChatDocs = [];
    if (candidateUserChatId && toObjectId(candidateUserChatId)) {
      const uc = await userChatCol.findOne({ _id: toObjectId(candidateUserChatId) });
      if (uc) userChatDocs = [uc];
    }
    // If not found, broaden search: by userId/chatId or by messages matching URLs/mergeIds
    if (userChatDocs.length === 0) {
      const or = [];
      if (allMergeIds.length) or.push({ 'messages.mergeId': { $in: allMergeIds } });
      if (allResultUrls.length) or.push({ 'messages.imageUrl': { $in: allResultUrls } });
      if (or.length) {
        const base = {};
        if (userIdArg && toObjectId(userIdArg)) base.userId = toObjectId(userIdArg);
        if (chatIdArg && toObjectId(chatIdArg)) base.chatId = toObjectId(chatIdArg);
        userChatDocs = await userChatCol.find({
          ...(Object.keys(base).length ? base : {}),
          $or: or
        }).limit(10).toArray();
      }
    }

    // Extract relevant messages
    const userChatMatches = [];
    for (const uc of userChatDocs) {
      const messages = Array.isArray(uc.messages) ? uc.messages : [];
      for (const msg of messages) {
        const isImageMsg = !!(msg.imageUrl || msg.imageId || msg.mergeId || msg.type === 'image' || msg.type === 'mergeFace');
        if (!isImageMsg) continue;
        const match = (
          (msg.mergeId && allMergeIds.includes(String(msg.mergeId))) ||
          (msg.imageUrl && allResultUrls.includes(msg.imageUrl))
        );
        if (match) {
          userChatMatches.push({
            userChatId: uc._id.toString(),
            ...msg,
            imageId: msg.imageId ? String(msg.imageId) : undefined
          });
        }
      }
    }

    // Compute duplicates by originalImageUrl among merged
    const mergedByOriginal = {};
    for (const g of galleryMatches.filter(g => g.isMerged && g.originalImageUrl)) {
      mergedByOriginal[g.originalImageUrl] = mergedByOriginal[g.originalImageUrl] || [];
      mergedByOriginal[g.originalImageUrl].push(g);
    }

    const duplicateSets = Object.entries(mergedByOriginal)
      .filter(([, arr]) => arr.length > 1)
      .map(([originalUrl, arr]) => ({ originalUrl, count: arr.length, merges: arr.map(m => ({ mergeId: m.mergeId, imageUrl: m.imageUrl, createdAt: m.createdAt })) }));

    // Timeline (best-effort): gather events with timestamps
    const events = [];
    for (const ti of taskImages) {
      events.push({ type: 'task-image', when: task.updatedAt || task.createdAt, data: ti });
    }
    for (const g of galleryMatches) {
      events.push({ type: 'gallery', when: g.createdAt || null, data: g });
    }
    for (const m of userChatMatches) {
      const when = m.createdAt || m.timestamp || null;
      events.push({ type: 'userChat', when, data: m });
    }
    events.sort((a, b) => {
      const ta = a.when ? new Date(a.when).getTime() : 0;
      const tb = b.when ? new Date(b.when).getTime() : 0;
      return ta - tb;
    });

    const report = {
      task: {
        taskId: task.taskId,
        status: task.status,
        userId: taskUserId,
        chatId: taskChatId,
        userChatId: taskUserChatId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        imageCount: taskImages.length
      },
      taskImages: taskImages.map(i => ({
        imageUrl: i.imageUrl,
        originalImageUrl: i.originalImageUrl,
        mergeId: i.mergeId,
        isMerged: !!i.isMerged,
        seed: i.seed
      })),
      galleryMatches,
      userChatMatches,
      duplicatesByOriginal: duplicateSets,
      timeline: events
    };

    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    console.error('[investigate] Error:', err);
    process.exit(3);
  } finally {
    await client.close();
  }
})();
