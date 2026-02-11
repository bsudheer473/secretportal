/**
 * Update secret page with value update and rotation period configuration
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Divider,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { SecretDetail, RotationPeriod } from '../types';
import { apiClient } from '../services/api-client';
import Layout from '../components/Layout';

const UpdateSecret: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [secret, setSecret] = useState<SecretDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rotationPeriod, setRotationPeriod] = useState<RotationPeriod>(90);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<'value' | 'rotation'>('value');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadSecret = async () => {
      if (!id) return;

      setLoading(true);
      try {
        const secretData = await apiClient.getSecret(id);
        setSecret(secretData);
        setRotationPeriod(secretData.rotationPeriod);
      } catch (err: any) {
        setSnackbar({
          open: true,
          message: err.response?.data?.error?.message || 'Failed to load secret',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    loadSecret();
  }, [id]);

  const handleUpdateValue = () => {
    if (!newValue.trim()) {
      setSnackbar({
        open: true,
        message: 'Secret value cannot be empty',
        severity: 'error',
      });
      return;
    }
    setConfirmType('value');
    setConfirmOpen(true);
  };

  const handleUpdateRotation = () => {
    setConfirmType('rotation');
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!id) return;

    setConfirmOpen(false);
    setSubmitting(true);

    try {
      if (confirmType === 'value') {
        await apiClient.updateSecret(id, { value: newValue });
        setSnackbar({
          open: true,
          message: 'Secret value updated successfully',
          severity: 'success',
        });
        setNewValue('');
        setTimeout(() => {
          navigate(`/secrets/${id}`);
        }, 1500);
      } else {
        await apiClient.updateRotationPeriod(id, { rotationPeriod });
        setSnackbar({
          open: true,
          message: 'Rotation period updated successfully',
          severity: 'success',
        });
        if (secret) {
          setSecret({ ...secret, rotationPeriod });
        }
      }
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error?.message || 'Failed to update secret',
        severity: 'error',
      });
    } finally {
      setSubmitting(false);
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

  if (!secret) {
    return (
      <Layout>
        <Alert severity="error">Secret not found</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/secrets')} sx={{ mt: 2 }}>
          Back to Secrets
        </Button>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/secrets/${id}`)}>
            Back to Secret Details
          </Button>
        </Box>

        <Card sx={{ maxWidth: 800, mx: 'auto', mb: 3 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Update Secret Value
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {secret.name}
            </Typography>

            <Box mt={3}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Application:</strong> {secret.application}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Environment:</strong> {secret.environment}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Last Modified:</strong> {new Date(secret.lastModified).toLocaleString()}
              </Typography>
            </Box>

            <Divider sx={{ my: 3 }} />

            <TextField
              fullWidth
              label="New Secret Value"
              type={showPassword ? 'text' : 'password'}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box display="flex" gap={2} mt={3}>
              <Button
                variant="outlined"
                onClick={() => navigate(`/secrets/${id}`)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleUpdateValue}
                disabled={submitting || !newValue.trim()}
              >
                Update Value
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ maxWidth: 800, mx: 'auto' }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Rotation Period Settings
            </Typography>

            <FormControl component="fieldset" sx={{ mt: 3 }}>
              <FormLabel component="legend">Rotation Period</FormLabel>
              <RadioGroup
                value={rotationPeriod}
                onChange={(e) => setRotationPeriod(Number(e.target.value) as RotationPeriod)}
              >
                <FormControlLabel value={45} control={<Radio />} label="45 days" />
                <FormControlLabel value={60} control={<Radio />} label="60 days" />
                <FormControlLabel value={90} control={<Radio />} label="90 days" />
              </RadioGroup>
            </FormControl>

            <Box display="flex" gap={2} mt={3}>
              <Button
                variant="outlined"
                onClick={() => navigate(`/secrets/${id}`)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleUpdateRotation}
                disabled={submitting || rotationPeriod === secret.rotationPeriod}
              >
                Update Rotation Period
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>
            {confirmType === 'value' ? 'Confirm Secret Update' : 'Confirm Rotation Period Update'}
          </DialogTitle>
          <DialogContent>
            {confirmType === 'value' ? (
              <>
                <Typography gutterBottom>
                  Are you sure you want to update this secret's value?
                </Typography>
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This will reset the rotation timer. The secret will be marked as recently rotated.
                </Alert>
              </>
            ) : (
              <Typography>
                Are you sure you want to change the rotation period to {rotationPeriod} days?
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} variant="contained" autoFocus>
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Layout>
  );
};

export default UpdateSecret;
