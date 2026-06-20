# Konfiguracja backendu (Supabase) — Etap 0

Przejdź te kroki w konsoli Supabase. Pliki, do których się odwołuję, są już w repo.
Na końcu prześlij mi **Project URL** i **anon public key** — wtedy ruszam z Etapem 1 (kod aplikacji).

---

## 1. Utwórz projekt
1. Wejdź na https://supabase.com → zaloguj się → **New project**.
2. Nazwa: `bridge-trainer`. Ustaw i **zapisz** hasło do bazy (Database Password).
3. Region: **Central EU (Frankfurt)** (najniższe opóźnienia z PL).
4. Plan: **Free**. Poczekaj ~2 min na provisioning.

## 2. Załóż schemat i dane
W lewym menu **SQL Editor → New query**:
1. Wklej całą zawartość [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) → **Run**.
2. Nowe query → wklej [`supabase/migrations/0002_seed_base_deals.sql`](../supabase/migrations/0002_seed_base_deals.sql) → **Run**.

Sprawdzenie: **Table Editor** → powinny być tabele `profiles`, `deals` (7 rozdań), `srs_progress`, `attempts`.

## 3. Skopiuj klucze API
**Project Settings → API**:
- **Project URL** → do mnie / do `.env.local`.
- **anon public** key → do mnie / do `.env.local` (publiczny, bezpieczny w buildzie).
- **service_role** key → ⚠️ TAJNY. Nie wysyłaj, nie wklejaj do kodu. Funkcja Edge bierze go automatycznie.

Lokalnie: skopiuj `.env.example` → `.env.local` i uzupełnij oba `VITE_*` (już w `.gitignore`).

## 4. Ustaw Auth
**Authentication → Sign In / Providers**: upewnij się, że **Email** jest włączony.

**Authentication → URL Configuration**:
- **Site URL**: `https://redds212.github.io/bridge-trainer/`
- **Redirect URLs** (Add URL): dodaj `https://redds212.github.io/bridge-trainer/` oraz `http://localhost:5174/`
  (potrzebne dla linków potwierdzenia e‑mail i resetu hasła).

Potwierdzanie e‑mail zostawiamy **włączone**. Domyślny mailer Supabase ma limity (~kilka maili/h) — wystarczy do testów; pod produkcję można później podpiąć własny SMTP.

## 5. Wdróż funkcję `delete-user`
Funkcja trwale usuwa konto (tylko admin). Kod: [`supabase/functions/delete-user/index.ts`](../supabase/functions/delete-user/index.ts).

**Najprościej — przez Dashboard:** **Edge Functions → Deploy a new function → via Editor**, nazwa `delete-user`, wklej kod, **Deploy**.
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` są wstrzykiwane automatycznie — nic nie konfigurujesz.

**Albo przez CLI:**
```bash
npx supabase login
npx supabase link --project-ref <TWÓJ-REF>
npx supabase functions deploy delete-user
```

## 6. Zrób siebie adminem (po Etapie 1)
Gdy aplikacja będzie już gadać z Supabase, zarejestruj swoje konto w apce (wpadnie jako `pending`), a potem w **SQL Editor**:
```sql
update public.profiles
   set is_admin = true, status = 'approved'
 where username = 'TWOJ_LOGIN';
```
Od tej pory akceptujesz i zarządzasz resztą kont z panelu admina.

---

## Co przysłać, żeby ruszyć z Etapem 1
- **Project URL** (np. `https://abcdxyz.supabase.co`)
- **anon public key**

Oba są publiczne (i tak znajdą się w zbudowanym JS) — danych pilnuje RLS, a nie tajność tych kluczy. **service_role** zostaje wyłącznie u Ciebie / w funkcji Edge.
