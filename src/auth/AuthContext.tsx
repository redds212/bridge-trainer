import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, UserRole } from '../types';

const USERS_KEY = 'bridge-users';
const SESSION_KEY = 'bridge-session';

// Admin account is hardcoded — not stored in localStorage
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin1';
const ADMIN_USER: User = {
  id: 'admin',
  username: 'admin',
  passwordHash: '',
  role: 'admin',
  createdAt: '2024-01-01T00:00:00.000Z',
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function loadUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]');
  } catch { return []; }
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

interface AuthContextValue {
  user: User | null;
  login: (username: string, password: string) => Promise<'ok' | 'bad_credentials'>;
  logout: () => void;
  register: (username: string, password: string) => Promise<'ok' | 'taken'>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Restore session on mount
  useEffect(() => {
    const sessionId = loadSession();
    if (!sessionId) return;
    if (sessionId === 'admin') { setUser(ADMIN_USER); return; }
    const users = loadUsers();
    const found = users.find(u => u.id === sessionId);
    if (found) setUser(found);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<'ok' | 'bad_credentials'> => {
    // Check hardcoded admin
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      localStorage.setItem(SESSION_KEY, 'admin');
      setUser(ADMIN_USER);
      return 'ok';
    }
    // Check registered users
    const users = loadUsers();
    const found = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!found) return 'bad_credentials';
    const hash = await sha256(password);
    if (hash !== found.passwordHash) return 'bad_credentials';
    localStorage.setItem(SESSION_KEY, found.id);
    setUser(found);
    return 'ok';
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const register = useCallback(async (username: string, password: string): Promise<'ok' | 'taken'> => {
    if (username.toLowerCase() === ADMIN_USERNAME) return 'taken';
    const users = loadUsers();
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) return 'taken';
    const hash = await sha256(password);
    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      passwordHash: hash,
      role: 'user' as UserRole,
      createdAt: new Date().toISOString(),
    };
    saveUsers([...users, newUser]);
    localStorage.setItem(SESSION_KEY, newUser.id);
    setUser(newUser);
    return 'ok';
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
