import { Chip, Stack, Typography, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export const UserInfo = () => {
  const { ldapUser } = useAuth();

  if (!ldapUser) return null;

  const isAdmin = ldapUser.ldap_groups.includes('admins');
  const isValidator = ldapUser.ldap_groups.includes('validators');
  const isCreator = ldapUser.ldap_groups.includes('creators');

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
          {ldapUser.ldap_display_name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {ldapUser.ldap_username}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1}>
        {isAdmin && (
          <Chip 
            label="Admin" 
            color="error" 
            size="small" 
            variant="outlined"
          />
        )}
        {isValidator && (
          <Chip 
            label="Validator" 
            color="success" 
            size="small" 
            variant="outlined"
          />
        )}
        {isCreator && (
          <Chip 
            label="Creator" 
            color="primary" 
            size="small" 
            variant="outlined"
          />
        )}
      </Stack>
    </Box>
  );
};