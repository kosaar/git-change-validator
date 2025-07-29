import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../utils/test-utils';
import { RoleGuard, AdminOnly, ValidatorOnly, CreatorOnly } from '../../components/RoleGuard';
import '../mocks/supabase';

const TestComponent = () => <div>Protected Content</div>;

describe('RoleGuard', () => {
  it('renders children when user has allowed role', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: {
        ldap_groups: ['validators', 'users']
      }
    });

    render(
      <RoleGuard allowedRoles={['validators']}>
        <TestComponent />
      </RoleGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders fallback when user does not have allowed role', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: {
        ldap_groups: ['users']
      }
    });

    render(
      <RoleGuard allowedRoles={['validators']} fallback={<div>Access Denied</div>}>
        <TestComponent />
      </RoleGuard>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows error when showError is true and access denied', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: {
        ldap_groups: ['users']
      }
    });

    render(
      <RoleGuard allowedRoles={['validators']} showError>
        <TestComponent />
      </RoleGuard>
    );

    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(screen.getByText(/required roles: validators/i)).toBeInTheDocument();
  });

  it('renders nothing when user not authenticated and no fallback', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: null
    });

    render(
      <RoleGuard allowedRoles={['validators']}>
        <TestComponent />
      </RoleGuard>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows authentication error when showError is true and not authenticated', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: null
    });

    render(
      <RoleGuard allowedRoles={['validators']} showError>
        <TestComponent />
      </RoleGuard>
    );

    expect(screen.getByText('Authentication required')).toBeInTheDocument();
  });
});

describe('AdminOnly', () => {
  it('allows admins access', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: {
        ldap_groups: ['admins']
      }
    });

    render(
      <AdminOnly>
        <TestComponent />
      </AdminOnly>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('denies non-admin access', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: {
        ldap_groups: ['users']
      }
    });

    render(
      <AdminOnly>
        <TestComponent />
      </AdminOnly>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

describe('ValidatorOnly', () => {
  it('allows validators access', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: {
        ldap_groups: ['validators']
      }
    });

    render(
      <ValidatorOnly>
        <TestComponent />
      </ValidatorOnly>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('allows admins access', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: {
        ldap_groups: ['admins']
      }
    });

    render(
      <ValidatorOnly>
        <TestComponent />
      </ValidatorOnly>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('denies regular users access', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: {
        ldap_groups: ['users']
      }
    });

    render(
      <ValidatorOnly>
        <TestComponent />
      </ValidatorOnly>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

describe('CreatorOnly', () => {
  it('allows creators access', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: {
        ldap_groups: ['creators']
      }
    });

    render(
      <CreatorOnly>
        <TestComponent />
      </CreatorOnly>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('allows admins access', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: {
        ldap_groups: ['admins']
      }
    });

    render(
      <CreatorOnly>
        <TestComponent />
      </CreatorOnly>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('denies regular users access', () => {
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      ldapUser: {
        ldap_groups: ['users']
      }
    });

    render(
      <CreatorOnly>
        <TestComponent />
      </CreatorOnly>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

// Mock the useAuth hook for all tests
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));