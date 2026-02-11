/**
 * Warning banner for degraded mode or service unavailability
 */

import React, { useState, useEffect } from 'react';
import { Alert, Collapse, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface DegradedModeWarningProps {
  show: boolean;
  message?: string;
}

const DegradedModeWarning: React.FC<DegradedModeWarningProps> = ({
  show,
  message = 'The service is currently experiencing issues. Some features may be unavailable.',
}) => {
  const [open, setOpen] = useState(show);

  useEffect(() => {
    setOpen(show);
  }, [show]);

  return (
    <Collapse in={open}>
      <Alert
        severity="warning"
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={() => setOpen(false)}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
        sx={{ mb: 2 }}
      >
        {message}
      </Alert>
    </Collapse>
  );
};

export default DegradedModeWarning;
