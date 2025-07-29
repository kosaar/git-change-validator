import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../utils/test-utils';
import { LoginForm } from '../../components/LoginForm';
import '../mocks/supabase';

// Mock the useAuth hook
const mockSignInWithLDAP = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signInWithLDAP: mockSignInWithLDAP
  })
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with all elements', () => {
    render(<LoginForm />);
    
    expect(screen.getByText('Git Change Validator')).toBeInTheDocument();
    expect(screen.getByText('Sign in with your LDAP credentials')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);
    
    // HTML5 validation should prevent submission
    const usernameInput = screen.getByLabelText(/username/i);
    expect(usernameInput).toBeInvalid();
  });

  it('calls signInWithLDAP with correct credentials', async () => {
    const user = userEvent.setup();
    mockSignInWithLDAP.mockResolvedValue({ success: true });
    
    render(<LoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockSignInWithLDAP).toHaveBeenCalledWith('testuser', 'testpass');
    });
  });

  it('displays error message on login failure', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Invalid credentials';
    mockSignInWithLDAP.mockResolvedValue({ success: false, error: errorMessage });
    
    render(<LoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'wrongpass');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('shows loading state during authentication', async () => {
    const user = userEvent.setup();
    let resolveSignIn: (value: any) => void;
    const signInPromise = new Promise((resolve) => {
      resolveSignIn = resolve;
    });
    mockSignInWithLDAP.mockReturnValue(signInPromise);
    
    render(<LoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    await user.click(submitButton);
    
    // Should show loading spinner
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
    
    // Resolve the promise
    resolveSignIn!({ success: true });
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('disables form during loading', async () => {
    const user = userEvent.setup();
    let resolveSignIn: (value: any) => void;
    const signInPromise = new Promise((resolve) => {
      resolveSignIn = resolve;
    });
    mockSignInWithLDAP.mockReturnValue(signInPromise);
    
    render(<LoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    await user.click(submitButton);
    
    // Form fields should be disabled during loading
    expect(usernameInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
    
    resolveSignIn!({ success: true });
  });
});