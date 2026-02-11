/**
 * Search bar component with debounced search and autocomplete
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Autocomplete,
  TextField,
  InputAdornment,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import { Secret } from '../types';
import { apiClient } from '../services/api-client';

interface SearchBarProps {
  onSearch: (results: Secret[]) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultsCount, setResultsCount] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (searchQuery: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          if (searchQuery.trim().length === 0) {
            setOptions([]);
            setResultsCount(null);
            // Only reload if we previously had search results
            if (hasSearched) {
              onSearch(null as any);
              setHasSearched(false);
            }
            return;
          }

          setLoading(true);
          setHasSearched(true);
          try {
            const results = await apiClient.searchSecrets(searchQuery);
            setOptions(results);
            setResultsCount(results.length);
            onSearch(results);
          } catch (err) {
            console.error('Search failed:', err);
            setOptions([]);
            setResultsCount(0);
          } finally {
            setLoading(false);
          }
        }, 300);
      };
    })(),
    [onSearch, hasSearched]
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  const handleClear = () => {
    setQuery('');
    setOptions([]);
    setResultsCount(null);
    setHasSearched(false);
    // Signal to reload all secrets by passing null
    onSearch(null as any);
  };

  return (
    <Box>
      <Autocomplete
        freeSolo
        options={options}
        loading={loading}
        inputValue={query}
        onInputChange={(_, newValue) => setQuery(newValue)}
        getOptionLabel={(option) => {
          if (typeof option === 'string') return option;
          return option.name;
        }}
        renderOption={(props, option) => (
          <li {...props}>
            <Box>
              <Typography variant="body2">{option.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {option.application} - {option.environment}
              </Typography>
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search secrets by name, application, or environment..."
            fullWidth
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <>
                  {params.InputProps.endAdornment}
                  {query && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={handleClear}>
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  )}
                </>
              ),
            }}
          />
        )}
      />
      {resultsCount !== null && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {resultsCount} {resultsCount === 1 ? 'result' : 'results'} found
        </Typography>
      )}
    </Box>
  );
};

export default SearchBar;
