/**
 * Create secret page with form validation
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { Environment, RotationPeriod, CreateSecretRequest } from '@secrets-portal/shared-types';
import { apiClient } from '../services/api-client';
import { useApplications } from '../hooks/useApplications';
import { useEnvironments } from '../hooks/useEnvironments';
import Layout from '../components/Layout';

const CreateSecret: React.FC = () => {
  const navigate = useNavigate();
  const { applications, loading: appsLoading } = useApplications();
  const { environments, loading: envsLoading } = useEnvironments();
  const [formData, setFormData] = useState<CreateSecretRequest>({
    name: '',
    application: '',
    environment: 'NP',
    rotationPeriod: 90,
    value: '',
    description: '',
    owner: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Secret name is required';
    } else if (!/^[a-zA-Z0-9-]+$/.test(formData.name)) {
      newErrors.name = 'Secret name can only contain alphanumeric characters and hyphens';
    }

    if (!formData.application) {
      newErrors.application = 'Application is required';
    }

    if (!formData.value.trim()) {
      newErrors.value = 'Secret value is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setConfirmOpen(true);
    }
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setSubmitting(true);

    try {
      const secret = await apiClient.createSecret(formData);
      setSnackbar({
        open: true,
        message: 'Secret created successfully',
        severity: 'success',
      });
      setTimeout(() => {
        navigate(`/secrets/${secret.id}`);
      }, 1500);
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error?.message || 'Failed to create secret',
        severity: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof CreateSecretRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Layout>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/secrets')}>
            Back to Secrets
          </Button>
        </Box>

        <Card sx={{ maxWidth: 800, mx: 'auto' }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Create New Secret
            </Typography>

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Secret Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={!!errors.name}
                helperText={errors.name || 'Use alphanumeric characters and hyphens only'}
                margin="normal"
                required
              />

              <Autocomplete
                freeSolo
                options={applications}
                value={formData.application}
                onInputChange={(_event, newValue) => {
                  handleChange('application', newValue || '');
                }}
                loading={appsLoading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Application"
                    required
                    error={!!errors.application}
                    helperText={errors.application || 'Select from existing applications or type a new one'}
                    margin="normal"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {appsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              <FormControl fullWidth margin="normal" required>
                <InputLabel>Environment</InputLabel>
                <Select
                  value={formData.environment}
                  label="Environment"
                  onChange={(e) => handleChange('environment', e.target.value as Environment)}
                  disabled={envsLoading}
                >
                  {environments.map((env) => (
                    <MenuItem key={env} value={env}>
                      {env}
                      {env === 'NP' && ' (Non-Production)'}
                      {env === 'PP' && ' (Pre-Production)'}
                      {env === 'Prod' && ' (Production)'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal" required>
                <InputLabel>Rotation Period</InputLabel>
                <Select
                  value={formData.rotationPeriod}
                  label="Rotation Period"
                  onChange={(e) => handleChange('rotationPeriod', e.target.value as RotationPeriod)}
                >
                  <MenuItem value={45}>45 days</MenuItem>
                  <MenuItem value={60}>60 days</MenuItem>
                  <MenuItem value={90}>90 days</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Secret Value"
                type="password"
                value={formData.value}
                onChange={(e) => handleChange('value', e.target.value)}
                error={!!errors.value}
                helperText={errors.value}
                margin="normal"
                required
              />

              <TextField
                fullWidth
                label="Description (Optional)"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                margin="normal"
                multiline
                rows={2}
              />

              <TextField
                fullWidth
                label="Owner Email (Optional)"
                type="email"
                value={formData.owner}
                onChange={(e) => handleChange('owner', e.target.value)}
                margin="normal"
              />

              <Box display="flex" gap={2} mt={3}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/secrets')}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={submitting}
                >
                  Create Secret
                </Button>
              </Box>
            </form>
          </CardContent>
        </Card>

        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Confirm Secret Creation</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to create this secret?
            </Typography>
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                <strong>Name:</strong> {formData.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Application:</strong> {formData.application}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Environment:</strong> {formData.environment}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Rotation Period:</strong> {formData.rotationPeriod} days
              </Typography>
            </Box>
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

export default CreateSecret;
