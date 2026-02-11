/**
 * Protected route component that checks authentication
 */

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { authService } from '../services/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await authService.isAuthenticated();
      if (authenticated) {
        // Refresh token to ensure it's valid
        await authService.refreshToken();
      }
      setIsAuthenticated(authenticated);
    };

    checkAuth();

    // Set up token refresh interval (every 50 minutes)
    const refreshInterval = setInterval(async () => {
      const authenticated = await authService.isAuthenticated();
      if (authenticated) {
        await authService.refreshToken();
      }
    }, 50 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, []);

  if (isAuthenticated === null) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
