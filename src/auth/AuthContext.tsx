import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AppUser, LearningMode } from '../types';

interface AuthResult { error?: string }
interface RegisterResult extends AuthResult { needsConfirmation?: boolean }

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, username: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// The redirect target for confirmation / reset emails (works on Pages subpath and locally).
const redirectTo = () => window.location.origin + window.location.pathname;

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Nieprawidłowy e-mail lub hasło.';
  if (m.includes('email not confirmed')) return 'Potwierdź e-mail (sprawdź skrzynkę) zanim się zalogujesz.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Konto z tym adresem e-mail już istnieje.';
  if (m.includes('password should be at least')) return 'Hasło musi mieć co najmniej 6 znaków.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Nieprawidłowy adres e-mail.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Zbyt wiele prób — odczekaj chwilę i spróbuj ponownie.';
  return message;
}

async function loadProfile(session: Session | null): Promise<AppUser | null> {
  if (!session?.user) return null;
  const authId = session.user.id;
  const email = session.user.email ?? '';
  const { data, error } = await supabase
    .from('profiles')
    .select('username, is_admin, status, daily_target, mode')
    .eq('id', authId)
    .single();

  if (error || !data) {
    // Profile may not be readable yet (e.g. trigger race right after signup).
    return {
      id: authId, email,
      username: email.split('@')[0] || 'użytkownik',
      isAdmin: false, status: 'pending', dailyTarget: 10, mode: 'balanced',
    };
  }
  return {
    id: authId, email,
    username: data.username ?? email.split('@')[0] ?? 'użytkownik',
    isAdmin: !!data.is_admin,
    status: (data.status === 'approved' ? 'approved' : 'pending'),
    dailyTarget: data.daily_target ?? 10,
    mode: (data.mode ?? 'balanced') as LearningMode,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(async (session: Session | null) => {
    setUser(await loadProfile(session));
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await applySession(data.session);
      setLoading(false);
    });
    // Defer DB work out of the callback (avoids the supabase-js auth lock deadlock).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { if (active) applySession(session); }, 0);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [applySession]);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: mapAuthError(error.message) } : {};
  }, []);

  const register = useCallback(async (email: string, username: string, password: string): Promise<RegisterResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() }, emailRedirectTo: redirectTo() },
    });
    if (error) return { error: mapAuthError(error.message) };
    return { needsConfirmation: !data.session }; // no session → email confirmation required
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() });
    return error ? { error: mapAuthError(error.message) } : {};
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
  }, [applySession]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
