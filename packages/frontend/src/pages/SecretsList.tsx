/**
 * Secrets list page with filtering and pagination
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  Collapse,
  Chip,
  Typography,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridPaginationModel,
} from '@mui/x-data-grid';
import {
  Add as AddIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
} from '@mui/icons-material';
import { Secret, Environment } from '@secrets-portal/shared-types';
import { apiClient } from '../services/api-client';
import { useApplications } from '../hooks/useApplications';
import { useEnvironments } from '../hooks/useEnvironments';
import Layout from '../components/Layout';
import SearchBar from '../components/SearchBar';

const SecretsList: React.FC = () => {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applicationFilter, setApplicationFilter] = useState<string>('');
  const [environmentFilter, setEnvironmentFilter] = useState<Environment | ''>('');
  const { applications } = useApplications();
  const { environments } = useEnvironments();
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 50,
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const loadSecrets = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.listSecrets({
        application: applicationFilter || undefined,
        environment: environmentFilter || undefined,
        limit: paginationModel.pageSize,
      });
      setSecrets(response.secrets);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecrets();
  }, [applicationFilter, environmentFilter, paginationModel.pageSize]);

  const handleRowClick = (secretId: string) => {
    navigate(`/secrets/${secretId}`);
  };

  const toggleRowExpansion = (secretId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(secretId)) {
        newSet.delete(secretId);
      } else {
        newSet.add(secretId);
      }
      return newSet;
    });
  };

  const columns: GridColDef[] = [
    {
      field: 'expand',
      headerName: '',
      width: 50,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            toggleRowExpansion(params.row.id);
          }}
        >
          {expandedRows.has(params.row.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'application',
      headerName: 'Application',
      width: 120,
    },
    {
      field: 'environment',
      headerName: 'Environment',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          color={
            params.value === 'Prod'
              ? 'error'
              : params.value === 'PP'
              ? 'warning'
              : 'default'
          }
          size="small"
        />
      ),
    },
    {
      field: 'rotationPeriod',
      headerName: 'Rotation Period',
      width: 140,
      renderCell: (params: GridRenderCellParams) => `${params.value} days`,
    },
    {
      field: 'daysSinceRotation',
      headerName: 'Days Since Rotation',
      width: 170,
      renderCell: (params: GridRenderCellParams) => {
        const days = params.value as number;
        const rotationPeriod = params.row.rotationPeriod as number;
        const isOverdue = days >= rotationPeriod;
        return (
          <Chip
            label={days}
            color={isOverdue ? 'error' : days >= rotationPeriod * 0.8 ? 'warning' : 'success'}
            size="small"
          />
        );
      },
    },
    {
      field: 'lastModified',
      headerName: 'Last Modified',
      width: 180,
      renderCell: (params: GridRenderCellParams) =>
        new Date(params.value).toLocaleString(),
    },
  ];

  const rows = secrets.map((secret) => ({
    id: secret.id,
    name: secret.name,
    application: secret.application,
    environment: secret.environment,
    rotationPeriod: secret.rotationPeriod,
    daysSinceRotation: secret.daysSinceRotation,
    lastModified: secret.lastModified,
    tags: secret.tags,
  }));

  return (
    <Layout>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Secrets</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/secrets/new')}
          >
            Create Secret
          </Button>
        </Box>

        <SearchBar onSearch={(results) => {
          if (results === null) {
            // Clear search - reload all secrets
            loadSecrets();
          } else {
            setSecrets(results);
          }
        }} />

        <Box display="flex" gap={2} mb={3} mt={2}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Application</InputLabel>
            <Select
              value={applicationFilter}
              label="Application"
              onChange={(e) => setApplicationFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {applications.map((app) => (
                <MenuItem key={app} value={app}>
                  {app}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Environment</InputLabel>
            <Select
              value={environmentFilter}
              label="Environment"
              onChange={(e) => setEnvironmentFilter(e.target.value as Environment | '')}
            >
              <MenuItem value="">All</MenuItem>
              {environments.map((env) => (
                <MenuItem key={env} value={env}>
                  {env}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[25, 50, 100]}
            loading={loading}
            onRowClick={(params) => handleRowClick(params.id as string)}
            sx={{
              '& .MuiDataGrid-row': {
                cursor: 'pointer',
              },
            }}
            slots={{
              noRowsOverlay: () => (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  height="100%"
                >
                  {loading ? <CircularProgress /> : <Typography>No secrets found</Typography>}
                </Box>
              ),
            }}
          />
        </Paper>

        {/* Expandable tags section */}
        {secrets.map((secret) => (
          <Collapse key={secret.id} in={expandedRows.has(secret.id)}>
            <Paper sx={{ p: 2, mt: 1, mb: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Tags for {secret.name}:
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {Object.entries(secret.tags).map(([key, value]) => (
                  <Chip key={key} label={`${key}: ${value}`} size="small" variant="outlined" />
                ))}
              </Box>
            </Paper>
          </Collapse>
        ))}
      </Box>
    </Layout>
  );
};

export default SecretsList;
