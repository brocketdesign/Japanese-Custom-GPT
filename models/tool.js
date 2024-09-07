const { createHash } = require('crypto');
const aws = require('aws-sdk');
const { ObjectId } = require('mongodb');
const sharp = require('sharp');
const axios = require('axios');
const crypto = require('crypto');
const stream = require('stream');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const adminEmails = ['japanclassicstore@gmail.com','didier@line.com','e2@gmail.com']; // Add your admin emails here

async function checkUserAdmin(fastify, userId) {
    const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
    const user = await usersCollection.findOne({_id: new ObjectId(userId)});
    if (!user) {
        throw new Error('User not found');
    }
    return adminEmails.includes(user.email);
}
// Configure AWS S3
const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const getS3Stream = (bucket, key) => {
    return s3.getObject({ Bucket: bucket, Key: key }).createReadStream();
};
// Function to get the current counter value from the database
async function getCounter(db) {
  const counterDoc = await db.collection('counters').findOne({ _id: 'storyCounter' });
  return counterDoc && !isNaN(counterDoc.value) ? counterDoc.value : 0;
}

  // Function to update the counter value in the database
  async function updateCounter(db, value) {
    await db.collection('counters').updateOne({ _id: 'storyCounter' }, { $set: { value: value } }, { upsert: true });
  }
  async function deleteObjectFromUrl(url) {
    const bucket = url.split('.')[0].split('//')[1];  // Extract bucket from URL
    const key = url.split('.com/')[1];  // Extract key from URL

    const params = {
        Bucket: bucket,
        Key: key
    };

    try {
        await s3.deleteObject(params).promise();
        return 'Object deleted successfully';
    } catch (error) {
        throw new Error(`Error deleting object: ${error.message}`);
    }
};
  const uploadToS3 = async (buffer, hash, filename) => {
    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `${hash}_${filename}`,
        Body: buffer,
        ACL: 'public-read'
    };
    const uploadResult = await s3.upload(params).promise();
    return uploadResult.Location;
};

const isValidUrl = (string) => {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
};
async function checkLimits(fastify,userId) {
    const today = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });

    const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
    const user = await userDataCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });

    const messageCountCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('MessageCount');
    const messageCountDoc = await messageCountCollection.findOne({ userId: new fastify.mongo.ObjectId(userId), date: today });

    const chatCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
    const chatCount = await chatCollection.countDocuments({ userId: new fastify.mongo.ObjectId(userId) });

    const imageCountCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('ImageCount');
    const imageCountDoc = await imageCountCollection.findOne({ userId: new fastify.mongo.ObjectId(userId), date: today });

    const messageIdeasCountCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('MessageIdeasCount');
    const messageIdeasCountDoc = await messageIdeasCountCollection.findOne({ userId: new fastify.mongo.ObjectId(userId), date: today });

    const isTemporary = user.isTemporary;
    let messageLimit = isTemporary ? 10 : 50;
    let chatLimit = isTemporary ? 1 : '無制限';
    let imageLimit = isTemporary ? 1 : '無制限';
    let messageIdeasLimit = isTemporary ? 3 : 10;

    if (!isTemporary) {
        const existingSubscription = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('subscriptions').findOne({
            _id: new fastify.mongo.ObjectId(userId),
            subscriptionStatus: 'active',
        });

        if (existingSubscription) {
            const billingCycle = existingSubscription.billingCycle;
            const currentPlanId = existingSubscription.currentPlanId;
            const plansFromDb = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('plans').findOne();
            const plans = plansFromDb.plans;
            const plan = plans.find((plan) => plan[`${billingCycle}_id`] === currentPlanId);

            messageLimit = plan?.messageLimit || messageLimit;
            chatLimit = plan?.chatLimit || chatLimit;
            imageLimit = plan?.imageLimit || imageLimit;
            messageIdeasLimit = plan?.messageIdeasLimit || messageIdeasLimit;
        }
    }

    const limitIds = [];

    if (messageCountDoc && messageCountDoc.count >= messageLimit) {
        limitIds.push(1);
    }

    if (chatLimit && chatCount >= chatLimit) {
        limitIds.push(2);
    }

    if (imageCountDoc && imageCountDoc.count >= imageLimit) {
        limitIds.push(3);
    }

    if (messageIdeasCountDoc && messageIdeasCountDoc.count >= messageIdeasLimit) {
        limitIds.push(4);
    }

    if (limitIds.length > 0) {
        return { limitIds, messageCountDoc, chatCount, imageCountDoc, messageIdeasCountDoc, messageLimit, chatLimit, imageLimit, messageIdeasLimit };
    }

    return { messageCountDoc, chatCount, imageCountDoc, messageIdeasCountDoc, messageLimit, chatLimit, imageLimit, messageIdeasLimit };
}


async function convertImageUrlToBase64(imageUrl) {
    try {
        let buffer;

        // Check if it's a URL or file path
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer'
            });
            buffer = Buffer.from(response.data, 'binary');
        } else {
            buffer = await fs.readFile(path.resolve(imageUrl));
        }

        // Compress and resize the image using sharp
        const compressedBuffer = await sharp(buffer)
            .resize(800, 800, { 
                fit: sharp.fit.inside,
                withoutEnlargement: true
            })
            .jpeg({ quality: 70 })
            .toBuffer();

        const base64Image = compressedBuffer.toString('base64');
        return `data:image/jpeg;base64,${base64Image}`;
    } catch (error) {
        throw new Error('Failed to convert and compress image to Base64');
    }
}


// Utility to convert a stream to a buffer
const streamToBuffer = async (readableStream) => {
    const chunks = [];
    for await (const chunk of readableStream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

const handleFileUpload = async (part, db) => {
    let buffer;
    if (part.file) {
        const chunks = [];
        for await (const chunk of part.file) {
            chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
    } else if (part.value && isValidUrl(part.value)) {
        const response = await axios.get(part.value, { responseType: 'arraybuffer' });
        buffer = Buffer.from(response.data, 'binary');
    } else {
        throw new Error('No valid file or URL provided');
    }

    const hash = createHash('md5').update(buffer).digest('hex');
    const awsimages = db.collection('awsimages');

    // Check if the image already exists in MongoDB
    const existingFile = await awsimages.findOne({ hash });
    if (existingFile) {
        console.log(`Already exists in DB`);
        return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFile.key}`;
    }

    // If not in DB, check S3
    const existingFiles = await s3.listObjectsV2({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Prefix: hash,
    }).promise();
    
    if (existingFiles.Contents.length > 0) {
        console.log(`Already exists in S3`);
        await awsimages.insertOne({ key: existingFiles.Contents[0].Key, hash });
        return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFiles.Contents[0].Key}`;
    } else {
        const uploadUrl = await uploadToS3(buffer, hash, part.filename || 'uploaded_file');
        await awsimages.insertOne({ key: uploadUrl.split('/').pop(), hash });
        return uploadUrl;
    }
};

const createBlurredImage = async (imageUrl, db) => {
    try {
        const blurLevel = 50
        const urlParts = imageUrl.split('/');
        const s3Key = decodeURIComponent(urlParts.slice(3).join('/'));

        const awsimages = db.collection('awsimages');

        // Get the original image as a stream from S3
        const imageStream = getS3Stream(process.env.AWS_S3_BUCKET_NAME, s3Key);
        const imageBuffer = await streamToBuffer(imageStream);

        // Process the image using sharp (blur and resize)
        const processedImageBuffer = await sharp(imageBuffer)
            .blur(blurLevel)
            .toBuffer();

        // Generate a hash for the processed (blurred) image buffer
        const hash = crypto.createHash('md5').update(processedImageBuffer).digest('hex');

        // Check if the blurred image already exists in the database
        const existingFile = await awsimages.findOne({ hash });
        if (existingFile) {
            console.log(`Blurred image already exists in DB`);
            return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFile.key}`;
        }

        // Check if the blurred image already exists in S3
        const existingFiles = await s3.listObjectsV2({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Prefix: hash,
        }).promise();

        if (existingFiles.Contents.length > 0) {
            console.log(`Blurred image already exists in S3`);
            const blurredKey = existingFiles.Contents[0].Key;
            await awsimages.insertOne({ key: blurredKey, hash });
            return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${blurredKey}`;
        }

        // Upload the blurred image to S3
        const filename = `${hash}_${urlParts[urlParts.length - 1]}`;
        const uploadUrl = await uploadToS3(processedImageBuffer, hash, filename);

        // Save the blurred image key and hash in the database
        await awsimages.insertOne({ key: filename, hash });

        return uploadUrl;
    } catch (error) {
        console.error('Error creating blurred image:', error.message);
        throw new Error('Failed to process the image.');
    }
};


  module.exports = { getCounter, 
    updateCounter, 
    handleFileUpload, 
    uploadToS3, 
    checkLimits, 
    checkUserAdmin, 
    convertImageUrlToBase64,
    createBlurredImage,
    deleteObjectFromUrl
}