import { useState, useEffect } from 'react';
import { todayKey } from '../lib/date';

/**
 * Klucz dnia lokalnego, który sam przełamuje się o północy.
 *
 * Bez niego „dziś" zamarza na dniu, w którym otwarto kartę: kolejka liczy się
 * z `todayKey()` w momencie przeliczenia memo, a o 00:00 żadna zależność się nie
 * zmienia — aplikacja trzymana otwartą przez noc pokazywałaby wczorajszy zestaw.
 *
 * Sam timer nie wystarcza. W karcie w tle przeglądarka go dławi, a uśpione
 * urządzenie przeskakuje całą noc bez jednego tiku, więc dobę sprawdzamy również
 * przy powrocie do karty i przy odzyskaniu focusu — czyli zawsze wtedy, gdy
 * użytkownik faktycznie patrzy na listę.
 */
export function useDayKey(): string {
  const [day, setDay] = useState(() => todayKey());

  useEffect(() => {
    let timer = 0;

    // Klucz wraca ten sam obiekt, gdy doba się nie zmieniła — React przerywa
    // wtedy renderowanie, więc przebudzenia karty nic nie kosztują.
    const sync = () => setDay(prev => { const now = todayKey(); return now === prev ? prev : now; });

    const arm = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      // +1 s zapasu: `setTimeout` budzi się czasem ułamek przed terminem, a wtedy
      // `todayKey()` oddałby jeszcze wczorajszą datę i przełom przepadłby do rana.
      timer = window.setTimeout(() => { sync(); arm(); }, midnight.getTime() - now.getTime() + 1000);
    };

    const onWake = () => { sync(); window.clearTimeout(timer); arm(); };

    arm();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, []);

  return day;
}
