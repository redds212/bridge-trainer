import type { Deal, Difficulty } from '../types';
import type { DealRecord } from '../hooks/useDeals';
import { AdminPanel } from '../admin/AdminPanel';
import mockDeals from '../data/dealsMock.json';

/**
 * Dev-only harness: montuje panel admina (zakładka „Rozdania") na syntetycznej
 * bazie, bez logowania i bez konta z uprawnieniami — żeby dało się iterować nad
 * wyszukiwarką i tabelą, i robić zrzuty. Wchodzi przez `?preview=admin` w trybie
 * dev; produkcyjny build nie importuje tego pliku (dynamiczny import w main.tsx).
 *
 * Zakładki „Użytkownicy" i „Zgłoszenia" chodzą do Supabase — tutaj są puste, bo
 * montują się dopiero po kliknięciu. Operacje zapisu to no-opy zwracające sukces.
 */

const CATEGORIES = ['Wistowanie', 'Rozgrywka', 'Licytacja'];
const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Expert'];
const MOTIFS = ['wyciąganie atutów', 'impas', 'przebitka', 'wistowanie w bezatu'];

const base = mockDeals as unknown as Deal[];
const deals: DealRecord[] = Array.from({ length: 14 }, (_, i) => ({
  ...base[i % base.length],
  id: `d4e1a${String(i).padStart(3, '0')}-preview-${i}`,
  title: `Rozdanie ${101 + i} — ${MOTIFS[i % MOTIFS.length]}`,
  category: CATEGORIES[i % CATEGORIES.length],
  difficulty: DIFFICULTIES[i % DIFFICULTIES.length],
  isBase: i % 3 === 0,
  archived: i % 7 === 6,
  createdAt: new Date(Date.UTC(2026, 6, 1 + i)).toISOString(),
  cardSignature: null,
}));

const ok = async () => ({});

export function AdminPreview() {
  return (
    <AdminPanel
      allDeals={deals}
      loading={false}
      error={null}
      onAdd={ok}
      onAddMany={async () => ({ ok: 0, failures: [] })}
      onBackfill={async () => ({ updated: 0, exempt: 0 })}
      onUpdate={ok}
      onArchive={ok}
      onRestore={ok}
      onDelete={ok}
      onBack={() => {}}
    />
  );
}
