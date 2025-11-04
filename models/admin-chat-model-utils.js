const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Novita.ai models configuration
const NOVITA_MODELS = {
  llama: {
    id: 'meta-llama/llama-3-70b-instruct',
    displayName: 'Llama 3 70B',
    description: 'Large-scale reasoning and analysis'
  },
  deepseek: {
    id: 'deepseek/deepseek-v3-turbo',
    displayName: 'DeepSeek V3 Turbo',
    description: 'Advanced coding and reasoning'
  },
  mistral: {
    id: 'mistralai/mistral-nemo',
    displayName: 'Mistral Nemo',
    description: 'Fast and efficient responses'
  },
  hermes: {
    id: 'nousresearch/hermes-2-pro-llama-3-8b',
    displayName: 'Hermes 2 Pro',
    description: 'Balanced performance and speed'
  }
};

/**
 * Get all available Novita models
 * @returns {Object} Available models configuration
 */
const getAvailableNovitaModels = () => {
  return NOVITA_MODELS;
};

/**
 * Test a single model with a question
 * @param {string} modelKey - Model key (e.g., 'llama', 'deepseek')
 * @param {string} question - Question to test
 * @param {string} systemPrompt - System prompt for the model
 * @param {string} language - Language code (en, fr, ja)
 * @param {number} maxTokens - Maximum tokens for response
 * @returns {Promise<Object>} Model response and metadata
 */
const testSingleModel = async (modelKey, question, systemPrompt, language, maxTokens = 1000) => {
  const model = NOVITA_MODELS[modelKey];
  
  if (!model) {
    throw new Error(`Unknown model: ${modelKey}`);
  }

  const apiKey = process.env.NOVITA_API_KEY;
  if (!apiKey) {
    throw new Error('NOVITA_API_KEY not configured');
  }

  try {
    const startTime = Date.now();

    const requestBody = {
      model: model.id,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: question
        }
      ],
      temperature: 1,
      max_completion_tokens: maxTokens,
      stream: false,
      n: 1
    };

    console.log(`[Model Test] Testing ${modelKey} with language ${language}`);
    console.log(`[Model Test] Question: ${question.substring(0, 100)}`);
    console.log(`[Model Test] System prompt length: ${systemPrompt?.length}`);

    const response = await fetch('https://api.novita.ai/v3/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[Model Test] API Error for ${modelKey}:`, {
        status: response.status,
        error: errorData.error?.message,
        responseTime
      });
      return {
        success: false,
        modelKey,
        modelName: model.displayName,
        error: errorData.error?.message || `API error: ${response.status}`,
        responseTime,
        tokens: null,
        content: null
      };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const usage = data.usage || {};

    console.log(`[Model Test] Success for ${modelKey}: ${responseTime}ms, tokens: ${usage.total_tokens}`);

    return {
      success: true,
      modelKey,
      modelName: model.displayName,
      content,
      responseTime,
      tokens: {
        prompt: usage.prompt_tokens || 0,
        completion: usage.completion_tokens || 0,
        total: usage.total_tokens || 0
      },
      error: null
    };
  } catch (error) {
    console.error(`[Model Test] Exception testing model ${modelKey}:`, error);
    console.error(`[Model Test] Error message:`, error.message);
    console.error(`[Model Test] Error stack:`, error.stack);
    return {
      success: false,
      modelKey,
      modelName: model.displayName,
      error: error.message,
      responseTime: null,
      tokens: null,
      content: null
    };
  }
};

/**
 * Test multiple models with multiple questions in multiple languages
 * @param {Object} config - Configuration object
 * @param {Array<string>} config.models - Model keys to test
 * @param {Array<string>} config.questions - Questions to test
 * @param {string} config.systemPrompt - System prompt for all models
 * @param {Array<string>} config.languages - Languages to test (en, fr, ja)
 * @param {number} config.maxTokens - Maximum tokens per response
 * @returns {Promise<Object>} Comprehensive test results
 */
const testMultipleModels = async ({
  models,
  questions,
  systemPrompt,
  languages,
  maxTokens = 1000
}) => {
  const results = {};

  console.log('[Multiple Models Test] Starting test batch');
  console.log('[Multiple Models Test] Config:', {
    modelCount: models.length,
    questionCount: questions.length,
    languageCount: languages.length,
    maxTokens
  });

  // Structure: language -> question -> model -> response
  for (const language of languages) {
    results[language] = {};
    console.log(`[Multiple Models Test] Processing language: ${language}`);

    for (const question of questions) {
      results[language][question] = {};

      for (const model of models) {
        console.log(`[Multiple Models Test] Testing ${model} with question (${language}): ${question.substring(0, 50)}...`);

        try {
          const testResult = await testSingleModel(
            model,
            question,
            systemPrompt,
            language,
            maxTokens
          );

          results[language][question][model] = testResult;
        } catch (error) {
          console.error(`[Multiple Models Test] Error testing ${model}:`, error);
          results[language][question][model] = {
            success: false,
            modelKey: model,
            modelName: model,
            error: error.message,
            responseTime: null,
            tokens: null,
            content: null
          };
        }
      }

      // Add small delay between questions to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('[Multiple Models Test] Test batch completed');
  return results;
};

/**
 * Format test results for display
 * @param {Object} results - Raw test results
 * @returns {Object} Formatted results with statistics
 */
const formatTestResults = (results) => {
  const formatted = {
    by_language: {},
    by_model: {},
    summary: {}
  };

  // Calculate statistics
  for (const [language, questions] of Object.entries(results)) {
    formatted.by_language[language] = {
      questions: {},
      stats: {
        total_tests: 0,
        successful: 0,
        failed: 0,
        avg_response_time: 0,
        total_tokens: 0
      }
    };

    let totalResponseTime = 0;
    let testCount = 0;

    for (const [question, models] of Object.entries(questions)) {
      formatted.by_language[language].questions[question] = {};

      for (const [model, result] of Object.entries(models)) {
        formatted.by_language[language].questions[question][model] = result;

        formatted.by_language[language].stats.total_tests++;
        if (result.success) {
          formatted.by_language[language].stats.successful++;
          totalResponseTime += result.responseTime || 0;
          formatted.by_language[language].stats.total_tokens += result.tokens?.total || 0;
          testCount++;
        } else {
          formatted.by_language[language].stats.failed++;
        }
      }
    }

    if (testCount > 0) {
      formatted.by_language[language].stats.avg_response_time = Math.round(totalResponseTime / testCount);
    }
  }

  return formatted;
};

/**
 * Safe serialization of test results that removes circular references
 * @param {Object} results - Raw test results
 * @returns {Object} Sanitized results safe for JSON.stringify
 */
const sanitizeResults = (results) => {
  const sanitized = {};

  for (const [language, questions] of Object.entries(results)) {
    sanitized[language] = {};

    for (const [question, models] of Object.entries(questions)) {
      sanitized[language][question] = {};

      for (const [model, result] of Object.entries(models)) {
        // Create a clean copy of the result object
        sanitized[language][question][model] = {
          success: Boolean(result.success),
          modelKey: String(result.modelKey),
          modelName: String(result.modelName),
          content: result.content ? String(result.content).substring(0, 5000) : null, // Limit content size
          responseTime: result.responseTime ? Number(result.responseTime) : null,
          tokens: result.tokens ? {
            prompt: Number(result.tokens.prompt) || 0,
            completion: Number(result.tokens.completion) || 0,
            total: Number(result.tokens.total) || 0
          } : null,
          error: result.error ? String(result.error) : null
        };
      }
    }
  }

  return sanitized;
};

module.exports = {
  getAvailableNovitaModels,
  testSingleModel,
  testMultipleModels,
  formatTestResults,
  sanitizeResults,
  NOVITA_MODELS
};
