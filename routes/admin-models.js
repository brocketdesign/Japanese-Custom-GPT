const { ObjectId } = require('mongodb');
const { checkUserAdmin } = require('../models/tool');
const axios = require('axios');
const hbs = require('handlebars');

const fetchModels = async (query = false, cursor = false) => {
  try {
    let url = 'https://api.novita.ai/v3/model?filter.visibility=public&pagination.limit=30&filter.types=checkpoint';
    if (cursor) {
      url += `&pagination.cursor=${cursor}`;
    }
    if (query) {
      url += `&filter.query=${encodeURIComponent(query)}`;
    }

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
      },
    });

    return response.data;
  } catch (error) {
    console.log('Error fetching models:', error.message);
    return { models: [], pagination: {} };
  }
};

// Normalize incoming style values to either 'anime' or 'photorealistic'
function normalizeStyle(style) {
  // Defensive normalization: accept strings, array-like strings, CSVs, and common variants
  if (style === undefined || style === null) return null;

  let s = String(style).trim();
  if (!s) return null;

  // Try to parse JSON arrays like "[\"photorealistic\"]"
  try {
    if ((s.startsWith('[') && s.endsWith(']')) || s.startsWith('\"[')) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed) && parsed.length > 0) {
        s = String(parsed[0]);
      }
    }
  } catch (e) {
    // ignore parse errors
  }

  // If CSV or list, take first token
  if (s.includes(',')) s = s.split(',')[0];

  // Strip surrounding quotes/brackets and normalize
  s = s.replace(/^\s*["'\[\]]+|["'\[\]]+\s*$/g, '').trim().toLowerCase();
  if (!s) return null;

  const animeVariants = new Set(['anime', 'anime-style', 'anime_style', 'anime style', 'manga']);
  const photoVariants = new Set(['photorealistic', 'photorealism', 'photoreal', 'photo', 'photorealistic-style', 'photorealistic_style', 'photorealistic style', 'realistic', 'realism']);

  if (animeVariants.has(s)) return 'anime';
  if (photoVariants.has(s)) return 'photorealistic';

  // Tokenize and search tokens for known variants
  const tokens = s.split(/[^a-z0-9]+/).filter(Boolean);
  for (const t of tokens) {
    if (animeVariants.has(t)) return 'anime';
    if (photoVariants.has(t)) return 'photorealistic';
  }

  return null;
}

const modelCardTemplate = hbs.compile(`
  {{#each models}}
  <div class="col-sm-6 col-md-4 col-lg-3 p-2 animate__animated animate__fadeIn">
    <div class="card model-gallery-card bg-dark text-white shadow-lg position-relative overflow-hidden" style="height: 400px;">
      <img src="{{cover_url}}" class="card-img-top h-100 w-100" alt="{{name}}" style="object-fit: cover;">
      <div class="card-img-overlay d-flex flex-column justify-content-end p-2" style="background-image: linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0)); z-index: 1;">
        <h5 class="card-title fs-6 fw-semibold text-truncate mb-1" title="{{name}}">{{name}}</h5>
        <p class="card-text fs-6 text-truncate mb-1 text-light" title="{{sd_name}}">{{sd_name}}</p>
        <div class="d-flex justify-content-between align-items-center">
          <div class="form-check form-switch">
            <input class="form-check-input model-switch" type="checkbox"
              data-model-id="{{id}}"
              data-model="{{sd_name}}"
              data-style="{{#if tags}}{{tags.[0]}}{{/if}}"
              data-version="{{base_model}}"
              data-image="{{cover_url}}"
              data-name="{{name}}">
          </div>
          <button class="btn btn-sm btn-outline-light model-gallery-info-btn p-1" type="button" title="View Details">
            <i class="bi bi-info-circle"></i>
          </button>
        </div>
      </div>
      <div class="model-details-panel position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-90 p-3 d-none animate__animated overflow-auto" style="z-index: 2;">
        <button type="button" class="btn-close position-absolute top-0 end-0 m-2 model-gallery-details-close-btn" aria-label="Close"></button>
        <h6 class="h5 fw-bold mb-2">{{name}}</h6>
        <p class="small mb-1"><strong>Model:</strong> {{sd_name}}</p>
        <p class="small mb-1"><strong>Base:</strong> {{base_model}}</p>
        <p class="small mb-1"><strong>Style:</strong> {{#if tags}}{{tags.[0]}}{{else}}N/A{{/if}}</p>
        <p class="small mb-1"><strong>ID:</strong> <span class="text-break">{{id}}</span></p>
        {{#if hash_sha256}}<p class="small mb-1"><strong>Hash:</strong> <span class="text-break">{{hash_sha256}}</span></p>{{/if}}
        <p class="small mb-0"><strong>Tags:</strong></p>
        <div class="mt-1">
          {{#if tags}}
            {{#each tags}}
              <span class="badge bg-primary me-1 mb-1">{{this}}</span>
            {{/each}}
          {{else}}
            <span class="small">N/A</span>
          {{/if}}
        </div>
      </div>
    </div>
  </div>
  {{/each}}
`);

async function routes(fastify, options) {
  fastify.post('/admin/models', async (request, reply) => {
    const { cursor, search } = request.query;
    const data = await fetchModels(search, cursor);
    const html = modelCardTemplate({ models: data.models });
    return reply.code(200).send({ html, pagination: data.pagination });
  });

  // Add model to the database
  fastify.post('/admin/models/add', async (req, reply) => {
    const { modelId, model, style, version, image, name } = req.body;
    const db = fastify.mongo.db;
    // Normalize style before saving (store either 'anime' or 'photorealistic' or empty string)
    const normalizedStyle = normalizeStyle(style) || '';
    await db.collection('myModels').insertOne({ 
      modelId, 
      model, 
      style: normalizedStyle, 
      version, 
      image, 
      name,
      negativePrompt: '', // Default empty negative prompt
      defaultSampler: '', // Default empty default sampler
      createdAt: new Date()
    });
    reply.send({ success: true, message: 'Model added successfully.' });
  });

  // Remove model from the database
  fastify.post('/admin/models/remove', async (req, reply) => {
    const { modelId } = req.body;
    const db = fastify.mongo.db;
    await db.collection('myModels').deleteOne({ modelId });
    reply.send({ success: true, message: 'Model removed successfully.' });
  });

  // Get model details
  fastify.get('/admin/models/:modelId/details', async (req, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, req.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { modelId } = req.params;
      const db = fastify.mongo.db;
      const model = await db.collection('myModels').findOne({ modelId });
      
      if (!model) {
        return reply.status(404).send({ error: 'Model not found' });
      }

      reply.send(model);
    } catch (error) {
      console.error('Error fetching model details:', error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Update model style
  fastify.put('/admin/models/:modelId/style', async (req, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, req.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { modelId } = req.params;
      const { style } = req.body;
      const db = fastify.mongo.db;
      
      // Normalize and validate style value (accept common variants)
      let normalized = normalizeStyle(style);
      // If incoming style is empty (client bug), fallback to 'anime' to avoid rejecting the request
      if (!normalized) {
        if (style === '' || style === undefined || style === null) {
          normalized = 'anime';
        } else {
          return reply.status(400).send({ error: 'Invalid style. Must be either "anime" or "photorealistic".' });
        }
      }

      const result = await db.collection('myModels').updateOne(
        { modelId },
        { 
          $set: { 
            style: normalized,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return reply.status(404).send({ error: 'Model not found' });
      }

      reply.send({ success: true, message: 'Model style updated successfully.' });
    } catch (error) {
      console.error('Error updating model style:', error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Update model negative prompt
  fastify.put('/admin/models/:modelId/negative-prompt', async (req, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, req.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { modelId } = req.params;
      const { negativePrompt } = req.body;
      const db = fastify.mongo.db;
      
      const result = await db.collection('myModels').updateOne(
        { modelId },
        { 
          $set: { 
            negativePrompt: negativePrompt || '',
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return reply.status(404).send({ error: 'Model not found' });
      }

      reply.send({ success: true, message: 'Negative prompt updated successfully.' });
    } catch (error) {
      console.error('Error updating negative prompt:', error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Update model default sampler
  fastify.put('/admin/models/:modelId/default-sampler', async (req, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, req.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { modelId } = req.params;
      const { defaultSampler } = req.body;
      const db = fastify.mongo.db;
      
      const result = await db.collection('myModels').updateOne(
        { modelId },
        { 
          $set: { 
            defaultSampler: defaultSampler || '',
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return reply.status(404).send({ error: 'Model not found' });
      }

      reply.send({ success: true, message: 'Default sampler updated successfully.' });
    } catch (error) {
      console.error('Error updating default sampler:', error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/admin/models', async (req, res) => {
    let user = req.user;
    const db = fastify.mongo.db;
    const models = await db.collection('myModels').find({}).toArray();
    const isAdmin = await checkUserAdmin(fastify, user._id);
    return res.view('/admin/models', { user, models });
  });
}

module.exports = routes;
