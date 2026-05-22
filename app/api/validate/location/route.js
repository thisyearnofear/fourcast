import { LocationValidator } from '@/services/validators/index.js';

/**
 * Location Validation API Endpoint
 * 
 * POST /api/validate/location
 * Validates location appropriateness for market types
 */

export const runtime = 'edge';

export async function POST(request) {
  try {
    const { eventType, location, additionalContext } = await request.json();

    // Validate required fields
    if (!eventType || !location) {
      return Response.json({
        valid: false,
        errors: ['eventType and location are required'],
        warnings: [],
        category: 'location'
      }, { status: 400 });
    }

    // Run location validation
    const validation = LocationValidator.validateLocation(eventType, location, additionalContext || {});

    return Response.json({
      ...validation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Location validation API error:', error);
    return Response.json({
      valid: false,
      errors: [`Validation failed: ${error.message}`],
      warnings: [],
      category: 'location'
    }, { status: 500 });
  }
}

export async function GET(request) {
  return Response.json({
    endpoint: '/api/validate/location',
    method: 'POST',
    description: 'Validates location appropriateness for market types',
    requiredFields: ['eventType', 'location'],
    optionalFields: ['additionalContext']
  });
}