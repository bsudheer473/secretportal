/**
 * Main application component with routing
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import Login from './pages/Login';
import SecretsList from './pages/SecretsList';
import SecretDetail from './pages/SecretDetail';
import CreateSecret from './pages/CreateSecret';
import UpdateSecret from './pages/UpdateSecret';
import AccessReport from './pages/AccessReport';
import ConsoleChangesReport from './pages/ConsoleChangesReport';
import AccessDenied from './pages/AccessDenied';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/access-denied" element={<AccessDenied />} />
              <Route
                path="/secrets"
                element={
                  <ProtectedRoute>
                    <SecretsList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/secrets/new"
                element={
                  <ProtectedRoute>
                    <CreateSecret />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/secrets/:id"
                element={
                  <ProtectedRoute>
                    <SecretDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/secrets/:id/edit"
                element={
                  <ProtectedRoute>
                    <UpdateSecret />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/access"
                element={
                  <ProtectedRoute>
                    <AccessReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/console-changes"
                element={
                  <ProtectedRoute>
                    <ConsoleChangesReport />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/secrets" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

export default App;
