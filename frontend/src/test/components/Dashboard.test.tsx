import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../utils/test-utils';
import { Dashboard } from '../../components/Dashboard';
import { ValidationTask } from '../../types/database';
import '../mocks/supabase';

// Mock the hooks
const mockTasks: ValidationTask[] = [
  {
    id: 'task-1',
    status: 'PENDING_VALIDATION',
    git_branch: 'feature/test-branch',
    current_commit_hash: 'abc123',
    diff_file_name: 'test-diff.csv',
    diff_file_generated_at: '2023-01-01T10:00:00Z',
    generation_job_id: 'job-1',
    created_at: '2023-01-01T09:00:00Z',
    updated_at: '2023-01-01T09:00:00Z',
    created_by: 'user-1'
  },
  {
    id: 'task-2',
    status: 'INTEGRATED',
    git_branch: 'feature/another-branch',
    current_commit_hash: 'def456',
    diff_file_name: 'another-diff.csv',
    diff_file_generated_at: '2023-01-02T10:00:00Z',
    generation_job_id: 'job-2',
    validator_user_id: 'user-2',
    integration_result: 'SUCCESS',
    created_at: '2023-01-02T09:00:00Z',
    updated_at: '2023-01-02T11:00:00Z',
    created_by: 'user-1'
  }
];

const mockFetchTasks = vi.fn();
const mockUseValidationTasks = {
  tasks: mockTasks,
  loading: false,
  error: null,
  fetchTasks: mockFetchTasks
};

vi.mock('../../hooks/useValidationTasks', () => ({
  useValidationTasks: () => mockUseValidationTasks
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    ldapUser: {
      ldap_username: 'testuser',
      ldap_display_name: 'Test User',
      ldap_groups: ['creators', 'validators']
    }
  })
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard with tasks', () => {
    render(<Dashboard />);
    
    expect(screen.getByText('Validation Tasks')).toBeInTheDocument();
    expect(screen.getByText('feature/test-branch')).toBeInTheDocument();
    expect(screen.getByText('feature/another-branch')).toBeInTheDocument();
  });

  it('shows New Validation button for creators', () => {
    render(<Dashboard />);
    
    expect(screen.getByRole('button', { name: /new validation/i })).toBeInTheDocument();
  });

  it('filters tasks by status', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    
    const statusFilter = screen.getByLabelText(/status filter/i);
    await user.click(statusFilter);
    
    const pendingOption = screen.getByText('Pending Validation');
    await user.click(pendingOption);
    
    // Should only show pending validation tasks
    expect(screen.getByText('feature/test-branch')).toBeInTheDocument();
    expect(screen.queryByText('feature/another-branch')).not.toBeInTheDocument();
  });

  it('filters tasks by search term', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    
    const searchInput = screen.getByLabelText(/search by id or branch/i);
    await user.type(searchInput, 'test-branch');
    
    // Should only show matching tasks
    expect(screen.getByText('feature/test-branch')).toBeInTheDocument();
    expect(screen.queryByText('feature/another-branch')).not.toBeInTheDocument();
  });

  it('navigates to task detail when clicking View Details', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    
    const viewDetailsButtons = screen.getAllByText('View Details');
    await user.click(viewDetailsButtons[0]);
    
    expect(mockNavigate).toHaveBeenCalledWith('/task/task-1');
  });

  it('opens create task dialog when clicking New Validation', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    
    const newValidationButton = screen.getByRole('button', { name: /new validation/i });
    await user.click(newValidationButton);
    
    expect(screen.getByText('Create New Validation Task')).toBeInTheDocument();
  });

  it('displays correct status chips', () => {
    render(<Dashboard />);
    
    expect(screen.getByText('PENDING VALIDATION')).toBeInTheDocument();
    expect(screen.getByText('INTEGRATED')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseValidationTasks.loading = true;
    render(<Dashboard />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays error message when there is an error', () => {
    mockUseValidationTasks.loading = false;
    mockUseValidationTasks.error = 'Failed to load tasks';
    render(<Dashboard />);
    
    expect(screen.getByText('Failed to load tasks')).toBeInTheDocument();
  });

  it('shows empty state when no tasks match filters', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    
    const searchInput = screen.getByLabelText(/search by id or branch/i);
    await user.type(searchInput, 'nonexistent');
    
    expect(screen.getByText('No validation tasks found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    render(<Dashboard />);
    
    // Should format the date from the mock tasks
    expect(screen.getByText(/Jan 1, 2023/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 2, 2023/)).toBeInTheDocument();
  });
});