import { MarketTypeDetector } from './marketTypeDetector';

describe('MarketTypeDetector', () => {
  
  describe('NFL Markets', () => {
    test('detects Super Bowl futures bet', () => {
      const market = {
        title: 'Will the Kansas City Chiefs win Super Bowl 2027?',
        resolutionDate: '2027-02-14',
        currentOdds: { yes: 0.08, no: 0.92 }
      };
      
      const result = MarketTypeDetector.detectMarketType(market);
      expect(result.isFutures).toBe(true);
      expect(result.confidence).toBe('HIGH');
    });

    test('detects division winner futures bet', () => {
      const market = {
        title: 'Will the Washington Commanders win the NFC East?',
        description: 'This market will resolve to "Yes" if the Washington Commanders win the NFC East in the 2025-2026 NFL Season.',
        resolutionDate: '2026-01-10',
        currentOdds: { yes: 0.035, no: 0.965 }
      };
      
      const result = MarketTypeDetector.detectMarketType(market);
      expect(result.isFutures).toBe(true);
      expect(result.confidence).toBe('HIGH');
    });

    test('detects single game as non-futures', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const market = {
        title: 'Cowboys vs Eagles Week 12',
        resolutionDate: tomorrow.toISOString(),
        currentOdds: { yes: 0.45, no: 0.55 }
      };
      
      const result = MarketTypeDetector.detectMarketType(market);
      expect(result.isFutures).toBe(false);
    });
  });

  describe('International Soccer', () => {
    test('detects Spanish La Liga futures', () => {
      const market = {
        title: 'Will Barcelona win La Liga 2026?',
        resolutionDate: '2026-05-30',
        currentOdds: { yes: 0.15 }
      };
      
      const result = MarketTypeDetector.detectMarketType(market);
      expect(result.isFutures).toBe(true);
    });

    test('detects Premier League futures', () => {
      const market = {
        title: 'Will Manchester City win the Premier League?',
        description: 'Resolves at end of 2025-26 season',
        resolutionDate: '2026-05-24',
        currentOdds: { yes: 0.25 }
      };
      
      const result = MarketTypeDetector.detectMarketType(market);
      expect(result.isFutures).toBe(true);
    });

    test('detects tonight\'s match as single event', () => {
      const tonight = new Date(Date.now() + 6 * 60 * 60 * 1000);
      const market = {
        title: 'Real Madrid vs Barcelona tonight',
        resolutionDate: tonight.toISOString(),
        currentOdds: { yes: 0.48 }
      };
      
      const result = MarketTypeDetector.detectMarketType(market);
      expect(result.isFutures).toBe(false);
    });
  });

  describe('Other Sports', () => {
    test('detects NBA championship futures', () => {
      const market = {
        title: 'Will the Lakers win the NBA Championship 2026?',
        resolutionDate: '2026-06-15',
        currentOdds: { yes: 0.06 }
      };
      
      const result = MarketTypeDetector.detectMarketType(market);
      expect(result.isFutures).toBe(true);
    });

    test('detects MLB World Series futures', () => {
      const market = {
        title: 'Will the Yankees win the World Series?',
        description: 'Resolves after 2025 World Series',
        resolutionDate: '2025-11-01',
        currentOdds: { yes: 0.09 }
      };
      
      const result = MarketTypeDetector.detectMarketType(market);
      expect(result.isFutures).toBe(true);
    });

    test('detects tennis tournament as non-futures', () => {
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const market = {
        title: 'Will Djokovic win Wimbledon 2025?',
        resolutionDate: nextWeek.toISOString(),
        currentOdds: { yes: 0.35 }
      };
      
      // Tennis tournaments are typically 2 weeks, not season-long
      const result = MarketTypeDetector.detectMarketType(market);
      expect(result.isFutures).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('handles missing resolution date gracefully', () => {
      const market = {
        title: 'Will team win championship?',
        currentOdds: { yes: 0.05 }
      };
      
      const result = MarketTypeDetector.detectMarketType(market);
      // Should still detect based on language + odds
      expect(result.isFutures).toBe(true);
    });

    test('handles missing odds gracefully', () => {
      const market = {
        title: 'Will team win the championship?',
        resolutionDate: '2026-05-01'
      };
      
      const result = MarketTypeDetector.detectMarketType(market);
      expect(result.isFutures).toBe(true);
    });

    test('detects season win totals as futures', () => {
      const market = {
        title: 'Will the Patriots win over 9.5 games this season?',
        resolutionDate: '2026-01-10',
        currentOdds: { yes: 0.45 }
      };
      
      const result = MarketTypeDetector.detectMarketType(market);
      expect(result.isFutures).toBe(true);
    });
  });

  describe('Helper Methods', () => {
    test('isFuturesBet quick check', () => {
      const futures = {
        title: 'Super Bowl winner 2027',
        resolutionDate: '2027-02-14'
      };
      
      expect(MarketTypeDetector.isFuturesBet(futures)).toBe(true);
    });

    test('analyzeResolutionDate scoring', () => {
      const farFuture = {
        resolutionDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      const result = MarketTypeDetector.analyzeResolutionDate(farFuture);
      expect(result.score).toBe(5);
    });
  });
});
