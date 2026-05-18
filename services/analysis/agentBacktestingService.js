/**
 * Agent Backtesting Service
 * Analyzes historical agent forecast performance against market outcomes.
 */
import { query } from '../db';

export const agentBacktestingService = {
  /**
   * Calculate accuracy metrics for a given date range
   */
  async getPerformanceSummary(days = 30) {
    const cutoff = Math.floor(Date.now() / 1000) - (days * 86400);
    
    const stats = await query(
      `SELECT 
        COUNT(*) as total_forecasts,
        AVG(brier_score) as avg_brier,
        COUNT(CASE WHEN actual_outcome = (CASE WHEN ai_probability > 0.5 THEN 1 ELSE 0 END) THEN 1 END) as hits,
        COUNT(*) - COUNT(CASE WHEN actual_outcome = (CASE WHEN ai_probability > 0.5 THEN 1 ELSE 0 END) THEN 1 END) as misses
       FROM agent_forecasts 
       WHERE resolved = 1 AND timestamp > ?`,
      [cutoff]
    );

    return stats[0];
  },

  /**
   * Get forecast-vs-outcome data points for chart backtesting visualization
   */
  async getForecastCalibration(limit = 100) {
    return await query(
      `SELECT ai_probability, actual_outcome, confidence 
       FROM agent_forecasts 
       WHERE resolved = 1 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [limit]
    );
  }
};
