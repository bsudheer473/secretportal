/**
 * Layout component with navigation and logout
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
} from '@mui/material';
import { Logout as LogoutIcon, Assessment as ReportIcon } from '@mui/icons-material';
import { authService } from '../services/auth';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authService.signOut();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, cursor: 'pointer' }} onClick={() => navigate('/secrets')}>
            Secrets Management Portal
          </Typography>
          <Button color="inherit" startIcon={<ReportIcon />} onClick={() => navigate('/reports/access')}>
            Portal Access
          </Button>
          <Button color="inherit" startIcon={<ReportIcon />} onClick={() => navigate('/reports/console-changes')}>
            AWS Console
          </Button>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        {children}
      </Container>
    </Box>
  );
};

export default Layout;
