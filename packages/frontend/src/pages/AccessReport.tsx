/**
 * Access Report page - Shows who accessed which secrets
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import { Download as DownloadIcon } from '@mui/icons-material';
import { apiClient } from '../services/api-client';
import Layout from '../components/Layout';

interface AccessReportEntry {
  secretId: string;
  secretName: string;
  application: string;
  environment: string;
  timestamp: string;
  userId: string;
  action: string;
  ipAddress: string;
  success: boolean;
  details?: string;
}

const AccessReport: React.FC = () => {
  const [entries, setEntries] = useState<AccessReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.getAccessReport();
      setEntries(response.entries);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load access report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Secret Name', 'Application', 'Environment', 'Action', 'IP Address', 'Status', 'Details'];
    const csvData = entries.map(entry => [
      new Date(entry.timestamp).toLocaleString(),
      entry.userId,
      entry.secretName,
      entry.application,
      entry.environment,
      entry.action,
      entry.ipAddress,
      entry.success ? 'Success' : 'Failed',
      entry.details || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const columns: GridColDef[] = [
    {
      field: 'timestamp',
      headerName: 'Timestamp',
      width: 180,
      renderCell: (params: GridRenderCellParams) =>
        new Date(params.value as string).toLocaleString(),
    },
    {
      field: 'userId',
      headerName: 'User',
      width: 200,
    },
    {
      field: 'secretName',
      headerName: 'Secret Name',
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
      field: 'action',
      headerName: 'Action',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} size="small" />
      ),
    },
    {
      field: 'ipAddress',
      headerName: 'IP Address',
      width: 150,
    },
    {
      field: 'success',
      headerName: 'Status',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'Success' : 'Failed'}
          color={params.value ? 'success' : 'error'}
          size="small"
        />
      ),
    },
    {
      field: 'details',
      headerName: 'Details',
      flex: 1,
      minWidth: 200,
    },
  ];

  const rows = entries.map((entry, index) => ({
    id: `${entry.secretId}-${entry.timestamp}-${index}`,
    ...entry,
  }));

  return (
    <Layout>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Access Report</Typography>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={exportToCSV}
            disabled={entries.length === 0}
          >
            Export to CSV
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          This report shows all secret access activity across all applications and environments.
          Only administrators can view this report.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ height: 700, width: '100%' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            pageSizeOptions={[25, 50, 100, 500]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 50 },
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
                  {loading ? <CircularProgress /> : <Typography>No access logs found</Typography>}
                </Box>
              ),
            }}
          />
        </Paper>

        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Total entries: {entries.length}
          </Typography>
        </Box>
      </Box>
    </Layout>
  );
};

export default AccessReport;
