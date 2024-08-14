const { ObjectId } = require('mongodb');
const axios = require('axios');
const aws = require('aws-sdk');
const { handleFileUpload, uploadToS3 } = require('../models/tool');

async function routes(fastify, options) {
  // Configure AWS S3
  const s3 = new aws.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
  });
  
}

module.exports = routes;
