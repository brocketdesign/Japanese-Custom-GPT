
    
const { ObjectId } = require('mongodb');
const axios = require('axios');
const cheerio = require('cheerio');

async function routes(fastify, options) {
  fastify.get('/scraper/zeta', (request, reply) => {
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
    fastify.get('/scraper/gohiai', async (request, reply) => {
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
    
        async function scrapeGohiai() {
          const response = await axios.get('https://www.gohiai.com/ja-jp/ai-explore/pt_odj3G4fxzlNDa7uKf2K3');
          const $ = cheerio.load(response.data);
    
          const charactersData = [];
          $('.character-card-wrapper').each((index, element) => {
            const chatImageUrl = $(element).find('img.poster').attr('src');
            const name = $(element).find('a.nick').text();
            const description = $(element).find('.intro').text();
            const num_message = $(element).find('.participation').text();
            const profileLink = 'https://www.gohiai.com' + $(element).find('a.nick').attr('href');
    
            charactersData.push({
                category: 'いじめる',
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
      
      fastify.get('/scraper/civitai', async (request, reply) => {
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
                        
              console.log(index+1,responseData.items.length)
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


  }

  module.exports = routes;
  