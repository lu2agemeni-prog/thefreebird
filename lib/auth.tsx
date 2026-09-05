'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';

type Role = 'manager' | 'doctor' | 'patient' | 'secretary' | 'accountant' | null;

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  role: Role;
  avatar_url?: string;
  phone?: string;
  patient_code?: string;
  email?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async (session: Session) => {
      // First attempt to fetch the profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setUser({ ...data, email: session.user.email });
      } else {
        // Fallback: If the trigger failed completely and there's no profile,
        // we can attempt to insert one directly from the client side as a last resort,
        // or just set a temporary in-memory user so they aren't blocked.
        console.warn('Profile not found for user. Assuming trigger failed, using fallback.');
        
        // Attempt manual insert as fallback (might fail due to RLS, but worth a shot)
        try {
           const { error: insertError } = await supabase.from('profiles').insert([
             { 
               id: session.user.id, 
               first_name: session.user.user_metadata?.full_name?.split(' ')[0] || 'مستخدم', 
               last_name: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 'جديد',
               role: 'patient',
               avatar_url: session.user.user_metadata?.avatar_url
             }
           ]);
           if (insertError) {
             console.error("Fallback insert Supabase error:", insertError);
           }
        } catch(e) {
           console.error("Fallback insert failed Exception:", e);
        }

        setUser({
          id: session.user.id,
          first_name: session.user.user_metadata?.full_name?.split(' ')[0] || 'مستخدم',
          last_name: session.user.user_metadata?.full_name?.split(' ')[1] || 'جديد',
          role: 'patient', // Default role
          email: session.user.email,
          avatar_url: session.user.user_metadata?.avatar_url
        });
      }
      setLoading(false);
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    // In AI Studio, we need to ensure we redirect back to the Cloud Run URL
    // rather than localhost (which might be the internal container origin in some setups)
    const redirectUrl = process.env.APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      }
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
