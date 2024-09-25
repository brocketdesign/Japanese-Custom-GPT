
    
const { ObjectId } = require('mongodb');
const axios = require('axios');
const cheerio = require('cheerio');
const aws = require('aws-sdk');
const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
const  { checkUserAdmin } = require('../models/tool')

async function routes(fastify, options) {


  // Configure AWS S3
  const s3 = new aws.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
  });
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
    const handleFileUpload = async (part) => {
      const chunks = [];
      for await (const chunk of part.file) {
          chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const hash = createHash('md5').update(buffer).digest('hex');
      const existingFiles = await s3.listObjectsV2({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Prefix: hash,
      }).promise();
      if (existingFiles.Contents.length > 0) {
          return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFiles.Contents[0].Key}`;
      } else {
          return uploadToS3(buffer, hash, part.filename);
      }
  };
  fastify.get('/scraper/zeta', async(request, reply) => {
      
  let user = request.user;
  const isAdmin = await checkUserAdmin(fastify, user._id);
      if (!isAdmin) {
          return reply.status(403).send({ error: 'Access denied' });
      }
      const puppeteer = require('puppeteer');
    
      const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
    
      async function scrapeZetaAi() {
        const browser = await puppeteer.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
    
        // Navigate to the first URL
        await page.goto('https://zeta-ai.io/ja?tab=category');
    
        // Open a new tab for the API URL
        const apiPage = await browser.newPage();
        await apiPage.goto('https://api.zeta-ai.io/v1/characters?limit=50');
    
        // Get the data from the API page
        const charactersData = await apiPage.evaluate(() => {
          return JSON.parse(document.body.textContent);
        });
    
        // Loop through the characters data and extract the desired fields
        const chatsData = charactersData.characters.map((character) => {
          return {
            name: character.name || '',
            chatImageUrl: character.profileImageUrl,
            description: character.shortDescription,
            rule: character.longDescription,
            category: character.categories[0]? character.categories[0].name : '',
            language: 'japanese',
            visibility: 'public',
            scrap: true,
            ext: 'zeta'
          };
        });
    
        // Insert or update the data into the MongoDB collection
        for (const chat of chatsData) {
          const existingChat = await collection.findOne({ name: chat.name });
          if (existingChat) {
            await collection.updateOne({ name: chat.name }, { $set: chat });
          } else {
            await collection.insertOne(chat);
          }
        }
        console.log(chatsData.length)
        // Close the browser
        await browser.close();
      }
    
      scrapeZetaAi();
    
      reply.send({ status: 'Done' })
    });
    fastify.get('/scraper/gohiai/update-images', async (request, reply) => {
      
  let user = request.user;
  const isAdmin = await checkUserAdmin(fastify, user._id);
      if (!isAdmin) {
          return reply.status(403).send({ error: 'Access denied' });
      }
      const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
    
      async function updateImages() {
        const characters = await collection.find({ scrap: true, ext: 'gohiai' }).toArray();
    
        let i = 1;
        for (const character of characters) {
          console.log(`${i}/${characters.length}`);
    
          if (!character.chatImageUrl.includes('lamix')) {
            try {
              console.log(`Uploading image for: ${character.name}, ${character.chatImageUrl}`);
              const imageBuffer = await axios.get(character.chatImageUrl, { responseType: 'arraybuffer' });
              const hash = createHash('md5').update(imageBuffer.data).digest('hex');
              const imageUrl = await handleFileUpload({ file: [imageBuffer.data], filename: `${hash}.jpg` });
              await collection.updateOne({ _id: character._id }, { $set: { chatImageUrl: imageUrl } });
            } catch (error) {
              console.error(`Error uploading image for ${character.name}:`, error);
              // You can add additional error handling here, such as logging the error or retrying the upload
            }
          } else {
            console.log(`Image already exists for: ${character.name} ${character.chatImageUrl}`);
          }
    
          i++;
        }
        
        reply.send({ status: 'Done' });
      }
    
      updateImages();
    });
    
    
    fastify.get('/scraper/gohiai', async (request, reply) => {
      
  let user = request.user;
  const isAdmin = await checkUserAdmin(fastify, user._id);
      if (!isAdmin) {
          return reply.status(403).send({ error: 'Access denied' });
      }
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
    
        async function scrapeGohiai() {
          const response = await axios.get('https://www.gohiai.com/ja-jp/ai-explore/pt_HEYXw0PF2PVU7Uz8fkzY');
          const $ = cheerio.load(response.data);
    
          const charactersData = [];
          $('.character-card-wrapper').each((index, element) => {
            const chatImageUrl = $(element).find('img.poster').attr('src');
            const name = $(element).find('a.nick').text();
            const description = $(element).find('.intro').text();
            const num_message = $(element).find('.participation').text();
            const profileLink = 'https://www.gohiai.com' + $(element).find('a.nick').attr('href');
    
            charactersData.push({
                category: '彼氏',
                chatImageUrl,
                name,
                description,
                language: 'japanese',
                visibility: 'public',
                scrap: true,
                ext: 'gohiai',
                num_message,
                profileLink,
            });
          });
          let  i = 1
          for (const character of charactersData) {
            console.log(`${i}/${charactersData.length}`)
            const existingChat = await collection.findOne({ name: character.name });

            if (existingChat.chatImageUrl.indexOf('lamix') == -1 ) {
              console.log(`Uploading image for: ${character.name}, ${character.chatImageUrl}`);
              const imageBuffer = await axios.get(character.chatImageUrl, { responseType: 'arraybuffer' });
              const hash = createHash('md5').update(imageBuffer.data).digest('hex');
              const imageUrl = await handleFileUpload({ file: [imageBuffer.data], filename: `${hash}.jpg` });
              character.chatImageUrl = imageUrl;
            } else {
              console.log(`Image already exists for: ${character.name} ${character.chatImageUrl}`);
            }
        
            if (existingChat) {
              await collection.updateOne({ name: character.name }, { $set: character });
            } else {
              await collection.insertOne(character);
            }
    
            // Loop through each character and update the rule
            try {
                const profileResponse = await axios.get(character.profileLink);
                const profile$ = cheerio.load(profileResponse.data);
                const rule = profile$('.character-info p').not('.character-info-author').text();
                await collection.updateOne({ name: character.name }, { $set: { rule } });
            } catch (error) {
                console.error(`Error updating rule for character ${character.name}:`, error);
                // You can also add additional error handling here, such as retrying the request or sending an alert
            }

            i++
          }
          reply.send({ status: 'Done' });
        }
    
        scrapeGohiai();
      });
      fastify.get('/scraper/synclubaichat', async (request, reply) => {
        let user = request.user;
        const isAdmin = await checkUserAdmin(fastify, user._id);
        if (!isAdmin) {
            return reply.status(403).send({ error: 'Access denied' });
        }
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
    
        async function scrapesynclubaichat() {
          const response = await axios.get('https://api.synclubaichat.com/aichat/h5/merror/commonlist?is_guest=1&language=ja&device=web_desktop&product=aichat&sys_lang=en-US&country=&referrer=&zone=9&languageV2=en&uuid=&app_version=1.5.1&ts=1723428680&sign=e8d93192deb4c7d4ff9f604ce96c121f');
          const characters = Array.from(response.data.data)
          const charactersData = [];
          characters.forEach((character, index) => {
              const chatImageUrl = character.thumbnail;
              const name = character.name;
              const description = character.self_introduction + '\n' + character.prologue;
              const category = character.category;
              const tags = character.personality_tag_array;
              const checkpoint = character.sd_prompt ? character.sd_prompt.model : null;
          
              // Map the sd_prompt object into a string prompt
              const prompt = character.sd_prompt ? 
                  Object.entries(character.sd_prompt)
                      .filter(([key]) => key !== "seed" && key !== "model")
                      .map(([key, value]) => value.toString().replace('_', ' ') + (key === "age" ? "" : ","))
                      .join(" ").trim()
                  : "";
          
              const finalPrompt = prompt != '' ? prompt : null;
          
              charactersData.push({
                  category,
                  chatImageUrl,
                  thumbnailUrl:chatImageUrl,
                  name,
                  tags,
                  description,
                  character:{prompt:finalPrompt,checkpoint},
                  language: 'japanese',
                  visibility: 'public',
                  scrap: true,
                  ext: 'synclubaichat',
              });
          });
          let i = 1;
          for (const character of charactersData) {
            console.log(`Processing ${i}/${charactersData.length}: ${character.name}`);
            
            const existingChat = await collection.findOne({ name: character.name });

            if (true) {
              console.log(`Uploading image for: ${character.name}, ${character.chatImageUrl}`);
              const imageBuffer = await axios.get(character.chatImageUrl, { responseType: 'arraybuffer' });
              const hash = createHash('md5').update(imageBuffer.data).digest('hex');
              const imageUrl = await handleFileUpload({ file: [imageBuffer.data], filename: `${hash}.jpg` });
              character.chatImageUrl = imageUrl;
              console.log(`New image URL : ${imageUrl}`)
            } else {
              console.log(`Image already exists for: ${character.name} ${character.chatImageUrl}`);
            }
          
            if (existingChat) {
              console.log(`Updating existing entry for: ${character.name}`);
              await collection.updateOne({ name: character.name }, { $set: character });
            } else {
              console.log(`Inserting new entry for: ${character.name}`);
              await collection.insertOne(character);
            }
          
            i++;
          }
          console.log('Processing complete.');
        
          
          reply.send({ status: 'Done' });
        }
    
        scrapesynclubaichat();
      });
      fastify.get('/scraper/save-tags', async (request, reply) => {
        let user = request.user;
        const isAdmin = await checkUserAdmin(fastify, user._id);
        if (!isAdmin) {
            return reply.status(403).send({ error: 'Access denied' });
        }
        const chatsCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
        const tagsCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('tags');
    
        const chats = await chatsCollection.find({}).toArray();
    
        for (const chat of chats) {
            if (chat.tags && chat.tags.length > 0) {
                for (const tag of chat.tags) {
                    await tagsCollection.updateOne(
                        { name: tag },
                        { $set: { name: tag }, $addToSet: { chatIds: chat._id } },
                        { upsert: true }
                    );
                }
            }
        }
    
        reply.send({ status: 'Tags saved successfully' });
    });
    
      fastify.get('/scraper/civitai', async (request, reply) => {
        let user = request.user;
        const isAdmin = await checkUserAdmin(fastify, user._id);
        if (!isAdmin) {
            return reply.status(403).send({ error: 'Access denied' });
        }
        try {
          const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('characters');
          const nsfw = request.query.nsfw || 'Soft' //(None, Soft, Mature, X)
          const page = parseInt(request.query.page, 10) || 0; // Convert the page to an integer and default to 0 if not provided
          const civit_checkpoint = request.query.checkpoint
          const civit_model = request.query.modelId
          // Determine the number of elements to skip based on the page
          const elementsPerPage = 10;
          const skipElements = (page-1) * elementsPerPage;

          // Query the database to find existing records
          const existingCharacters = await collection
          .find({ checkpointId: civit_model, nsfw, ext: 'civitai'})
          .skip(skipElements)
          .limit(elementsPerPage)
          .toArray();
          
            // If there are already 10 elements, return them
          if (existingCharacters.length === elementsPerPage) {
            return reply.send({ status: 'Success', characters: existingCharacters });
          }
      
          // If there are less than 10 elements, scrape additional data
          async function scrapeCivitai() {
            const response = await axios.get(`https://civitai.com/api/v1/images?limit=10&modelId=${civit_model}&page=${page}&nsfw=${nsfw}`);
            const responseData = response.data; // No need to parse if already in JSON format
            const charactersData = [];
            responseData.items.forEach(({ url: image, meta: elMeta, nsfwLevel }, index) => {
              if (!elMeta) return;
                charactersData.push({
                  checkpoint: civit_checkpoint,
                  image,
                  checkpointId: civit_model,
                  nsfwLevel,
                  prompt: elMeta.prompt,
                  negativePrompt: elMeta.negativePrompt,
                  sampler: elMeta.sampler,
                  visibility: 'public',
                  scrap: true,
                  nsfw,
                  ext: 'civitai',
                });
            });
            let i = 1;
            for (const character of charactersData) {
              const existingChat = await collection.findOne({ image: character.image });
              if (existingChat) {
                await collection.updateOne({ image: character.image }, { $set: character });
              } else {
                await collection.insertOne(character);
              }
              i++;
            }
      
            // After scraping, fetch the updated list of characters to return
            const updatedCharacters = await collection
              .find({ checkpointId: civit_model, nsfw, ext: 'civitai'})
              .skip(skipElements)
              .limit(elementsPerPage)
              .toArray();
              
            reply.send({ status: 'Scraped and Retrieved', characters: updatedCharacters });
          }
      
          // Only call scrapeCivitai if less than 10 elements are found
          if (existingCharacters.length < elementsPerPage) {
            await scrapeCivitai();
          } else {
            // If there are already enough characters, just return them
            return reply.send({ status: 'Success', characters: existingCharacters });
          }
        } catch (error) {
          console.log(error);
          return reply.status(500).send({ status: 'Error', message: 'An error occurred while processing the request.' });
        }
      });

      // Define the route with MongoDB integration
fastify.get('/scraper/civitai/categories', async (request, reply) => {
  
  let user = request.user;
  const isAdmin = await checkUserAdmin(fastify, user._id);
  if (!isAdmin) {
      return reply.status(403).send({ error: 'Access denied' });
  }
    const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('categories');
    const nsfw = request.query.nsfw || false
    const categories = await collection.aggregate([
      { 
        $match: { 
          image: { $exists: true, $ne: null }, 
          nsfw: nsfw 
        } 
      },
      { 
        $sample: { size: 20 } // Randomly select 20 documents
      }
    ]).toArray();    
    return reply.send({ status: 'Success', categories });
    try {
        const limit = parseInt(request.query.limit, 10) || 100;
        const types = request.query.types || 'Checkpoint';
        const query = request.query.query|| 'japanese anime'
        const page = request.query.page || Math.floor(Math.random() * 10) + 1;
        // Construct the API URL
        const apiUrl = new URL(`https://civitai.com/api/v1/models?limit=${limit}&types=${types}&nsfw=${nsfw}&page=${page}`).href;

        console.log({query,page,apiUrl})
        // Fetch data from the API
        const response = await axios.get(apiUrl);
        const responseData = response.data;

        // Prepare categories
        const categories = responseData.items.map(item => ({
            id: item.id,
            name: item.name,
            image: item.modelVersions[0]?.images[0]?.url || '',
            nsfw
        }));

        // Upsert categories in the MongoDB collection
        for (const category of categories) {
            const existingCategory = await collection.findOne({ id: category.id });
            if (existingCategory) {
                await collection.updateOne({ id: category.id }, { $set: category });
            } else {
                await collection.insertOne(category);
            }
        }

        // Send the categories as response
        reply.send({ status: 'Success', categories });
    } catch (error) {
        console.log(error);
        reply.status(500).send({ status: 'Error', message: 'An error occurred while processing the request.' });
    }
});

fastify.get('/scraper/download-images', async (request, reply) => {
  let user = request.user;
  const isAdmin = await checkUserAdmin(fastify, user._id);
  if (!isAdmin) {
      return reply.status(403).send({ error: 'Access denied' });
  }
  try {
      const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
      const characters = await collection.find({ ext: 'synclubaichat' }).toArray();

      const baseDownloadDirectory = path.join(__dirname, '../public/download');

      for (const character of characters) {
          let gender = character.prompt?.toLowerCase();

          if (gender) {
              if (/\bmale\b/.test(gender)) {
                  gender = "male";
              } else if (/\bfemale\b/.test(gender)) {
                  gender = "female";
              } else {
                  gender = "other";
              }

              const downloadDirectory = path.join(baseDownloadDirectory, gender);
              if (!fs.existsSync(downloadDirectory)) {
                  fs.mkdirSync(downloadDirectory, { recursive: true });
              }

              const filePath = path.join(downloadDirectory, `${character._id}.jpg`);
              if (!fs.existsSync(filePath)) {
                  const imageBuffer = await axios.get(character.chatImageUrl, { responseType: 'arraybuffer' });
                  fs.writeFileSync(filePath, imageBuffer.data);
                  console.log(`Downloaded image for ${character.name} as ${character._id}.jpg into ${gender} folder`);
              } else {
                  console.log(`Image for ${character.name} as ${character._id}.jpg already exists in ${gender} folder`);
              }
          } else {
              console.log(`Skipped ${character.name} as gender is not present or recognizable`);
          }
      }

      reply.send({ status: 'Image download complete' });
  } catch (error) {
      console.error('Error during image download:', error);
      reply.status(500).send({ status: 'Error during image download', error: error.message });
  }
});


fastify.get('/scraper/upload-images', async (request, reply) => {
  
  let user = request.user;
  const isAdmin = await checkUserAdmin(fastify, user._id);
  if (!isAdmin) {
      return reply.status(403).send({ error: 'Access denied' });
  }
  try {
      const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
      const uploadDirectory = path.join(__dirname, '../public/upload/male'); // Same as download directory

      const files = fs.readdirSync(uploadDirectory);

      for (const file of files) {
          const _id = file.replace('.png', '');
          const filePath = path.join(uploadDirectory, file);
          const imageBuffer = fs.readFileSync(filePath);

          // Verify that the document exists in the database
          const character = await collection.findOne({ _id: new fastify.mongo.ObjectId(_id) });

          if (character) {
              const hash = createHash('md5').update(imageBuffer).digest('hex');
              const imageUrl = await handleFileUpload({ file: [imageBuffer], filename: `${hash}.jpg` });

              const updatedChat = await collection.updateOne(
                  { _id: new fastify.mongo.ObjectId(_id) },
                  { $set: { chatImageUrl: imageUrl } }
              );

              if (updatedChat.matchedCount > 0) {
                  console.log(`Updated image URL for _id: ${_id}`);
              } else {
                  console.log(`Failed to update image URL for _id: ${_id}`);
              }
          } else {
              console.log(`No character found with _id: ${_id}, skipping upload.`);
          }
      }

      reply.send({ status: 'Image upload and update complete' });
  } catch (error) {
      console.error('Error during image upload:', error);
      reply.status(500).send({ status: 'Error during image upload', error: error.message });
  }
});

fastify.get('/scraper/create-characters', async (request, reply) => {
  
  let user = request.user;
  const isAdmin = await checkUserAdmin(fastify, user._id);
  if (!isAdmin) {
      return reply.status(403).send({ error: 'Access denied' });
  }
  try {
      const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('characters');
      const baseDirectory = path.join(__dirname, '../public/upload');

      const categories = fs.readdirSync(baseDirectory);

      for (const gender of categories) {
          if (!fs.statSync(path.join(baseDirectory, gender)).isDirectory()) continue;
          const genderDir = path.join(baseDirectory, gender);
          const subCategories = fs.readdirSync(genderDir);

          for (const category of subCategories) {
              if (!fs.statSync(path.join(genderDir, category)).isDirectory()) continue;
              const categoryDir = path.join(genderDir, category);
              const files = fs.readdirSync(categoryDir);

              for (const file of files) {
                  const filePath = path.join(categoryDir, file);
                  const imageBuffer = fs.readFileSync(filePath);

                  const hash = createHash('md5').update(imageBuffer).digest('hex');
                  const imageUrl = await handleFileUpload({ file: [imageBuffer], filename: `${hash}.png` });

                  const newCharacter = {
                      chatImageUrl: imageUrl,
                      category: [gender, category]
                  };

                  const result = await collection.insertOne(newCharacter);

                  if (result.insertedId) {
                      console.log(`Created new character with _id: ${result.insertedId}`);
                  } else {
                      console.log(`Failed to create new character for file: ${file}`);
                  }
              }
          }
      }

      reply.send({ status: 'Character creation complete' });
  } catch (error) {
      console.error('Error during character creation:', error);
      reply.status(500).send({ status: 'Error during character creation', error: error.message });
  }
});



  }

  module.exports = routes;
  