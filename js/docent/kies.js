// De docentmodus kiezen (DM-1): met een adres-toevoeging (docent.html?modus=docent) of met de keuze op de pagina zelf.
// Geen inloggen, geen account; er wordt niets bewaard over de keuze.
export const MODUS_DOCENT = 'docent';

/** Welke modus staat er in het adres? `zoek` is location.search. Geeft 'docent' of null. */
export function modusUitAdres(zoek) {
  return new URLSearchParams(zoek ?? '').get('modus') === MODUS_DOCENT ? MODUS_DOCENT : null;
}

/** Het adres na de keuze: dezelfde pagina met ?modus=docent, zodat het te bewaren en te delen is. */
export const docentAdres = (pad) => `${pad}?modus=${MODUS_DOCENT}`;
