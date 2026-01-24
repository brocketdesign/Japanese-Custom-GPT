# AI Character Studio

> 🔞 **Adult Content Warning**: This application contains NSFW (Not Safe For Work) content. Users must be 18+ years old.

## Overview

ChatLamix is a comprehensive platform for creating, customizing, and interacting with AI-powered characters. Generate stunning images and videos of your custom characters, engage in immersive chat conversations, and personalize every aspect of your experience with advanced AI models.

🌐 **Live Application**: [https://app.chatlamix.jp](https://app.chatlamix.jp)

## ✨ Features

### 🎨 Character Creation
- **Custom Character Design** - Create unique AI characters with detailed personality traits, backstories, and visual appearances
- **Character Profiles** - Manage and organize your character collection
- **Similar Characters Discovery** - Find and explore characters similar to your favorites

### 💬 Interactive Chat
- **AI-Powered Conversations** - Engage in dynamic, contextual conversations with your characters
- **Multiple Chat Models** - Choose from various text generation models for different conversation styles
- **Chat History & Gallery** - Save and revisit your favorite conversations
- **Chat Scenarios** - Pre-built scenarios for immersive roleplay experiences
- **Chat Suggestions** - Smart suggestions to enhance your conversations

### 🖼️ Image Generation
- **Custom Prompts** - Write detailed prompts to generate exactly the images you envision
- **Custom Poses** - Select from a variety of poses for your character images
- **Multiple AI Models** - Access a wide selection of image generation models
- **Batch Processing** - Generate multiple images efficiently
- **Image History** - Browse and manage your generated images

### 🎬 Video Generation
- **Image-to-Video** - Transform your generated images into animated videos
- **Face Merge** - Advanced face merging capabilities for personalized content
- **Video Gallery** - Organize and access your video creations

### 🎁 Social Features
- **Gifts System** - Send virtual gifts to characters
- **Like & Favorites** - Save your favorite characters and content
- **Popular Chats** - Discover trending conversations and characters

### ⚙️ Advanced Settings
- **Extensive Parameters** - Fine-tune generation settings for optimal results
- **Chat Tool Settings** - Customize your chat experience
- **Model Selection** - Choose from multiple AI models for text, image, and video generation
- **Multi-language Support** - Available in English, Japanese, and French

### 💳 Points & Monetization
- **Points System** - Purchase points for premium features
- **Creator Earnings** - Monetization options for character creators
- **Flexible Pricing** - Various pricing tiers for different needs

## 🛠️ Tech Stack

- **Backend**: Node.js with Fastify
- **Database**: MongoDB
- **Authentication**: Clerk
- **Storage**: AWS S3
- **AI Services**: OpenAI API, ElevenLabs (voice)
- **Payments**: Stripe
- **Frontend**: Handlebars templates with TailwindCSS

## 📋 Environment Variables

Create a `.env` file with the following variables:

```env
# Database
MONGODB_URI=your_mongodb_uri
MONGODB_NAME=your_mongodb_name

# Authentication
JWT_SECRET=your_jwt_secret
CLERK_SECRET_KEY=your_clerk_secret

# AI Services
OPENAI_API_KEY=your_openai_api_key

# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=your_aws_region
AWS_S3_BUCKET_NAME=your_s3_bucket_name

# Payments
STRIPE_SECRET_KEY=your_stripe_secret_key

# Application
MODE=local_or_online
```

## 🚀 Installation

1. **Clone the repository**
   ```sh
   git clone https://github.com/brocketdesign/Japanese-Custom-GPT
   cd Japanese-Custom-GPT
   ```

2. **Install dependencies**
   ```sh
   npm install
   ```

3. **Configure environment**
   - Copy `.env.example` to `.env`
   - Fill in your API keys and configuration

4. **Start the application**
   ```sh
   npm start
   ```

5. **Access the application**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
├── config/           # Configuration files (pricing, settings)
├── locales/          # Internationalization files (EN, JA, FR)
├── models/           # Database models
├── plugins/          # Fastify plugins
├── public/           # Static assets
├── routes/           # API routes
├── scripts/          # Utility scripts
├── views/            # Handlebars templates
└── server.js         # Application entry point
```

## 🌍 Supported Languages

- 🇺🇸 English
- 🇯🇵 日本語 (Japanese)
- 🇫🇷 Français (French)

## 📜 License

This project is licensed under the ISC License.

## 👥 Author

- **Hato LLC** (合同会社はと)

## 🔗 Links

- [Live Application](https://app.lamix.jp)
- [Documentation](./QUICK_START_GUIDE.md)
- [Testing Guide](./TESTING_GUIDE.md)

---

⚠️ **Disclaimer**: This application is intended for adult users only (18+). Please use responsibly and in accordance with local laws and regulations.
