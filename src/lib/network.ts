/**
 * Odróżnia „zapytanie nie doleciało" od „baza odpowiedziała błędem".
 * supabase-js opakowuje błąd fetcha w PostgrestError, więc zostaje treść komunikatu;
 * każda przeglądarka nazywa to inaczej.
 */
export function isNetworkError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('failed to fetch')  // Chrome / Edge
    || m.includes('load failed')        // Safari
    || m.includes('networkerror')       // Firefox
    || m.includes('fetch failed');
}

/**
 * Czy błąd zapytania znaczy „nie ma sieci". `navigator.onLine` bywa na iPhonie
 * optymistyczne (słabe Wi-Fi zgłasza się jako online), więc rozstrzyga treść błędu,
 * a flaga przeglądarki tylko dokłada przypadki, gdy sama przyznaje się do braku sieci.
 */
export function isOfflineFailure(error: { message: string } | null | undefined): boolean {
  if (!error) return false;
  return isNetworkError(error.message) || (typeof navigator !== 'undefined' && navigator.onLine === false);
}
