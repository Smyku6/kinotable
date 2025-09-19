import {ScreeningData} from "./types";
// @ts-ignore
import { JSDOM } from 'jsdom';
import { mkdir, readFile, writeFile } from 'fs/promises';
import * as path from 'path';

/** ===== ŚCIEŻKI W PROJEKCIE =====
 * Zmienisz je pod swój layout repo.
 * RELATIVE – ścieżki względem katalogu uruchomienia (process.cwd()).
 */
export const INPUT_HTML_RELATIVE = '../../sites-copy/Festiwal Polskich Filmów Fabularnych w Gdyni.html';
export const OUTPUT_JSON_RELATIVE = 'screenings-tickets.json';

/** ===== STRICT LOCATION MAP =====
 * Twarda mapa "<place> <room>" → locationName.
 * Jeśli brakuje wpisu, rzucamy błąd.
 * UZUPEŁNISZ JĄ RĘCZNIE wg swoich danych.
 */
export type LocationMap = Record<string, string>;

/** Normalizacja klucza: przytnij i zredukuj wielokrotne spacje do pojedynczej */
export function buildLocationKey(place: string, room: string): string {
    const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
    return `${norm(place)} ${norm(room)}`;
}

/** Przykładowy wpis – dopisuj kolejne linie niżej */
export const LOCATION_MAP: LocationMap = {
    'KH SALA 1': 'Helios - Sala 1',
    'KH SALA 2': 'Helios - Sala 2',
    'KH SALA 3': 'Helios - Sala 3',
    'KH SALA 4': 'Helios - Sala 4',
    'KH SALA 5': 'Helios - Sala 5',
    'KH SALA 6': 'Helios - Sala 6',
    'KH SALA DREAM 7': 'Helios - Sala Dream 7',
    'KH SALA DREAM 8': 'Helios - Sala Dream 8',
    'GCF GOPLANA': 'GCF - Sala Goplana',
    'GCF MORSKIE OKO': 'GCF - Sala Morskie Oko',
    'GCF WARSZAWA': 'GCF - Sala Warszawa',
    'TM SCENA NOWA': 'Teatr Muzyczny - Nowa Scena',
    'TM SCENA KAMERALNA': 'Teatr Muzyczny - Scena Kameralna',
    'IWG TEATR MIEJSKI': 'Teatr Miejski im. Witolda Gombrowicza',
};

/** Helper: zlepia date + time do lokalnego ISO bez strefy (YYYY-MM-DDTHH:mm) */
export function buildStartsAt(date: string, time: string): string {
    const d = (date ?? '').trim();
    const t = (time ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(t)) {
        throw new Error(`Nieprawidłowe date/time: date="${date}", time="${time}"`);
    }
    return `${d}T${t}`;
}

type ScreeningEnriched = ScreeningData & {
    locationName: string;
    startsAt: string; // YYYY-MM-DDTHH:mm
};
/** Dokłada locationName z mapy. Brak klucza → błąd. */
export function attachStrictLocationName<T extends ScreeningData>(
    screenings: T[],
    map: LocationMap = LOCATION_MAP
): ScreeningEnriched[] {
    return screenings.map((s) => {
        const key = buildLocationKey(s.place, s.room);
        const locationName = map[key];
        if (!locationName) {
            const known = Object.keys(map).slice(0, 15).join(' | ');
            throw new Error(
                `Brak wpisu w LOCATION_MAP dla klucza "${key}". ` +
                `Dodaj go do mapy (LOCATION_MAP). Przykładowe istniejące: ${known || '— mapa pusta —'}`
            );
        }
        const startsAt = buildStartsAt(s.date, s.time);
        return { ...s, locationName, startsAt  };
    });
}

/** Extract using generic DOM root (works with JSDOM's document) */
export function extractScreeningsFromRoot(root: Document | ParentNode): ScreeningData[] {
    const nodes = Array.from(
        (root as Document).querySelectorAll?.('div.add-to-cart-btn.video-content') ??
        (root as ParentNode).querySelectorAll?.('div.add-to-cart-btn.video-content') ??
        []
    );

    const toClean = (v: string | null | undefined) => (v ?? '').trim();

    return nodes.map((el) => {
        const div = el as HTMLElement;
        const screeningId = toClean(div.getAttribute('data-screening'));
        const title = toClean(div.getAttribute('data-title'));
        const date = toClean(div.getAttribute('data-date'));
        const time = toClean(div.getAttribute('data-time'));
        const room = toClean(div.getAttribute('data-sala'));
        const place = toClean(div.getAttribute('data-miejsce'));

        return { screeningId, title, date, time, room, place };
    }).filter(s => s.screeningId && s.title && s.date && s.time); // simple validation
}

/** Parse from raw HTML (string) using JSDOM */
export function extractScreeningsFromHtml(html: string): ScreeningData[] {
    const dom = new JSDOM(html);
    return extractScreeningsFromRoot(dom.window.document);
}

/** Save JSON to file (generic array) */
export async function saveScreeningsJson<T extends object>(
    data: T[],
    outputPathRel: string = OUTPUT_JSON_RELATIVE
) {
    const outAbs = path.resolve(process.cwd(), outputPathRel);
    await mkdir(path.dirname(outAbs), { recursive: true });
    await writeFile(outAbs, JSON.stringify(data, null, 2), 'utf8');
    return outAbs;
}

/** End-to-end: read HTML file → extract → attach locationName → save JSON */
export async function extractFromHtmlFileAndSave(
    inputPathRel: string = INPUT_HTML_RELATIVE,
    outputPathRel: string = OUTPUT_JSON_RELATIVE
) {
    const inAbs = path.resolve(process.cwd(), inputPathRel);
    const html = await readFile(inAbs, 'utf8');

    // 1) surowe dane z HTML
    const data = extractScreeningsFromHtml(html);

    // 2) dołóż locationName wg twardej mapy (rzuci błąd, jeśli czegoś brakuje)
    const enriched = attachStrictLocationName(data, LOCATION_MAP);

    // 3) zapisz efekt
    return await saveScreeningsJson(enriched, outputPathRel);
}
