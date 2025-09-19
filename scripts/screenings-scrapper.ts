#!/usr/bin/env ts-node
/* eslint-disable no-console */
// @ts-ignore
import { JSDOM } from "jsdom";
import { writeFile } from "node:fs/promises";

// ==========================
// Config
// ==========================
const REPERTUAR_URL =
    process.env.REPERTUAR_URL ?? "https://festiwalgdynia.pl/program-50-fpff/harmonogram-50-fpff/";

// Domyślne „twarde” wartości, gdy nie uda się wyciągnąć roku/miesiąca z nagłówków
const DEFAULT_YEAR = 2025;
const DEFAULT_MONTH = 9;

// ==========================
// Helpers
// ==========================
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nowMs(): number {
    if (typeof process !== "undefined" && typeof process.hrtime === "function") {
        const [s, ns] = process.hrtime();     // s = sekundy, ns = nanosekundy
        return s * 1000 + ns / 1e6;
    }
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}

async function fetchHtml(url: string, retries = 3): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 15_000); // 15s timeout
        try {
            const res = await fetch(url, { redirect: "follow", signal: ac.signal });
            clearTimeout(t);
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
            return await res.text();
        } catch (e) {
            clearTimeout(t);
            lastErr = e;
            if (attempt < retries) {
                await sleep(300 * attempt);
                continue;
            }
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

const txt = (el: Element | null | undefined) =>
    (el?.textContent || "").trim().replace(/\s+/g, " ");

const safe = (s: unknown) => (s == null ? "" : String(s));

const pad2 = (n: number) => String(n).padStart(2, "0");

// część przeglądarkowych seansów bywa ukrywana przez `style="display: none"`
// w JSDOM nie ma prawdziwego getComputedStyle, więc sprawdzamy atrybut style
function isRowVisible(el: Element): boolean {
    const style = (el.getAttribute("style") || "").toLowerCase();
    if (style.includes("display: none") || style.includes("visibility: hidden")) {
        return false;
    }
    return true;
}

// wyciąga WSZYSTKIE liczby z klas pasujących do wzorca
function extractAllNumsFromClasses(classList: DOMTokenList, regex: RegExp): number[] {
    const out: number[] = [];
    for (const c of classList) {
        const m = c.match(regex);
        if (m && m[1]) out.push(Number(m[1]));
    }
    return out;
}

// wyciąga PIERWSZĄ liczbę z klas pasujących do wzorca
function extractOneNumFromClasses(classList: DOMTokenList, regex: RegExp): number | null {
    for (const c of classList) {
        const m = c.match(regex);
        if (m && m[1]) return Number(m[1]);
    }
    return null;
}

// polskie miesiące w dopełniaczu
const MONTHS_PL: Record<string, number> = {
    stycznia: 1,
    lutego: 2,
    marca: 3,
    kwietnia: 4,
    maja: 5,
    czerwca: 6,
    lipca: 7,
    sierpnia: 8,
    "września": 9,
    "wrzesnia": 9, // asekuracyjnie bez ogonka
    "października": 10,
    "pazdziernika": 10, // bez ogonka
    listopada: 11,
    grudnia: 12,
};

// "22 września 2025" → { y:2025, m:9, d:22 }
function parsePolishDateLine(s: string): { y: number; m: number; d: number } | null {
    const parts = s.toLowerCase().split(/\s+/);
    let d: number | null = null;
    let m: number | null = null;
    let y: number | null = null;
    for (const p of parts) {
        if (d == null && /^\d{1,2}$/.test(p)) d = parseInt(p, 10);
        if (m == null && MONTHS_PL[p]) m = MONTHS_PL[p];
        if (y == null && /^\d{4}$/.test(p)) y = parseInt(p, 10);
    }
    return d && m && y ? { y, m, d } : null;
}

// ==========================
// Typ wyniku
// ==========================
type ScreeningRecord = {
    movieIds: number | number[] | null; // 1 → number, pakiet → number[]
    movieTitles: string[];             // z <td class="title"> (wszystkie <a>)
    contestId: number | null;          // z item-type-####
    placeId: number | null;            // z item-location-####
    startsAt: string | null;      // ISO, np. "2025-09-22T09:15:00"
    accreditationNeeded: boolean | null; // true=no-ticket, false=has-ticket, null=nieustalone
};

// ==========================
// Parser strony repertuaru
// ==========================
function parseScreeningsFromDocument(doc: Document): ScreeningRecord[] {
    // 1) mapa dayNum -> pełny tekst daty
    const dayHeaders = Array.from(doc.querySelectorAll<HTMLTableRowElement>('tr.item-day-row[data-day]'))
        .filter((tr) => tr.querySelector(".day-title"));

    const dayMap = new Map<string, string>(
        dayHeaders.map((tr) => {
            const dayNum =
                tr.getAttribute("data-day") ||
                [...tr.classList].find((c) => /^item-day-\d+$/.test(c))?.split("-").pop() ||
                "";

            const dayText = txt(tr.querySelector(".day-title")) || dayNum || "";
            return [dayNum, dayText];
        })
    );

    // 2) wiersze seansów (widoczne)
    const allRows = Array.from(
        doc.querySelectorAll<HTMLTableRowElement>('tr[class*="item-id-"][class*="item-day-"]')
    );
    const movieRows = allRows.filter(isRowVisible);

    // 3) parsowanie każdego wiersza
    const records: ScreeningRecord[] = movieRows.map((row) => {
        const classes = [...row.classList];

        // --- Dzień ---
        const dayClass = classes.find((c) => /^item-day-\d+$/.test(c));
        const dayNum = dayClass ? dayClass.split("-").pop()! : "";
        const dayFull = safe(dayMap.get(dayNum) || dayNum);
        const parsedDay = parsePolishDateLine(dayFull); // {y,m,d} lub null

        // --- Godzina (+ walidacja z item-hour-HH:MM) ---
        const godzinaText = txt(row.querySelector("td.hour")); // np. "9:15"
        const hourClass = classes.find((c) => /^item-hour-\d{1,2}:\d{2}$/.test(c));
        const hourFromClass = hourClass ? hourClass.split("-").pop() : null;

        if (hourFromClass && godzinaText) {
            const mH = godzinaText.match(/^(\d{1,2}):(\d{1,2})$/);
            if (mH) {
                const normHH = pad2(parseInt(mH[1], 10));
                const normMM = pad2(parseInt(mH[2], 10));
                const normalized = `${normHH}:${normMM}`;
                if (normalized !== hourFromClass) {
                    console.warn("[scraper] Hour mismatch", {
                        td: normalized,
                        class: hourFromClass,
                    });
                }
            }
        }

        // --- ID filmu/filmów ---
        const idNums = extractAllNumsFromClasses(row.classList, /^item-id-m-(\d+)$/);
        const movieIds: ScreeningRecord["movieIds"] =
            idNums.length <= 1 ? (idNums[0] ?? null) : idNums.slice();

        // --- Konkurs/sekcja ---
        const contestId = extractOneNumFromClasses(row.classList, /^item-type-(\d+)$/);

        // --- Sala ---
        const placeId = extractOneNumFromClasses(row.classList, /^item-location-(\d+)$/);

        // --- Tytuły (wszystkie linki w komórce "title") ---
        const titleCell = row.querySelector("td.title");
        const links = Array.from(titleCell?.querySelectorAll<HTMLAnchorElement>("a[title], a") ?? []);
        const movieTitles = links
            .map((a) => (a.getAttribute("title") || a.textContent || "").trim())
            .filter(Boolean);

        // --- screeningDate (ISO bez strefy) ---
        let yyyy = DEFAULT_YEAR,
            mm = DEFAULT_MONTH,
            dd: number | null = dayNum ? Number(dayNum) : null;
        if (parsedDay) {
            yyyy = parsedDay.y;
            mm = parsedDay.m;
            dd = parsedDay.d;
        }

        let HH = 0,
            MM = 0;
        const mTime = godzinaText.match(/^(\d{1,2}):(\d{1,2})$/);
        if (mTime) {
            HH = parseInt(mTime[1], 10);
            MM = parseInt(mTime[2], 10);
        }

        const startsAt =
            dd != null
                ? `${yyyy}-${pad2(mm)}-${pad2(dd)}T${pad2(HH)}:${pad2(MM)}:00`
                : null;

        // --- accreditationNeeded ---
        //   - no-ticket  => true
        //   - has-ticket => false
        let accreditationNeeded: boolean | null = null;
        const reservationCell = row.querySelector("td.reservation");
        const resDiv = reservationCell?.querySelector<HTMLElement>("div.no-repeat");
        if (resDiv) {
            const cl = resDiv.classList;
            if (cl.contains("has-ticket")) accreditationNeeded = false;
            else if (cl.contains("no-ticket")) accreditationNeeded = true;
        }

        return {
            movieIds,
            movieTitles,
            contestId,
            placeId,
            startsAt,
            accreditationNeeded,
        };
    });

    return records;
}

// ==========================
// Main
// ==========================
async function main() {
    const t0 = nowMs();
    console.log("🔎 Fetching:", REPERTUAR_URL);

    const html = await fetchHtml(REPERTUAR_URL);
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const records = parseScreeningsFromDocument(doc);


    console.table(records.slice(0, 15));
    console.log("Total records:", records.length);

    const out = "../public/data/raw/screenings.json";
    await writeFile(out, JSON.stringify(records, null, 2) + "\n", "utf8");
    console.log("💾 Saved:", out);

    const t1 = nowMs();
    const elapsedMs = t1 - t0;
    console.log(`⏱️ Time: ${elapsedMs.toFixed(0)} ms (${(elapsedMs/1000).toFixed(2)} s)`);
}

main().catch((err) => {
    console.error("❌ Error:", err?.message || err);
    process.exit(1);
});
