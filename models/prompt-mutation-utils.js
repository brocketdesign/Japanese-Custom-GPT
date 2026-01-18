/**
 * Prompt Mutation Service
 * Generates template-based variations for prompts with style modifiers
 */

const { ObjectId } = require('mongodb');

/**
 * Style modifiers for different categories
 */
const STYLE_MODIFIERS = {
  anime: [
    'anime style',
    'manga style',
    'cel-shaded',
    'vibrant colors',
    'highly detailed anime',
    'Studio Ghibli style',
    'modern anime aesthetic',
    'kawaii style',
    'shounen anime',
    'seinen anime'
  ],
  photorealistic: [
    'photorealistic',
    'ultra realistic',
    'highly detailed',
    '8k resolution',
    'professional photography',
    'cinematic lighting',
    'DSLR quality',
    'hyperrealistic',
    'studio lighting',
    'natural lighting'
  ],
  artistic: [
    'oil painting',
    'watercolor',
    'digital art',
    'concept art',
    'fantasy art',
    'impressionist style',
    'art nouveau',
    'cyberpunk aesthetic',
    'steampunk style',
    'gothic art'
  ],
  cinematic: [
    'cinematic shot',
    'movie still',
    'dramatic lighting',
    'bokeh effect',
    'golden hour',
    'film grain',
    'anamorphic lens',
    'depth of field',
    'atmospheric',
    'epic composition'
  ]
};

/**
 * Quality enhancers
 */
const QUALITY_ENHANCERS = [
  'masterpiece',
  'best quality',
  'high quality',
  'extremely detailed',
  'intricate details',
  'perfect composition',
  'award winning',
  'trending on artstation'
];

/**
 * Adjective pools for variation
 */
const ADJECTIVE_POOLS = {
  mood: ['serene', 'dramatic', 'mysterious', 'vibrant', 'melancholic', 'cheerful', 'intense', 'peaceful', 'dynamic', 'ethereal'],
  lighting: ['soft', 'harsh', 'warm', 'cool', 'bright', 'dim', 'dramatic', 'natural', 'artificial', 'ambient'],
  color: ['vivid', 'muted', 'pastel', 'saturated', 'desaturated', 'monochrome', 'colorful', 'neutral', 'bold', 'subtle'],
  detail: ['intricate', 'simple', 'complex', 'minimalist', 'ornate', 'refined', 'rough', 'smooth', 'textured', 'clean']
};

/**
 * Mutation strategies
 */
const MUTATION_STRATEGIES = {
  addStyle: 'Add style modifier',
  addQuality: 'Add quality enhancer',
  addAdjectives: 'Add descriptive adjectives',
  reorderElements: 'Reorder prompt elements',
  expandDescription: 'Expand with details',
  simplify: 'Simplify prompt'
};

/**
 * Generate a mutated prompt based on a template
 * @param {string} basePrompt - Original prompt
 * @param {Object} options - Mutation options
 * @returns {Object} Mutated prompt with metadata
 */
function mutatePrompt(basePrompt, options = {}) {
  const {
    styleCategory = 'anime',
    addQuality = true,
    addStyleModifier = true,
    addAdjectives = true,
    maxAdjectives = 3,
    seed = null
  } = options;

  let mutatedPrompt = basePrompt.trim();
  const appliedMutations = [];

  // Add style modifier
  if (addStyleModifier && STYLE_MODIFIERS[styleCategory]) {
    const modifiers = STYLE_MODIFIERS[styleCategory];
    const selectedModifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    mutatedPrompt += `, ${selectedModifier}`;
    appliedMutations.push({ type: 'style', value: selectedModifier });
  }

  // Add adjectives from different pools
  if (addAdjectives) {
    const adjectiveTypes = Object.keys(ADJECTIVE_POOLS);
    const numAdjectives = Math.min(maxAdjectives, adjectiveTypes.length);
    
    for (let i = 0; i < numAdjectives; i++) {
      const poolKey = adjectiveTypes[Math.floor(Math.random() * adjectiveTypes.length)];
      const pool = ADJECTIVE_POOLS[poolKey];
      const adjective = pool[Math.floor(Math.random() * pool.length)];
      mutatedPrompt += `, ${adjective}`;
      appliedMutations.push({ type: 'adjective', pool: poolKey, value: adjective });
    }
  }

  // Add quality enhancers
  if (addQuality) {
    const numEnhancers = 1 + Math.floor(Math.random() * 2); // 1-2 enhancers
    for (let i = 0; i < numEnhancers; i++) {
      const enhancer = QUALITY_ENHANCERS[Math.floor(Math.random() * QUALITY_ENHANCERS.length)];
      mutatedPrompt += `, ${enhancer}`;
      appliedMutations.push({ type: 'quality', value: enhancer });
    }
  }

  return {
    originalPrompt: basePrompt,
    mutatedPrompt,
    mutations: appliedMutations,
    seed: seed || Math.floor(Math.random() * 1000000),
    generatedAt: new Date()
  };
}

/**
 * Generate multiple variations of a prompt
 * @param {string} basePrompt - Original prompt
 * @param {number} count - Number of variations
 * @param {Object} options - Mutation options
 * @returns {Array} Array of mutated prompts
 */
function generateVariations(basePrompt, count = 5, options = {}) {
  const variations = [];
  
  for (let i = 0; i < count; i++) {
    const variation = mutatePrompt(basePrompt, {
      ...options,
      seed: options.baseSeed ? options.baseSeed + i : null
    });
    variations.push(variation);
  }
  
  return variations;
}

/**
 * Create a prompt template
 * @param {Object} template - Template configuration
 * @param {Object} db - Database connection
 * @returns {Object} Created template
 */
async function createPromptTemplate(template, db) {
  const {
    name,
    basePrompt,
    category, // 'image' or 'video'
    nsfw = false,
    styleCategory = 'anime',
    tags = [],
    compatibleModels = [],
    defaultOptions = {},
    userId
  } = template;

  const promptTemplate = {
    name,
    basePrompt,
    category,
    nsfw,
    styleCategory,
    tags,
    compatibleModels,
    defaultOptions: {
      addQuality: true,
      addStyleModifier: true,
      addAdjectives: true,
      maxAdjectives: 3,
      ...defaultOptions
    },
    userId: userId ? new ObjectId(userId) : null,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('promptTemplates').insertOne(promptTemplate);
  return { _id: result.insertedId, ...promptTemplate };
}

/**
 * Get prompt templates
 * @param {Object} db - Database connection
 * @param {Object} filters - Filter options
 * @returns {Array} Array of templates
 */
async function getPromptTemplates(db, filters = {}) {
  const {
    category,
    nsfw,
    userId,
    styleCategory,
    tags,
    page = 1,
    limit = 20
  } = filters;

  const query = {};
  
  if (category) query.category = category;
  if (typeof nsfw === 'boolean') query.nsfw = nsfw;
  if (userId) query.userId = new ObjectId(userId);
  if (styleCategory) query.styleCategory = styleCategory;
  if (tags && tags.length > 0) query.tags = { $in: tags };

  const skip = (page - 1) * limit;

  const templates = await db.collection('promptTemplates')
    .find(query)
    .sort({ usageCount: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const total = await db.collection('promptTemplates').countDocuments(query);

  return {
    templates,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update template usage count
 * @param {string} templateId - Template ID
 * @param {Object} db - Database connection
 */
async function incrementTemplateUsage(templateId, db) {
  await db.collection('promptTemplates').updateOne(
    { _id: new ObjectId(templateId) },
    { 
      $inc: { usageCount: 1 },
      $set: { lastUsedAt: new Date() }
    }
  );
}

/**
 * Apply template to generate a prompt
 * @param {string} templateId - Template ID
 * @param {Object} db - Database connection
 * @param {Object} overrides - Override options
 * @returns {Object} Generated prompt with metadata
 */
async function applyTemplate(templateId, db, overrides = {}) {
  const template = await db.collection('promptTemplates').findOne({
    _id: new ObjectId(templateId)
  });

  if (!template) {
    throw new Error('Template not found');
  }

  // Merge template options with overrides
  const options = {
    ...template.defaultOptions,
    styleCategory: template.styleCategory,
    ...overrides
  };

  // Generate mutated prompt
  const result = mutatePrompt(template.basePrompt, options);

  // Increment usage
  await incrementTemplateUsage(templateId, db);

  return {
    ...result,
    templateId: template._id,
    templateName: template.name,
    category: template.category,
    nsfw: template.nsfw,
    compatibleModels: template.compatibleModels
  };
}

/**
 * Save a mutation result to history
 * @param {Object} mutation - Mutation data
 * @param {Object} db - Database connection
 */
async function saveMutationHistory(mutation, db) {
  const {
    userId,
    templateId,
    originalPrompt,
    mutatedPrompt,
    mutations,
    seed,
    generatedContent,
    category
  } = mutation;

  const history = {
    userId: new ObjectId(userId),
    templateId: templateId ? new ObjectId(templateId) : null,
    originalPrompt,
    mutatedPrompt,
    mutations,
    seed,
    generatedContent,
    category,
    createdAt: new Date()
  };

  const result = await db.collection('promptMutationHistory').insertOne(history);
  return { _id: result.insertedId, ...history };
}

/**
 * Get mutation history
 * @param {Object} db - Database connection
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 */
async function getMutationHistory(db, userId, options = {}) {
  const {
    category,
    templateId,
    page = 1,
    limit = 20
  } = options;

  const query = { userId: new ObjectId(userId) };
  
  if (category) query.category = category;
  if (templateId) query.templateId = new ObjectId(templateId);

  const skip = (page - 1) * limit;

  const history = await db.collection('promptMutationHistory')
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const total = await db.collection('promptMutationHistory').countDocuments(query);

  return {
    history,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

module.exports = {
  mutatePrompt,
  generateVariations,
  createPromptTemplate,
  getPromptTemplates,
  applyTemplate,
  incrementTemplateUsage,
  saveMutationHistory,
  getMutationHistory,
  STYLE_MODIFIERS,
  QUALITY_ENHANCERS,
  ADJECTIVE_POOLS,
  MUTATION_STRATEGIES
};
