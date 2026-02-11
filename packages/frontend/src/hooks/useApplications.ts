import { useState, useEffect } from 'react';
import { apiClient } from '../services/api-client';

/**
 * Hook to load and cache applications from the backend
 */
export const useApplications = () => {
  const [applications, setApplications] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadApplications = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getApplications();
        setApplications(response.applications);
      } catch (err: any) {
        console.error('Failed to load applications:', err);
        setError('Failed to load applications');
        // Fallback to empty array - user can type manually
        setApplications([]);
      } finally {
        setLoading(false);
      }
    };

    loadApplications();
  }, []);

  return { applications, loading, error };
};
