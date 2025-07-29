import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { ValidationStatus } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { CreateTaskDialog } from './CreateTaskDialog';
import { useValidationTasks } from '../hooks/useValidationTasks';
import { CreatorOnly } from './RoleGuard';

const statusColors: Record<ValidationStatus, 'default' | 'warning' | 'success' | 'error'> = {
  PENDING_VALIDATION: 'warning',
  INTEGRATION_IN_PROGRESS: 'default',
  INTEGRATED: 'success',
  ERROR: 'error'
};

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tasks, loading, error, fetchTasks } = useValidationTasks();
  const [statusFilter, setStatusFilter] = useState<ValidationStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const filteredTasks = tasks.filter(task => {
    const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter;
    const matchesSearch = task.git_branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Validation Tasks
        </Typography>
        <CreatorOnly>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            New Validation
          </Button>
        </CreatorOnly>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Search by ID or Branch"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth>
            <InputLabel>Status Filter</InputLabel>
            <Select
              value={statusFilter}
              label="Status Filter"
              onChange={(e) => setStatusFilter(e.target.value as ValidationStatus | 'ALL')}
            >
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value="PENDING_VALIDATION">Pending Validation</MenuItem>
              <MenuItem value="INTEGRATION_IN_PROGRESS">Integration in Progress</MenuItem>
              <MenuItem value="INTEGRATED">Integrated</MenuItem>
              <MenuItem value="ERROR">Error</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Git Branch</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Validator</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTasks.map((task) => (
              <TableRow key={task.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {task.id.substring(0, 8)}...
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={task.status.replace('_', ' ')}
                    color={statusColors[task.status]}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {task.git_branch}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(task.created_at)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {task.validator_user_id ? 'Assigned' : 'Unassigned'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Button 
                    size="small" 
                    variant="outlined"
                    onClick={() => navigate(`/task/${task.id}`)}
                  >
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredTasks.length === 0 && (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No validation tasks found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm || statusFilter !== 'ALL' 
              ? 'Try adjusting your filters'
              : 'Create your first validation task'
            }
          </Typography>
        </Box>
      )}

      <CreateTaskDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onTaskCreated={fetchTasks}
      />
    </Box>
  );
};