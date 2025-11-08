# Language-Specific System Prompt Feature

## Overview

The chat model test now automatically enhances the system prompt with language-specific directives when testing with multiple languages. This ensures that models respond in the correct language for each test.

## How It Works

### Feature
When you run a test with multiple languages (EN, FR, JA), each language gets a customized system prompt that includes a language directive.

### Language Directives

```
English:   "Respond in English only."
French:    "Répondez uniquement en français."
Japanese:  "日本語でのみ答えてください。"
```

### System Prompt Enhancement

**Before:**
```
System Prompt: "You are a helpful and friendly AI assistant."

Test with EN: Same prompt
Test with FR: Same prompt
Test with JA: Same prompt
```

**After:**
```
Base Prompt: "You are a helpful and friendly AI assistant."

Test with EN: "You are a helpful and friendly AI assistant.\n\n[LANGUAGE DIRECTIVE] Respond in English only."
Test with FR: "You are a helpful and friendly AI assistant.\n\n[LANGUAGE DIRECTIVE] Répondez uniquement en français."
Test with JA: "You are a helpful and friendly AI assistant.\n\n[LANGUAGE DIRECTIVE] 日本語でのみ答えてください。"
```

## Implementation Details

### Client-Side (JavaScript)
File: `views/admin/chat-model-test.hbs`

```javascript
/**
 * Build language-specific system prompt with language directive
 * @param {string} basePrompt - Base system prompt
 * @param {string} language - Language code (en, fr, ja)
 * @returns {string} Enhanced prompt with language directive
 */
function buildLanguageSpecificPrompt(basePrompt, language) {
    const languageDirectives = {
        'en': 'Respond in English only.',
        'fr': 'Répondez uniquement en français.',
        'ja': '日本語でのみ答えてください。'
    };
    
    const directive = languageDirectives[language] || languageDirectives['en'];
    return `${basePrompt}\n\n[LANGUAGE DIRECTIVE] ${directive}`;
}
```

### Server-Side (Node.js)
File: `models/admin-chat-model-utils.js`

```javascript
/**
 * Build language-specific system prompt with language directive
 * @param {string} basePrompt - Base system prompt
 * @param {string} language - Language code (en, fr, ja)
 * @returns {string} Enhanced prompt with language directive
 */
const buildLanguageSpecificPrompt = (basePrompt, language) => {
  const languageDirectives = {
    'en': 'Respond in English only.',
    'fr': 'Répondez uniquement en français.',
    'ja': '日本語でのみ答えてください。'
  };
  
  const directive = languageDirectives[language] || languageDirectives['en'];
  return `${basePrompt}\n\n[LANGUAGE DIRECTIVE] ${directive}`;
};
```

### Route Handler
File: `routes/admin-chat-model.js`

```javascript
const {
  models,
  questions,
  systemPrompt,
  languages,
  maxTokens = 1000,
  buildLanguageSpecificPrompt = true  // ← New flag
} = request.body;

const results = await testMultipleModels({
  models,
  questions,
  systemPrompt,
  languages,
  maxTokens,
  buildLanguageSpecificPrompt  // ← Pass to backend
});
```

### Test Function
File: `models/admin-chat-model-utils.js`

```javascript
const testMultipleModels = async ({
  models,
  questions,
  systemPrompt,
  languages,
  maxTokens = 1000,
  buildLanguageSpecificPrompt: shouldBuildLanguagePrompt = true  // ← New parameter
}) => {
  for (const language of languages) {
    // Build language-specific prompt if enabled
    const languageSpecificPrompt = shouldBuildLanguagePrompt 
      ? buildLanguageSpecificPrompt(systemPrompt, language)
      : systemPrompt;

    // Use languageSpecificPrompt for testing
    for (const question of questions) {
      for (const model of models) {
        const testResult = await testSingleModel(
          model,
          question,
          languageSpecificPrompt,  // ← Language-specific prompt used here
          language,
          maxTokens
        );
      }
    }
  }
};
```

## Usage

### Default Behavior
By default, language-specific prompts are **enabled** (`buildLanguageSpecificPrompt: true`)

### To Disable Language Directives
If you want to test with the same prompt for all languages, you can modify the client code:

```javascript
// In runTest() function, before sending the request:
body: JSON.stringify({
  models: selectedModels,
  questions: filteredQuestions,
  systemPrompt: baseSystemPrompt,
  languages,
  maxTokens,
  buildLanguageSpecificPrompt: false  // ← Disable language directives
})
```

## Examples

### Example 1: Testing with English Only
```
Base Prompt: "You are a helpful assistant."
Language: English

System Prompt Sent:
"You are a helpful assistant.

[LANGUAGE DIRECTIVE] Respond in English only."
```

Expected: Model responds in English.

### Example 2: Testing with Multiple Languages
```
Base Prompt: "Explain the concept of machine learning."
Languages: [en, fr, ja]

For English:
"Explain the concept of machine learning.

[LANGUAGE DIRECTIVE] Respond in English only."

For French:
"Explain the concept of machine learning.

[LANGUAGE DIRECTIVE] Répondez uniquement en français."

For Japanese:
"Explain the concept of machine learning.

[LANGUAGE DIRECTIVE] 日本語でのみ答えてください。"
```

Expected: Each model provides explanation in the respective language.

## Testing Language Compliance

### Verification Steps

1. **Run a multilingual test:**
   - Select 2+ languages (EN, FR, JA)
   - Enter a question in English
   - Select a model
   - Run test

2. **Check results:**
   - Click on response to expand
   - Verify response is in the correct language
   - Compare responses across languages

3. **Expected Output:**
   ```
   Question (EN): "What is artificial intelligence?"
   
   EN Response: "Artificial intelligence (AI) is..."
   FR Response: "L'intelligence artificielle (IA) est..."
   JA Response: "人工知能（AI）は..."
   ```

## Benefits

✅ **Consistency** - Ensures multilingual responses are in the intended language
✅ **Clarity** - Models know which language to respond in
✅ **Testing** - Easy to verify language capabilities of models
✅ **Comparison** - Compare how well each model translates/responds
✅ **Flexibility** - Can be disabled if needed

## Customization

### Adding More Languages

To add support for more languages, update the `languageDirectives` object:

**Client-side (chat-model-test.hbs):**
```javascript
const languageDirectives = {
    'en': 'Respond in English only.',
    'fr': 'Répondez uniquement en français.',
    'ja': '日本語でのみ答えてください。',
    'es': 'Responde solo en español.',  // ← Add Spanish
    'de': 'Antworte nur auf Deutsch.'   // ← Add German
};
```

**Server-side (admin-chat-model-utils.js):**
```javascript
const languageDirectives = {
  'en': 'Respond in English only.',
  'fr': 'Répondez uniquement en français.',
  'ja': '日本語でのみ答えてください。',
  'es': 'Responde solo en español.',  // ← Add Spanish
  'de': 'Antworte nur auf Deutsch.'   // ← Add German
};
```

Make sure both client and server have the same directives!

## Troubleshooting

### Model still responds in wrong language
- Check browser console for errors
- Verify language selection is correct
- Try a simpler question in one language
- Check model capabilities (some may not support certain languages)

### Language directive not showing in saved results
- This is normal - only the base prompt is stored
- Language directives are added dynamically during testing
- Check the database field `systemPrompt` to see the base prompt

### Want to see the full prompt with directive
- View the response in the modal
- The directive is embedded in each API request
- Not visible in database (by design for cleanliness)

## Files Changed

1. **views/admin/chat-model-test.hbs**
   - Added `buildLanguageSpecificPrompt()` function
   - Updated `runTest()` to pass flag to server
   - Added language directive comments

2. **models/admin-chat-model-utils.js**
   - Added `buildLanguageSpecificPrompt()` function
   - Updated `testMultipleModels()` to use language-specific prompts
   - Added parameter to control feature
   - Exported new function

3. **routes/admin-chat-model.js**
   - Updated request body parsing to accept `buildLanguageSpecificPrompt`
   - Passes flag to `testMultipleModels()`
   - Enhanced logging

## Summary

This feature ensures that when testing chat models in multiple languages:
- ✅ Each language gets a specific directive
- ✅ Models know which language to respond in
- ✅ Results are properly organized by language
- ✅ Feature is transparent to the user
- ✅ Can be disabled if needed
- ✅ Easy to extend for more languages
