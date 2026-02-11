/**
 * AWS Console Changes Report - Shows direct AWS access (Console/CLI/SDK)
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

interface ConsoleChange {
  secretArn: string;
  timestamp: string;
  secretName: string;
  application: string;
  environment: string;
  userId: string;
  userType: string;
  action: string;
  eventName: string;
  ipAddress: string;
  userAgent: string;
  region: string;
}

const ConsoleChangesReport: React.FC = () => {
  const [entries, setEntries] = useState<ConsoleChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.getConsoleChangesReport();
      setEntries(response.entries);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load console changes report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'User Type', 'Secret Name', 'Application', 'Environment', 'Action', 'Event Name', 'IP Address', 'Region'];
    const csvData = entries.map(entry => [
      new Date(entry.timestamp).toLocaleString(),
      entry.userId,
      entry.userType,
      entry.secretName,
      entry.application,
      entry.environment,
      entry.action,
      entry.eventName,
      entry.ipAddress,
      entry.region,
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aws-console-changes-${new Date().toISOString().split('T')[0]}.csv`;
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
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'userType',
      headerName: 'User Type',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
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
              : params.value === 'Unknown'
              ? 'default'
              : 'info'
          }
          size="small"
        />
      ),
    },
    {
      field: 'action',
      headerName: 'Action',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} size="small" color="primary" />
      ),
    },
    {
      field: 'eventName',
      headerName: 'Event',
      width: 150,
    },
    {
      field: 'ipAddress',
      headerName: 'IP Address',
      width: 140,
    },
    {
      field: 'region',
      headerName: 'Region',
      width: 120,
    },
  ];

  const rows = entries.map((entry, index) => ({
    id: `${entry.secretArn}-${entry.timestamp}-${index}`,
    ...entry,
  }));

  return (
    <Layout>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">AWS Console Changes</Typography>
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
          This report shows all direct AWS changes made via Console, CLI, or SDK (not through the portal).
          Captured via EventBridge and CloudTrail.
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
                  {loading ? <CircularProgress /> : <Typography>No console changes found</Typography>}
                </Box>
              ),
            }}
          />
        </Paper>

        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Total entries: {entries.length} | Showing direct AWS access only (Console, CLI, SDK)
          </Typography>
        </Box>
      </Box>
    </Layout>
  );
};

export default ConsoleChangesReport;
