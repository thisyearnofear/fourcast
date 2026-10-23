import { useState, useCallback, useRef } from 'react';

/**
 * Hook to run the autonomous agent loop via SSE streaming.
 * Consumes /api/agent NDJSON stream and provides real-time updates.
 *
 * @returns {{ run, stop, isRunning, steps, recommendations, error }}
 */
export function useAgentLoop() {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const run = useCallback(async (config = {}) => {
    setIsRunning(true);
    setSteps([]);
    setRecommendations([]);
    setError(null);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Agent failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const update = JSON.parse(line);
            setSteps(prev => [...prev, update]);

            if (update.step === 'edge' && update.status === 'complete') {
              setRecommendations(update.data?.recommendations || []);
            }

            if (update.step === 'error') {
              setError(update.message);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsRunning(false);
  }, []);

  return { run, stop, isRunning, steps, recommendations, error };
}
