import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { LdapUser } from '../types/database';

interface AuthContextType {
  user: User | null;
  ldapUser: LdapUser | null;
  loading: boolean;
  signInWithLDAP: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [ldapUser, setLdapUser] = useState<LdapUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data } = await supabase
          .from('ldap_users')
          .select('*')
          .eq('supabase_user_id', session.user.id)
          .single();
        setLdapUser(data);
      }
      
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data } = await supabase
          .from('ldap_users')
          .select('*')
          .eq('supabase_user_id', session.user.id)
          .single();
        setLdapUser(data);
      } else {
        setLdapUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithLDAP = async (username: string, password: string) => {
    try {
      const response = await supabase.functions.invoke('ldap-auth', {
        body: { username, password }
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      if (response.data?.success && response.data?.session) {
        const { data, error } = await supabase.auth.setSession(response.data.session);
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      }

      return { success: false, error: 'Authentication failed' };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    ldapUser,
    loading,
    signInWithLDAP,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};