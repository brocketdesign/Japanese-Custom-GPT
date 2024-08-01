
    
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
          const response = await axios.get('https://www.gohiai.com/ja-jp');
          const $ = cheerio.load(response.data);
    
          const charactersData = [];
          $('.character-card-wrapper').each((index, element) => {
            const chatImageUrl = $(element).find('img.poster').attr('src');
            const name = $(element).find('a.nick').text();
            const description = $(element).find('.intro').text();
            const profileLink = 'https://www.gohiai.com' + $(element).find('a.nick').attr('href');
    
            charactersData.push({
              chatImageUrl,
              name,
              description,
              language: 'japanese',
              visibility: 'public',
              scrap: true,
              ext: 'gohiai',
              profileLink,
            });
          });
          let  i = 1
          for (const character of charactersData) {
            console.log(`${i}/${charactersData.length}`)
            const existingChat = await collection.findOne({ name: character.name });
            if(existingChat && existingChat.rule){
                i++
                return
            }
            if (existingChat) {
              await collection.updateOne({ name: character.name }, { $set: character });
            } else {
              await collection.insertOne(character);
            }
    
            // Loop through each character and update the rule
            const profileResponse = await axios.get(character.profileLink);
            const profile$ = cheerio.load(profileResponse.data);
            const rule = profile$('.profile-inner .character-info p:nth-child(4)').text();
            console.log({rule})
            await collection.updateOne({ name: character.name }, { $set: { rule } });

            i++
          }
    
          console.log(charactersData.length);
          reply.send({ status: 'Done' });
        }
    
        scrapeGohiai();
      });
  }

  module.exports = routes;
  