/**
 * Custom hook for API calls with retry logic
 */

import { useState, useCallback } from 'react';
import { AxiosError } from 'axios';

interface UseApiWithRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApiWithRetry<T>(
  options: UseApiWithRetryOptions = {}
): [
  ApiState<T>,
  (apiCall: () => Promise<T>) => Promise<T | null>
] {
  const { maxRetries = 3, retryDelay = 1000 } = options;
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (apiCall: () => Promise<T>): Promise<T | null> => {
      setState({ data: null, loading: true, error: null });

      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const result = await apiCall();
          setState({ data: result, loading: false, error: null });
          return result;
        } catch (err: any) {
          lastError = err;

          // Don't retry on 4xx errors (client errors)
          if (err.response?.status >= 400 && err.response?.status < 500) {
            break;
          }

          // Wait before retrying (except on last attempt)
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
          }
        }
      }

      // All retries failed
      const errorMessage = lastError instanceof AxiosError
        ? lastError.response?.data?.error?.message || lastError.message
        : 'An unexpected error occurred';

      setState({ data: null, loading: false, error: errorMessage });
      return null;
    },
    [maxRetries, retryDelay]
  );

  return [state, execute];
}
