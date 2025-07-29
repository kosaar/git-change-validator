import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../utils/test-utils';
import App from '../../App';
import '../mocks/supabase';

// Mock all the hooks and contexts
const mockUser = {
  id: 'user-1',
  email: 'test@example.com'
};

const mockLdapUser = {
  ldap_username: 'testuser',
  ldap_display_name: 'Test User',
  ldap_groups: ['creators', 'validators'],
  ldap_email: 'test@example.com',
  supabase_user_id: 'user-1'
};

const mockAuthContext = {
  user: mockUser,
  ldapUser: mockLdapUser,
  loading: false,
  signInWithLDAP: vi.fn(),
  signOut: vi.fn()
};

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuthContext
}));

vi.mock('../../hooks/useValidationTasks', () => ({
  useValidationTasks: () => ({
    tasks: [
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
      }
    ],
    loading: false,
    error: null,
    fetchTasks: vi.fn()
  })
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ taskId: 'task-1' })
  };
});

describe('App Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows dashboard when user is authenticated', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Git Change Validator')).toBeInTheDocument();
      expect(screen.getByText('Validation Tasks')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
  });

  it('shows login form when user is not authenticated', async () => {
    mockAuthContext.user = null;
    mockAuthContext.ldapUser = null;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Sign in with your LDAP credentials')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockAuthContext.loading = true;

    render(<App />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays user info with roles in header', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('Validator')).toBeInTheDocument();
      expect(screen.getByText('Creator')).toBeInTheDocument();
    });
  });

  it('shows New Validation button for creators', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new validation/i })).toBeInTheDocument();
    });
  });

  it('hides New Validation button for non-creators', async () => {
    mockAuthContext.ldapUser = {
      ...mockLdapUser,
      ldap_groups: ['users'] // Not a creator
    };

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /new validation/i })).not.toBeInTheDocument();
    });
  });

  it('allows navigation to task details', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('feature/test-branch')).toBeInTheDocument();
    });

    const viewDetailsButton = screen.getByRole('button', { name: /view details/i });
    await user.click(viewDetailsButton);

    expect(mockNavigate).toHaveBeenCalledWith('/task/task-1');
  });

  it('handles sign out correctly', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    const signOutButton = screen.getByRole('button', { name: /sign out/i });
    await user.click(signOutButton);

    expect(mockAuthContext.signOut).toHaveBeenCalled();
  });

  it('filters tasks by status', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('feature/test-branch')).toBeInTheDocument();
    });

    const statusFilter = screen.getByLabelText(/status filter/i);
    await user.click(statusFilter);

    const integratedOption = screen.getByText('Integrated');
    await user.click(integratedOption);

    // Task should be hidden since it's not integrated
    expect(screen.queryByText('feature/test-branch')).not.toBeInTheDocument();
  });

  it('opens create task dialog', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new validation/i })).toBeInTheDocument();
    });

    const newValidationButton = screen.getByRole('button', { name: /new validation/i });
    await user.click(newValidationButton);

    expect(screen.getByText('Create New Validation Task')).toBeInTheDocument();
    expect(screen.getByLabelText(/git branch/i)).toBeInTheDocument();
  });

  it('shows correct status chips for tasks', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('PENDING VALIDATION')).toBeInTheDocument();
    });
  });

  it('displays validation tasks in correct order', async () => {
    render(<App />);

    await waitFor(() => {
      const taskRows = screen.getAllByRole('row');
      // Header row + 1 data row
      expect(taskRows).toHaveLength(2);
    });
  });
});