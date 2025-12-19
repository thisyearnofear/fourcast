// API endpoint to resolve signals against market outcomes
import { reputationService } from '@/services/reputationService.js';
import { db } from '@/services/db.js';

export async function POST(req) {
  try {
    const body = await req.json();
    const { eventID, signalID } = body;

    if (!eventID && !signalID) {
      return Response.json(
        { success: false, error: 'Either eventID or signalID is required' },
        { status: 400 }
      );
    }

    let results = [];

    if (signalID) {
      // Resolve single signal
      const query = db.prepare('SELECT * FROM signals WHERE id = ?');
      const signal = query.get(signalID);

      if (!signal) {
        return Response.json(
          { success: false, error: 'Signal not found' },
          { status: 404 }
        );
      }

      results = [await reputationService.resolveSignal(signal)];
    } else {
      // Resolve all pending signals for event
      results = await reputationService.resolveEventSignals(eventID);
    }

    return Response.json({
      success: true,
      resolved: results.filter(r => r.status === 'RESOLVED').length,
      pending: results.filter(r => r.status === 'PENDING').length,
      results
    });
  } catch (err) {
    console.error('[Signals Resolve API] Error:', err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
