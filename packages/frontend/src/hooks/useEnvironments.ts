import { useState, useEffect } from 'react';
import { apiClient } from '../services/api-client';

/**
 * Hook to load and cache environments from the backend
 */
export const useEnvironments = () => {
  const [environments, setEnvironments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEnvironments = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getEnvironments();
        setEnvironments(response.environments);
      } catch (err: any) {
        console.error('Failed to load environments:', err);
        setError('Failed to load environments');
        // Fallback to default environments
        setEnvironments(['NP', 'PP', 'Prod']);
      } finally {
        setLoading(false);
      }
    };

    loadEnvironments();
  }, []);

  return { environments, loading, error };
};
