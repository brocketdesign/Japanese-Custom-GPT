const { getAllPricing, PRICING_CONFIG } = require('../config/pricing');
const { checkUserAdmin } = require('../models/tool');

/**
 * Admin pricing management routes
 */
async function routes(fastify, options) {

  // Get all pricing configuration (admin only)
  fastify.get('/api/admin/pricing', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user || !checkUserAdmin(user)) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Admin access required' 
        });
      }

      const pricing = getAllPricing();
      
      return reply.send({
        success: true,
        pricing: {
          config: pricing,
          lastUpdated: new Date(),
          description: 'Current pricing configuration for all application features'
        }
      });
      
    } catch (error) {
      console.error('Error fetching pricing configuration:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch pricing configuration'
      });
    }
  });

  // Update pricing configuration (admin only)
  // Note: This would require a server restart to take effect since we're using require()
  // For dynamic pricing updates, consider using a database-based configuration
  fastify.post('/api/admin/pricing/info', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user || !checkUserAdmin(user)) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Admin access required' 
        });
      }

      return reply.send({
        success: true,
        message: 'Pricing configuration is file-based and requires server restart to update',
        instructions: [
          '1. Edit /config/pricing.js file',
          '2. Update the PRICING_CONFIG values',
          '3. Restart the server',
          '4. All pricing will be automatically updated across the application'
        ],
        currentPricing: PRICING_CONFIG
      });
      
    } catch (error) {
      console.error('Error in pricing info endpoint:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get pricing information'
      });
    }
  });

}

module.exports = routes;