import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { supabase, AUTH_STORAGE_KEY } from '../lib/supabase';
import { isOfflineFailure } from '../lib/network';
import { cacheGet, cachePut, cacheClearUser, cacheKeys, requestPersistentStorage } from '../lib/localCache';
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
   *
   * Gdy telefon ma kopię profilu z ostatniego wejścia online, `user` jest tą kopią
   * (ze statusem `approved`) i aplikacja wpuszcza do przeglądania. Bez kopii `user`
   * to profil zastępczy ze statusem `pending` — wtedy zostaje ekran „brak sieci".
   */
  offline: boolean;
  /** Kiedy zapisano kopię profilu, z której korzysta tryb offline (ISO); poza offline `null`. */
  offlineSince: string | null;
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
 * Kto jest zalogowany na tym urządzeniu — pamiętane poza supabase-js. Po godzinie
 * bez sieci token dostępu wygasa, odświeżenie się nie udaje i `getSession()` zwraca
 * `session: null` z błędem sieci, choć sesja dalej leży w localStorage. Bez tego
 * zapisu aplikacja pokazałaby wtedy ekran logowania, którego offline nie da się przejść.
 */
const IDENTITY_KEY = 'bridgeloop.identity';

interface Identity { id: string; email: string }

function readIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.id === 'string' ? { id: v.id, email: typeof v.email === 'string' ? v.email : '' } : null;
  } catch {
    return null;
  }
}

function writeIdentity(identity: Identity | null) {
  try {
    if (identity) localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    else localStorage.removeItem(IDENTITY_KEY);
  } catch {
    // localStorage niedostępny — offline po prostu nie rozpozna użytkownika
  }
}

interface CachedProfile { user: AppUser; savedAt: string }

interface ProfileLoad {
  user: AppUser | null;
  offline: boolean;
  offlineSince: string | null;
}

/** Profil, gdy o koncie wiemy tylko, kto jest zalogowany — status `pending`, więc nikogo nie wpuści. */
function fallbackProfile({ id, email }: Identity): AppUser {
  return {
    id, email,
    username: email.split('@')[0] || 'użytkownik',
    isAdmin: false, status: 'pending', dailyTarget: DEFAULT_DAILY_TARGET, mode: 'balanced', timedMode: false,
  };
}

/**
 * Po tylu milisekundach bez odpowiedzi o sesji startujemy z kopii lokalnej. Przy
 * wygasłym tokenie i braku sieci supabase-js ponawia odświeżanie przez ok. 30 s,
 * zanim odda błąd — tyle trwałby ekran „Ładowanie…" po godzinie offline.
 */
const OFFLINE_START_DELAY_MS = 2500;

/** Profil z kopii lokalnej albo — gdy jej nie ma — zastępczy, który zatrzyma się na ekranie „brak sieci". */
async function offlineProfile(fallback: AppUser): Promise<ProfileLoad> {
  const cached = await cacheGet<CachedProfile>(cacheKeys.profile(fallback.id));
  return cached?.user?.status === 'approved'
    ? { user: cached.user, offline: true, offlineSince: cached.savedAt }
    : { user: fallback, offline: true, offlineSince: null };
}

/**
 * `hasSession: false` znaczy „wiemy, kto to, ale supabase-js nie ma ważnej sesji, bo
 * nie mógł jej odświeżyć bez sieci". Zapytanie o profil poszłoby wtedy jako anonimowe,
 * więc od razu sięgamy po kopię.
 */
async function loadProfile(identity: Identity | null, hasSession: boolean): Promise<ProfileLoad> {
  if (!identity) return { user: null, offline: false, offlineSince: null };
  const authId = identity.id;
  const email = identity.email;
  const fallback = fallbackProfile(identity);

  if (!hasSession) return offlineProfile(fallback);

  const { data, error } = await supabase
    .from('profiles')
    .select('username, is_admin, status, daily_target, mode, timed_mode')
    .eq('id', authId)
    .single();

  // Brak sieci: zwracamy zastępczy profil TYLKO po to, żeby aplikacja wiedziała,
  // kto jest zalogowany. O tym, co zobaczy użytkownik, decyduje flaga `offline`.
  if (isOfflineFailure(error)) return offlineProfile(fallback);

  if (error || !data) {
    // Profile may not be readable yet (e.g. trigger race right after signup).
    return { user: fallback, offline: false, offlineSince: null };
  }
  const user: AppUser = {
    id: authId, email,
    username: data.username ?? email.split('@')[0] ?? 'użytkownik',
    isAdmin: !!data.is_admin,
    status: (data.status === 'approved' ? 'approved' : 'pending'),
    dailyTarget: data.daily_target ?? DEFAULT_DAILY_TARGET,
    mode: (data.mode ?? 'balanced') as LearningMode,
    timedMode: data.timed_mode ?? false,
  };
  if (user.status === 'approved') {
    const cached: CachedProfile = { user, savedAt: new Date().toISOString() };
    void cachePut(cacheKeys.profile(authId), cached);
    requestPersistentStorage();
  } else {
    // Serwer potwierdził, że konto nie ma dostępu — kopia lokalna znika (O4).
    void cacheClearUser(authId);
  }
  return { user, offline: false, offlineSince: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(RECOVERY_LINK);

  /**
   * `unreachable`: sesji nie ma, bo nie dało się jej odświeżyć bez sieci — a nie dlatego,
   * że nikt nie jest zalogowany. Wtedy tożsamość bierzemy z własnego zapisu.
   */
  const applySession = useCallback(async (session: Session | null, unreachable = false) => {
    let identity: Identity | null = session?.user
      ? { id: session.user.id, email: session.user.email ?? '' }
      : null;
    if (identity) writeIdentity(identity);
    else if (unreachable) identity = readIdentity();

    const result = await loadProfile(identity, !!session);
    setUser(result.user);
    setOffline(result.offline);
    setOfflineSince(result.offlineSince);
  }, []);

  /** Bieżąca sesja z rozróżnieniem „nikt nie jest zalogowany" od „nie ma sieci, żeby to sprawdzić". */
  const syncSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    await applySession(data.session, !data.session && isAuthRetryableFetchError(error));
  }, [applySession]);

  useEffect(() => {
    let active = true;
    let settled = false;
    // Sesja się nie odzywa, a telefon ma kopię zalogowanego konta: wpuszczamy w tryb
    // offline od razu. Gdy `syncSession` w końcu odpowie, jej wynik i tak wygrywa.
    const earlyOffline = setTimeout(async () => {
      const identity = readIdentity();
      if (settled || !active || !identity) return;
      const cached = await offlineProfile(fallbackProfile(identity));
      if (settled || !active || !cached.offlineSince) return;
      setUser(cached.user);
      setOffline(true);
      setOfflineSince(cached.offlineSince);
      setLoading(false);
    }, OFFLINE_START_DELAY_MS);
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (active) await applySession(data.session, !data.session && isAuthRetryableFetchError(error));
      settled = true;
      clearTimeout(earlyOffline);
      if (active) setLoading(false);
    });
    // Defer DB work out of the callback (avoids the supabase-js auth lock deadlock).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Zwykłe `SIGNED_IN` gasi flagę, bo wygasły link resetu nie zakłada sesji:
      // użytkownik ląduje na logowaniu, a flaga odczytana z adresu zostaje zapalona
      // i po zalogowaniu starym hasłem wpychałaby go na ekran „ustaw nowe hasło".
      if (active && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
        setRecovery(event === 'PASSWORD_RECOVERY');
      }
      // Stan początkowy ustala `syncSession` wyżej. To zdarzenie niesie `null` zarówno
      // dla „nikt nie jest zalogowany", jak i dla „nie udało się odświeżyć tokenu bez
      // sieci" — nie da się ich tu odróżnić, a pomyłka wyrzucałaby offline na logowanie.
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') writeIdentity(null);
      setTimeout(() => { if (active) applySession(session); }, 0);
    });
    return () => { active = false; clearTimeout(earlyOffline); sub.subscription.unsubscribe(); };
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
    const id = user?.id;
    const dropLocalSession = () => {
      try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* brak localStorage */ }
    };
    if (offline) {
      // Bez sieci serwer i tak nie unieważni sesji, a `signOut` przy wygasłym tokenie
      // najpierw przez ok. 30 s ponawia jego odświeżanie i dopiero wtedy oddaje błąd —
      // sesji z dysku nie usuwając. Usuwamy ją więc sami, od razu.
      dropLocalSession();
    } else {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Sieć padła w trakcie: z tego urządzenia sesja ma zniknąć mimo wszystko,
        // inaczej po powrocie sieci użytkownik byłby z powrotem zalogowany.
        const local = await supabase.auth.signOut({ scope: 'local' });
        if (local.error) dropLocalSession();
      }
    }
    writeIdentity(null);
    if (id) await cacheClearUser(id);
    setUser(null);
    setOffline(false);
    setOfflineSince(null);
    // Bez tego rezygnacja z resetu zostawiałaby flagę zapaloną: kolejne logowanie
    // starym hasłem znowu lądowałoby na ekranie „ustaw nowe hasło".
    setRecovery(false);
  }, [user?.id, offline]);

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

  const refreshProfile = syncSession;

  // Powrót sieci sam ściąga profil — użytkownik nie musi klikać „Spróbuj ponownie".
  // iPhone nie zawsze zgłasza `online`, więc w trybie offline próbujemy też przy
  // każdym powrocie do aplikacji.
  useEffect(() => {
    const onOnline = () => { void refreshProfile(); };
    const onVisible = () => { if (offline && document.visibilityState === 'visible') void refreshProfile(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshProfile, offline]);

  return (
    <AuthContext.Provider value={{
      user, loading, offline, offlineSince, recovery,
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
