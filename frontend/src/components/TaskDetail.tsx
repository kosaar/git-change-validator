import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Paper
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { ValidationStatus } from '../types/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useValidationTask } from '../hooks/useValidationTask';
import { ValidatorOnly } from './RoleGuard';

const statusColors: Record<ValidationStatus, 'default' | 'warning' | 'success' | 'error'> = {
  PENDING_VALIDATION: 'warning',
  INTEGRATION_IN_PROGRESS: 'default',
  INTEGRATED: 'success',
  ERROR: 'error'
};

export const TaskDetail = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user, ldapUser } = useAuth();
  const { task, loading, error, fetchTask, updateTask } = useValidationTask(taskId);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingDiff, setDownloadingDiff] = useState(false);

  const canValidate = ldapUser?.ldap_groups.includes('validators') || 
                     ldapUser?.ldap_groups.includes('admins');

  const onDrop = async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length || !task || !canValidate) return;

    const file = acceptedFiles[0];
    if (!file.name.endsWith('.csv')) {
      setLocalError('Please upload a CSV file');
      return;
    }

    setUploading(true);
    setLocalError(null);

    try {
      // Upload file to Supabase Storage
      const fileName = `${task.id}/validated.csv`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('validated-files')
        .upload(fileName, file, {
          contentType: 'text/csv',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Update task with validated file path
      const { error: updateError } = await supabase
        .from('validation_tasks')
        .update({
          validated_file_path: uploadData.path,
          validated_file_uploaded_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (updateError) throw updateError;

      // Optimistically update the task
      updateTask({
        validated_file_path: uploadData.path,
        validated_file_uploaded_at: new Date().toISOString()
      });

    } catch (err) {
      console.error('Error uploading file:', err);
      setLocalError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/csv': ['.csv']
    },
    maxFiles: 1,
    disabled: !canValidate || task?.status !== 'PENDING_VALIDATION' || uploading
  });

  const handleDownloadDiff = async () => {
    if (!task?.diff_file_path) return;

    setDownloadingDiff(true);
    try {
      const { data, error } = await supabase.storage
        .from('diff-files')
        .download(task.diff_file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = task.diff_file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error downloading diff file:', err);
      setLocalError('Failed to download diff file');
    } finally {
      setDownloadingDiff(false);
    }
  };

  const handleTriggerIntegration = async () => {
    if (!task?.validated_file_path) return;

    try {
      const { data, error } = await supabase.functions.invoke('trigger-integration', {
        body: {
          taskId: task.id,
          validatedFilePath: task.validated_file_path
        }
      });

      if (error) throw error;

      // Optimistically update task status
      updateTask({
        status: 'INTEGRATION_IN_PROGRESS',
        validator_user_id: user?.id
      });

    } catch (err) {
      console.error('Error triggering integration:', err);
      setLocalError('Failed to trigger integration');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!task) {
    return (
      <Box>
        <Alert severity="error">Task not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          Task Details
        </Typography>
        <IconButton onClick={fetchTask}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {(error || localError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || localError}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Task Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Task Information
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Task ID
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {task.id}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={task.status.replace('_', ' ')}
                  color={statusColors[task.status]}
                  size="small"
                />
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body1">
                  {formatDate(task.created_at)}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Created By
                </Typography>
                <Typography variant="body1">
                  {(task as any).created_by_display_name} ({(task as any).created_by_username})
                </Typography>
              </Box>
              {task.validator_user_id && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Validator
                  </Typography>
                  <Typography variant="body1">
                    {(task as any).validator_display_name} ({(task as any).validator_username})
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Git Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Git Information
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Branch
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {task.git_branch}
                </Typography>
              </Box>
              {task.reference_commit_hash && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Reference Commit
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                    {task.reference_commit_hash.substring(0, 8)}...
                  </Typography>
                </Box>
              )}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Current Commit
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {task.current_commit_hash.substring(0, 8)}...
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Job ID
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {task.generation_job_id}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Diff File Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Diff File
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="body1">
                  {task.diff_file_name}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={downloadingDiff ? <CircularProgress size={16} /> : <DownloadIcon />}
                  onClick={handleDownloadDiff}
                  disabled={!task.diff_file_path || downloadingDiff}
                >
                  Download
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Generated: {formatDate(task.diff_file_generated_at)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Validation Section */}
        <ValidatorOnly>
          {task.status === 'PENDING_VALIDATION' && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Upload Validated File
                  </Typography>
                  <Paper
                    {...getRootProps()}
                    sx={{
                      border: '2px dashed #ccc',
                      borderRadius: 2,
                      p: 3,
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <input {...getInputProps()} />
                    {uploading ? (
                      <CircularProgress />
                    ) : (
                      <>
                        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          {isDragActive ? 'Drop the CSV file here' : 'Drag & drop a CSV file here'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          or click to select a file
                        </Typography>
                      </>
                    )}
                  </Paper>
                </CardContent>
              </Card>
            </Grid>
          )}
        </ValidatorOnly>

        {/* Validated File Section */}
        {task.validated_file_path && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Validated File
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Typography variant="body1">
                    validated.csv
                  </Typography>
                  <ValidatorOnly>
                    {task.status === 'PENDING_VALIDATION' && (
                      <Button
                        variant="contained"
                        onClick={handleTriggerIntegration}
                      >
                        Trigger Integration
                      </Button>
                    )}
                  </ValidatorOnly>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Uploaded: {task.validated_file_uploaded_at && formatDate(task.validated_file_uploaded_at)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Integration Results */}
        {task.integration_result && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Integration Results
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={task.integration_result}
                    color={task.integration_result === 'SUCCESS' ? 'success' : 'error'}
                  />
                </Box>
                {task.error_message && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {task.error_message}
                  </Alert>
                )}
                {task.error_file_link && (
                  <Button
                    variant="outlined"
                    color="error"
                    href={task.error_file_link}
                    target="_blank"
                  >
                    View Error File
                  </Button>
                )}
                {task.integration_completed_at && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Completed: {formatDate(task.integration_completed_at)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};