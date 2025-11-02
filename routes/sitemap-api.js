const { getCachedSitemapData, cacheSitemapData } = require('../models/sitemap-utils');

const getBaseUrl = (request) => {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || request.protocol || 'https';
  return `${protocol}://${request.hostname}`;
};

async function routes(fastify, options) {
  
  // Get sitemap data (from cache or generate new)
  fastify.get('/api/sitemap', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      
      // Try to get cached data first
      let sitemapData = await getCachedSitemapData(db);
      
      // If no cached data, generate new cache
      if (!sitemapData) {
        console.log('[API /sitemap] No cached data found, generating new cache...');
        sitemapData = await cacheSitemapData(db);
      }
      
      return reply.send({
        success: true,
        data: {
          characters: sitemapData.characters,
          tags: sitemapData.tags,
          totalCharacters: sitemapData.totalCharacters,
          totalTags: sitemapData.totalTags,
          lastUpdated: sitemapData.lastUpdated
        }
      });
    } catch (error) {
      console.error('[API /sitemap] Error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch sitemap data'
      });
    }
  });

  // Manual refresh of sitemap cache (admin only)
  fastify.post('/api/sitemap/refresh', async (request, reply) => {
    try {
      const user = request.user;
      const db = fastify.mongo.db;
      
      // Check if user is admin
      const usersCollection = db.collection('users');
      const userData = await usersCollection.findOne({ 
        _id: new fastify.mongo.ObjectId(user._id) 
      });
      
      if (!userData || userData.role !== 'admin') {
        return reply.status(403).send({
          success: false,
          error: 'Admin access required'
        });
      }
      
      console.log('[API /sitemap/refresh] Manual sitemap cache refresh requested by admin');
      const sitemapData = await cacheSitemapData(db);
      
      return reply.send({
        success: true,
        message: 'Sitemap cache refreshed successfully',
        data: {
          totalCharacters: sitemapData.totalCharacters,
          totalTags: sitemapData.totalTags,
          lastUpdated: sitemapData.lastUpdated
        }
      });
    } catch (error) {
      console.error('[API /sitemap/refresh] Error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to refresh sitemap cache'
      });
    }
  });

  // XML Sitemap Index
  fastify.get('/sitemap.xml', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      const sitemapData = await getCachedSitemapData(db);
      
      if (!sitemapData) {
        return reply.status(404).send('Sitemap data not found');
      }

      const baseUrl = getBaseUrl(request);

      // Calculate number of pages needed (50,000 URLs per sitemap recommended)
      // Only count character URLs (tags are excluded from sitemap per robots.txt)
      const urlsPerSitemap = 10000;
      const totalCharacters = sitemapData.totalCharacters || 0;
      const totalPages = Math.ceil(totalCharacters / urlsPerSitemap) || 1;

      let sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-static.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`;

      for (let i = 1; i <= totalPages; i++) {
        sitemapIndex += `
  <sitemap>
    <loc>${baseUrl}/sitemap-${i}.xml</loc>
    <lastmod>${sitemapData.lastUpdated ? new Date(sitemapData.lastUpdated).toISOString() : new Date().toISOString()}</lastmod>
  </sitemap>`;
      }

      sitemapIndex += `
</sitemapindex>`;

      reply.type('application/xml');
      return reply.send(sitemapIndex);
    } catch (error) {
      console.error('[XML Sitemap Index] Error:', error);
      return reply.status(500).send('Internal Server Error');
    }
  });

  // Static pages sitemap
  fastify.get('/sitemap-static.xml', async (request, reply) => {
    try {
      const baseUrl = getBaseUrl(request);

      const staticPages = [
        { url: '', priority: '1.0', changefreq: 'daily' },
        { url: '/chat', priority: '0.9', changefreq: 'daily' },
        { url: '/character', priority: '0.9', changefreq: 'daily' },
        { url: '/search', priority: '0.8', changefreq: 'daily' },
        { url: '/tags', priority: '0.8', changefreq: 'weekly' },
        { url: '/post', priority: '0.7', changefreq: 'weekly' },
        { url: '/my-plan', priority: '0.6', changefreq: 'monthly' },
        { url: '/discover', priority: '0.7', changefreq: 'daily' },
        { url: '/sitemap', priority: '0.5', changefreq: 'weekly' }
      ];

      let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

      staticPages.forEach(page => {
        sitemap += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
      });

      sitemap += `
</urlset>`;

      reply.type('application/xml');
      return reply.send(sitemap);
    } catch (error) {
      console.error('[Static Sitemap] Error:', error);
      return reply.status(500).send('Internal Server Error');
    }
  });

  // Paginated sitemap for characters and tags
  fastify.get('/sitemap-:page.xml', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      const page = parseInt(request.params.page);
      
      if (isNaN(page) || page < 1) {
        return reply.status(404).send('Invalid page number');
      }

      const sitemapData = await getCachedSitemapData(db);
      
      if (!sitemapData) {
        return reply.status(404).send('Sitemap data not found');
      }

      const baseUrl = getBaseUrl(request);

      const urlsPerSitemap = 10000;
      const startIndex = (page - 1) * urlsPerSitemap;

      // Collect all URLs
      const allUrls = [];

      // Add character URLs from all languages
      Object.keys(sitemapData.characters || {}).forEach(lang => {
        (sitemapData.characters[lang] || []).forEach(character => {
          if (character.slug) {
            allUrls.push({
              url: `/character/slug/${character.slug}`,
              lastmod: character.updatedAt || character.createdAt || new Date(),
              changefreq: 'weekly',
              priority: '0.8'
            });
          }
        });
      });

      // Add tag URLs
      // Tags remain available for API consumers, but search URLs are excluded to respect robots rules

      // Get URLs for this page
      const pageUrls = allUrls.slice(startIndex, startIndex + urlsPerSitemap);

      if (pageUrls.length === 0) {
        return reply.status(404).send('Page not found');
      }

      let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

      pageUrls.forEach(item => {
        const lastmod = item.lastmod instanceof Date ? 
          item.lastmod.toISOString() : 
          new Date(item.lastmod).toISOString();

        sitemap += `
  <url>
    <loc>${baseUrl}${item.url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`;
      });

      sitemap += `
</urlset>`;

      reply.type('application/xml');
      return reply.send(sitemap);
    } catch (error) {
      console.error('[Paginated Sitemap] Error:', error);
      return reply.status(500).send('Internal Server Error');
    }
  });
}

module.exports = routes;
