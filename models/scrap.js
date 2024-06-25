const puppeteer = require('puppeteer');
const { moduleCompletion } = require('./openai');  // Ensure you have this module properly set up for OpenAI completion
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Function to fetch text from a given URL
 * @param {string} url - The URL to fetch the text from
 * @returns {Promise<string>} - The extracted text from the URL
 */
async function fetchTextFromURL(url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, img, link').remove();

    // Extract text from specific elements
    const text = $('body')
      .find('p, h1, h2, h3, h4, h5, h6, li, blockquote')
      .map((i, el) => $(el).text())
      .get()
      .join(' ');

    return text.trim();
  } catch (error) {
    console.error('Error fetching URL:', error);
    throw error;
  }
}

async function processURL(url) {
    try {
      const text = await fetchTextFromURL(url);
      const messages = [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'You are a japanese assistant. You summarize the key points of the main content from the provided text in japanese.'
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: text
            }
          ]
        }
      ];
      const result = await moduleCompletion(messages);
      return result;
    } catch (error) {
      console.error('Error processing URL:', error);
      throw error;
    }
  }
  
async function captureScreenshot(url) {
    // Launch a new browser instance
    const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox"]
    });
    const page = await browser.newPage();
    
    // Navigate to the provided URL
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // Wait for 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Set the viewport to capture the entire page
    const dimensions = await page.evaluate(() => {
        return {
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight
        };
    });
    await page.setViewport({
        width: dimensions.width,
        height: dimensions.height
    });

    // Capture a full-page screenshot
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    
    // Close the browser
    await browser.close();
    
    // Save the screenshot to a file for debugging
    const screenshotPath = path.join(__dirname, 'screenshot.png');
    fs.writeFileSync(screenshotPath, screenshotBuffer);
    
    // Convert screenshot buffer to base64
    const base64Image = screenshotBuffer.toString('base64');
    
    return base64Image;
}

async function analyzeScreenshot(url) {
    try {
        // Capture the screenshot and get the base64 encoded string
        const base64Image = await captureScreenshot(url);
        
        // Prepare the messages for OpenAI
        const messages = [
            {
                "role": "system",
                "content": [
                    {
                      "type": "text",
                      "text": "You are a japanese assistant.Look at the screenshot and provide a summary in japanese of the main content."
                    }
                  ]
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": `data:image/png;base64,${base64Image}`
                        }
                    }
                ]
            }
        ];
        
        // Call the OpenAI module completion function
        const result = await moduleCompletion(messages);
        
        // Return the result
        return result;
    } catch (error) {
        console.error("Error analyzing screenshot:", error);
    }
}

module.exports = {analyzeScreenshot,processURL}