/**
 * Secret detail page showing metadata and audit log
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { SecretDetail as SecretDetailType, AuditLogEntry } from '@secrets-portal/shared-types';
import { apiClient } from '../services/api-client';
import Layout from '../components/Layout';

const SecretDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [secret, setSecret] = useState<SecretDetailType | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingConsole, setOpeningConsole] = useState(false);

  useEffect(() => {
    const loadSecret = async () => {
      if (!id) return;

      setLoading(true);
      setError('');
      try {
        // Load secret details
        const secretData = await apiClient.getSecret(id);
        setSecret(secretData);
        
        // Try to load audit log, but don't fail if it doesn't exist
        try {
          const auditData = await apiClient.getAuditLog(id);
          setAuditLog(auditData.entries);
        } catch (auditErr) {
          // Audit log not found is okay, just leave it empty
          console.log('No audit log found for secret');
          setAuditLog([]);
        }
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load secret details');
      } finally {
        setLoading(false);
      }
    };

    loadSecret();
  }, [id]);

  const handleOpenConsole = async () => {
    if (!id) return;

    setOpeningConsole(true);
    try {
      const url = await apiClient.getConsoleUrl(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to get console URL');
    } finally {
      setOpeningConsole(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (error || !secret) {
    return (
      <Layout>
        <Alert severity="error">{error || 'Secret not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/secrets')} sx={{ mt: 2 }}>
          Back to Secrets
        </Button>
      </Layout>
    );
  }

  const isOverdue = secret.daysSinceRotation >= secret.rotationPeriod;

  return (
    <Layout>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/secrets')}>
            Back to Secrets
          </Button>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => navigate(`/secrets/${id}/edit`)}
            >
              Update Rotation Period
            </Button>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/secrets/${id}/edit`)}
            >
              Update Secret
            </Button>
            <Button
              variant="contained"
              startIcon={<OpenInNewIcon />}
              onClick={handleOpenConsole}
              disabled={openingConsole}
            >
              {openingConsole ? 'Opening...' : 'Open in AWS Console'}
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  {secret.name}
                </Typography>
                <Divider sx={{ my: 2 }} />

                <List>
                  <ListItem>
                    <ListItemText
                      primary="Application"
                      secondary={secret.application}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Environment"
                      secondary={
                        <Chip
                          label={secret.environment}
                          color={
                            secret.environment === 'Prod'
                              ? 'error'
                              : secret.environment === 'PP'
                              ? 'warning'
                              : 'default'
                          }
                          size="small"
                        />
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Rotation Period"
                      secondary={`${secret.rotationPeriod} days`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Days Since Rotation"
                      secondary={
                        <Chip
                          label={secret.daysSinceRotation}
                          color={
                            isOverdue
                              ? 'error'
                              : secret.daysSinceRotation >= secret.rotationPeriod * 0.8
                              ? 'warning'
                              : 'success'
                          }
                          size="small"
                        />
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Last Modified"
                      secondary={new Date(secret.lastModified).toLocaleString()}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Created At"
                      secondary={new Date(secret.createdAt).toLocaleString()}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Created By"
                      secondary={secret.createdBy}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Last Modified By"
                      secondary={secret.lastModifiedBy}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="AWS Region"
                      secondary={secret.awsRegion}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  AWS Tags
                </Typography>
                <Divider sx={{ my: 2 }} />
                <List>
                  {Object.entries(secret.tags).map(([key, value]) => (
                    <ListItem key={key}>
                      <ListItemText
                        primary={key}
                        secondary={value}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Audit Log
                </Typography>
                <Divider sx={{ my: 2 }} />
                {auditLog.length === 0 ? (
                  <Typography color="text.secondary">No audit log entries</Typography>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Timestamp</TableCell>
                          <TableCell>User</TableCell>
                          <TableCell>Action</TableCell>
                          <TableCell>Details</TableCell>
                          <TableCell>IP Address</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {auditLog.map((entry, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {new Date(entry.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell>{entry.userId}</TableCell>
                            <TableCell>
                              <Chip label={entry.action} size="small" />
                            </TableCell>
                            <TableCell>
                              {entry.details || '-'}
                            </TableCell>
                            <TableCell>{entry.ipAddress}</TableCell>
                            <TableCell>
                              <Chip
                                label={entry.success ? 'Success' : 'Failed'}
                                color={entry.success ? 'success' : 'error'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Layout>
  );
};

export default SecretDetail;
