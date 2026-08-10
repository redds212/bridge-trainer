import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { DEFAULT_DAILY_TARGET } from '../lib/session';
import type { AppUser, LearningMode } from '../types';

interface AuthResult { error?: string }
interface RegisterResult extends AuthResult { needsConfirmation?: boolean }

/** Tyle samo wymaga Supabase w domyślnej konfiguracji — walidujemy lokalnie, żeby nie strzelać do API po nic. */
export const MIN_PASSWORD_LENGTH = 6;

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  /**
   * Sesja jest ważna (leży w localStorage), ale profilu nie dało się pobrać, bo
   * nie ma sieci. Stan zupełnie inny niż „konto czeka na akceptację" — bez tego
   * rozróżnienia offline wyglądał jak odebranie dostępu.
   */
  offline: boolean;
  /**
   * Wejście z linku „resetuj hasło". Supabase zakłada sesję już przy kliknięciu
   * linku, więc bez tej flagi użytkownik po prostu wchodził do aplikacji — dalej
   * ze starym hasłem, bo nikt go nigdy o nowe nie zapytał.
   */
  recovery: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, username: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  /** Ustawia hasło w bieżącej sesji — ścieżka z linku resetu, bez pytania o stare. */
  setNewPassword: (password: string) => Promise<AuthResult>;
  /** Zmiana z poziomu zalogowanego konta — ze sprawdzeniem obecnego hasła. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  /** Zamyka tryb odzyskiwania po ustawieniu hasła (albo przy wylogowaniu). */
  endRecovery: () => void;
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
  if (m.includes('password should be at least')) return `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`;
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Nieprawidłowy adres e-mail.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Zbyt wiele prób — odczekaj chwilę i spróbuj ponownie.';
  if (m.includes('different from the old password')) return 'Nowe hasło musi się różnić od obecnego.';
  if (m.includes('auth session missing') || m.includes('session_not_found') || m.includes('session from session_id claim'))
    return 'Sesja wygasła — zaloguj się ponownie.';
  return message;
}

/**
 * Zdarzenie `PASSWORD_RECOVERY` leci przez `setTimeout`, więc nasłuch z efektu
 * Reacta normalnie zdąży się podpiąć. Normalnie — a przegapienie go znaczy ciche
 * wpuszczenie użytkownika do aplikacji ze starym hasłem, więc typ linku czytamy
 * dodatkowo sami, synchronicznie przy starcie modułu: supabase-js kasuje hash
 * zaraz po sparsowaniu, ale robi to dopiero po pierwszym `await`.
 */
const RECOVERY_LINK =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery';

/**
 * Odróżnia „zapytanie nie doleciało" od „baza odpowiedziała, ale bez wiersza".
 * supabase-js opakowuje błąd fetcha w PostgrestError, więc zostaje treść komunikatu;
 * każda przeglądarka nazywa to inaczej.
 */
function isNetworkError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('failed to fetch')  // Chrome / Edge
    || m.includes('load failed')        // Safari
    || m.includes('networkerror')       // Firefox
    || m.includes('fetch failed');
}

interface ProfileLoad {
  user: AppUser | null;
  offline: boolean;
}

async function loadProfile(session: Session | null): Promise<ProfileLoad> {
  if (!session?.user) return { user: null, offline: false };
  const authId = session.user.id;
  const email = session.user.email ?? '';
  const fallback: AppUser = {
    id: authId, email,
    username: email.split('@')[0] || 'użytkownik',
    isAdmin: false, status: 'pending', dailyTarget: DEFAULT_DAILY_TARGET, mode: 'balanced', timedMode: false,
  };

  const { data, error } = await supabase
    .from('profiles')
    .select('username, is_admin, status, daily_target, mode, timed_mode')
    .eq('id', authId)
    .single();

  // Brak sieci: zwracamy zastępczy profil TYLKO po to, żeby aplikacja wiedziała,
  // kto jest zalogowany. O tym, co zobaczy użytkownik, decyduje flaga `offline`.
  if (error && (!navigator.onLine || isNetworkError(error.message))) {
    return { user: fallback, offline: true };
  }

  if (error || !data) {
    // Profile may not be readable yet (e.g. trigger race right after signup).
    return { user: fallback, offline: false };
  }
  return {
    user: {
      id: authId, email,
      username: data.username ?? email.split('@')[0] ?? 'użytkownik',
      isAdmin: !!data.is_admin,
      status: (data.status === 'approved' ? 'approved' : 'pending'),
      dailyTarget: data.daily_target ?? DEFAULT_DAILY_TARGET,
      mode: (data.mode ?? 'balanced') as LearningMode,
      timedMode: data.timed_mode ?? false,
    },
    offline: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [recovery, setRecovery] = useState(RECOVERY_LINK);

  const applySession = useCallback(async (session: Session | null) => {
    const { user: profile, offline: isOffline } = await loadProfile(session);
    setUser(profile);
    setOffline(isOffline);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await applySession(data.session);
      setLoading(false);
    });
    // Defer DB work out of the callback (avoids the supabase-js auth lock deadlock).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Zwykłe `SIGNED_IN` gasi flagę, bo wygasły link resetu nie zakłada sesji:
      // użytkownik ląduje na logowaniu, a flaga odczytana z adresu zostaje zapalona
      // i po zalogowaniu starym hasłem wpychałaby go na ekran „ustaw nowe hasło".
      if (active && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
        setRecovery(event === 'PASSWORD_RECOVERY');
      }
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
    // Bez tego rezygnacja z resetu zostawiałaby flagę zapaloną: kolejne logowanie
    // starym hasłem znowu lądowałoby na ekranie „ustaw nowe hasło".
    setRecovery(false);
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() });
    return error ? { error: mapAuthError(error.message) } : {};
  }, []);

  const setNewPassword = useCallback(async (password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { error: mapAuthError(error.message) } : {};
  }, []);

  const endRecovery = useCallback(() => setRecovery(false), []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
      const email = user?.email;
      if (!email) return { error: 'Sesja wygasła — zaloguj się ponownie.' };
      // Supabase nie pyta o stare hasło przy `updateUser`, więc pytamy sami: inaczej
      // cudza sesja porzucona na wspólnym komputerze wystarcza do przejęcia konta.
      const { error: reauth } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (reauth) {
        return {
          error: reauth.message.toLowerCase().includes('invalid login credentials')
            ? 'Obecne hasło jest nieprawidłowe.'
            : mapAuthError(reauth.message),
        };
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return error ? { error: mapAuthError(error.message) } : {};
    },
    [user?.email],
  );

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
  }, [applySession]);

  // Powrót sieci sam ściąga profil — użytkownik nie musi klikać „Spróbuj ponownie".
  useEffect(() => {
    const onOnline = () => { void refreshProfile(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refreshProfile]);

  return (
    <AuthContext.Provider value={{
      user, loading, offline, recovery,
      login, register, logout,
      resetPassword, setNewPassword, changePassword, endRecovery,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
