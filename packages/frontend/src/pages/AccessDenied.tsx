/**
 * Access denied page for 403 errors
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Alert, Typography, Button } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

const AccessDenied: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Alert severity="error" sx={{ mb: 3, width: '100%' }}>
          <Typography variant="h5" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" gutterBottom>
            You don't have permission to access this resource.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            If you believe this is an error, please contact your administrator or the security team.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Email: security@company.com
          </Typography>
        </Alert>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/secrets')}
        >
          Back to Secrets
        </Button>
      </Box>
    </Container>
  );
};

export default AccessDenied;
