/**
 * Farcaster Webhook Handler
 * 
 * Receives mention events from Neynar when @fourcast is mentioned
 * Processes the mention and triggers appropriate responses (weather lookup, etc.)
 * 
 * Webhook events flow:
 * User mentions @fourcast in Farcaster -> Neynar detects -> POST to this endpoint
 */

import { createHmac } from 'crypto';
import farcasterService from '@/services/farcasterService';
import { weatherService } from '@/services/weatherService';

/**
 * Verify webhook signature to ensure request is from Neynar
 * @param {string} payload - Raw request body
 * @param {string} signature - X-Neynar-Signature header
 * @returns {boolean}
 */
const verifyWebhookSignature = (payload, signature) => {
  const secret = process.env.NEYNAR_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('NEYNAR_WEBHOOK_SECRET not configured, skipping signature verification');
    return true; // Allow in dev without secret
  }

  const hash = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return `sha256=${hash}` === signature;
};

/**
 * Extract location from mention text
 * @param {string} text - Mention text
 * @returns {string|null} Extracted location or null
 */
const extractLocation = (text) => {
  // Patterns: "@fourcast weather in NYC", "@fourcast NYC weather", "@fourcast NYC"
  const patterns = [
    /weather\s+(?:in|for)\s+([^?!.]+)/i,
    /(?:in|for)\s+([^?!.]+?)\s+weather/i,
    /@fourcast\s+([^?!.]+?)(?:\s+weather)?$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
};

/**
 * Handle weather mention
 */
const handleWeatherMention = async (location, mention, signerUuid) => {
  try {
    const weatherData = await weatherService.getCurrentWeather(location);
    const castText = farcasterService.formatWeatherCast(weatherData, location);
    
    // Publish response cast with reply-to parent hash
    const response = await farcasterService.publishCast(castText, signerUuid, {
      parentHash: mention.cast.hash,
    });

    console.log(`Published weather response for ${location}: ${response.hash}`);
    return response;
  } catch (error) {
    console.error(`Failed to handle weather mention for ${location}:`, error);
    
    // Fallback response if weather fetch fails
    const fallbackCast = `Unable to fetch weather for "${location}". Please check the location and try again. #weather`;
    return farcasterService.publishCast(fallbackCast, signerUuid, {
      parentHash: mention.cast.hash,
    });
  }
};

/**
 * Process mention event
 */
const processMention = async (event, signerUuid) => {
  try {
    // Extract mention data
    const { data } = event;
    const { cast } = data;
    const { author, text } = cast;

    console.log(`Processing mention from @${author.username}: "${text}"`);

    // Extract location from mention
    const location = extractLocation(text);

    if (location) {
      return await handleWeatherMention(location, data, signerUuid);
    } else {
      // No location detected - provide help text
      const helpCast = `I can help you get weather forecasts! Try:
• "@fourcast weather in New York"
• "@fourcast London"
• "@fourcast weather for Tokyo"

#weather #fourcast`;

      return farcasterService.publishCast(helpCast, signerUuid, {
        parentHash: cast.hash,
      });
    }
  } catch (error) {
    console.error('Error processing mention:', error);
    throw error;
  }
};

/**
 * POST /api/farcaster/webhook
 * Receives webhook events from Neynar
 */
export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-neynar-signature');

    // Verify webhook authenticity
    if (!verifyWebhookSignature(body, signature)) {
      console.warn('Invalid webhook signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    const signerUuid = process.env.FARCASTER_SIGNER_UUID;

    if (!signerUuid) {
      console.error('FARCASTER_SIGNER_UUID not configured');
      return Response.json(
        { error: 'Signer not configured' },
        { status: 500 }
      );
    }

    // Validate signer on first run (cache result in production)
    const isValidSigner = await farcasterService.validateSigner(signerUuid);
    if (!isValidSigner) {
      console.error('Configured signer is not approved');
      return Response.json(
        { error: 'Signer not approved' },
        { status: 500 }
      );
    }

    // Route by event type
    switch (event.type) {
      case 'cast.created':
        // Process cast.created events (mentions)
        if (event.data?.object === 'cast') {
          await processMention(event, signerUuid);
        }
        break;
      default:
        console.log(`Ignoring event type: ${event.type}`);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json(
      { error: 'Webhook processing failed', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/farcaster/webhook
 * Health check endpoint
 */
export async function GET() {
  return Response.json({
    status: 'active',
    endpoint: '/api/farcaster/webhook',
    events: ['cast.created'],
  });
}

/**
 * OPTIONS for CORS
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-neynar-signature',
    },
  });
}
