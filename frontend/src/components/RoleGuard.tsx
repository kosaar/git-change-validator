import { ReactNode } from 'react';
import { Alert, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
  fallback?: ReactNode;
  showError?: boolean;
}

export const RoleGuard = ({ 
  children, 
  allowedRoles, 
  fallback = null, 
  showError = false 
}: RoleGuardProps) => {
  const { ldapUser } = useAuth();

  if (!ldapUser) {
    return showError ? (
      <Alert severity="error">
        Authentication required
      </Alert>
    ) : fallback;
  }

  const hasAllowedRole = allowedRoles.some(role => 
    ldapUser.ldap_groups.includes(role)
  );

  if (!hasAllowedRole) {
    return showError ? (
      <Alert severity="warning">
        Access denied. Required roles: {allowedRoles.join(', ')}
      </Alert>
    ) : fallback;
  }

  return <>{children}</>;
};

interface AdminOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

export const AdminOnly = ({ children, fallback, showError }: AdminOnlyProps) => (
  <RoleGuard 
    allowedRoles={['admins']} 
    fallback={fallback} 
    showError={showError}
  >
    {children}
  </RoleGuard>
);

interface ValidatorOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

export const ValidatorOnly = ({ children, fallback, showError }: ValidatorOnlyProps) => (
  <RoleGuard 
    allowedRoles={['validators', 'admins']} 
    fallback={fallback} 
    showError={showError}
  >
    {children}
  </RoleGuard>
);

interface CreatorOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

export const CreatorOnly = ({ children, fallback, showError }: CreatorOnlyProps) => (
  <RoleGuard 
    allowedRoles={['creators', 'admins']} 
    fallback={fallback} 
    showError={showError}
  >
    {children}
  </RoleGuard>
);