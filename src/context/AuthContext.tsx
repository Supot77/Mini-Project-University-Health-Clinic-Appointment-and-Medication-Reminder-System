'use client';

import React, { createContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { AuthSession } from '@/types/auth';
import type { UserRole } from '@/types/database';

const supabase = createClient();

interface AuthContextType extends AuthSession {
  signOut: () => Promise<void>;
  role: UserRole | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session: supabaseSession } } = await supabase.auth.getSession();
        
        if (supabaseSession?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', supabaseSession.user.id)
            .single();

          if (profile) {
            setSession({
              user: {
                id: profile.id,
                email: supabaseSession.user.email!,
                role: profile.role,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
              },
              isLoading: false,
              isAuthenticated: true,
            });
            return;
          }
        }
      } catch (error) {
        console.error('Error fetching auth session:', error);
      }
      
      setSession({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (currentSession?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single();
          
        if (profile) {
          setSession({
            user: {
              id: profile.id,
              email: currentSession.user.email!,
              role: profile.role,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
            },
            isLoading: false,
            isAuthenticated: true,
          });
        }
      } else {
        setSession({ user: null, isLoading: false, isAuthenticated: false });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during signOut:', error);
    } finally {
      setSession({ user: null, isLoading: false, isAuthenticated: false });
      router.push('/');
      router.refresh();
    }
  };

  return (
    <AuthContext.Provider value={{ ...session, signOut, role: session.user?.role || null }}>
      {children}
    </AuthContext.Provider>
  );
}
