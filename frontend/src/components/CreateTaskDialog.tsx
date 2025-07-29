import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
}

export const CreateTaskDialog = ({ open, onClose, onTaskCreated }: CreateTaskDialogProps) => {
  const { ldapUser } = useAuth();
  const [gitBranch, setGitBranch] = useState('');
  const [referenceCommitHash, setReferenceCommitHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreateTasks = ldapUser?.ldap_groups.includes('creators') || 
                        ldapUser?.ldap_groups.includes('admins');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gitBranch.trim()) {
      setError('Git branch is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('trigger-diff-generation', {
        body: {
          gitBranch: gitBranch.trim(),
          referenceCommitHash: referenceCommitHash.trim() || undefined
        }
      });

      if (error) throw error;

      if (data?.success) {
        onTaskCreated();
        handleClose();
      } else {
        setError(data?.error || 'Failed to create validation task');
      }

    } catch (err) {
      console.error('Error creating task:', err);
      setError('Failed to create validation task');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setGitBranch('');
    setReferenceCommitHash('');
    setError(null);
    onClose();
  };

  if (!canCreateTasks) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Access Denied</DialogTitle>
        <DialogContent>
          <Alert severity="error">
            You don't have permission to create validation tasks. 
            Contact your administrator to be added to the 'creators' or 'admins' group.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Validation Task</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <TextField
            fullWidth
            label="Git Branch"
            value={gitBranch}
            onChange={(e) => setGitBranch(e.target.value)}
            margin="normal"
            required
            placeholder="feature/my-changes"
            helperText="The Git branch containing the changes to validate"
            disabled={loading}
          />
          
          <TextField
            fullWidth
            label="Reference Commit Hash (Optional)"
            value={referenceCommitHash}
            onChange={(e) => setReferenceCommitHash(e.target.value)}
            margin="normal"
            placeholder="abc123def456..."
            helperText="Base commit to compare against. Leave empty to use default base branch."
            disabled={loading}
            sx={{ fontFamily: 'monospace' }}
          />
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Create Task'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};