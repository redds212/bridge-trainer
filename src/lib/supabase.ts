import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    'Brak konfiguracji Supabase. Ustaw VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY w .env.local (patrz .env.example).',
  );
}

/**
 * Klucz, pod którym supabase-js trzyma sesję w localStorage. Wartość identyczna z
 * domyślną biblioteki (zmiana wylogowałaby wszystkich) — podana jawnie tylko po to,
 * żeby wylogowanie bez sieci mogło usunąć sesję samo: `signOut()` przy wygasłym
 * tokenie i braku połączenia zwraca błąd i zostawia ją na dysku.
 */
export const AUTH_STORAGE_KEY = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handle email-confirm / password-reset redirect tokens
  },
});
