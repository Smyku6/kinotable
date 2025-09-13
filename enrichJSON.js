#!/usr/bin/env node
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";

// === ŚCIEŻKI ===
const INPUT = path.resolve(process.cwd(), "seanse.json");
const OUTPUT_DEFAULT = path.resolve(process.cwd(), "public/movies.json");

// === FLAGI ===
// --in-place        -> zapis z powrotem do seanse.json (robi backup)
// --force           -> nadpisuje i section i runtimeMin
// --force-section   -> nadpisuje istniejące "section"
// --force-runtime   -> nadpisuje istniejące "runtimeMin"
const IN_PLACE = process.argv.includes("--in-place");
const FORCE = process.argv.includes("--force");
const FORCE_SECTION = FORCE || process.argv.includes("--force-section");
const FORCE_RUNTIME = FORCE || process.argv.includes("--force-runtime");

// === KONFIG A: sekcje -> tytuły (grupy) ===
/** @type {{ section: string; titles: string[] }[]} */
const TITLE_GROUPS = [
    {
        section: "Konkurs Główny",
        titles: [
            "Brat",
            "CAPO",
            "Chopin, Chopin!",
            "Dom dobry",
            "Franz Kafka",
            "Klarnet",
            "LARP. Miłość, trolle i inne questy",
            "Ministranci",
            "Nie ma duchów w mieszkaniu na Dobrej",
            "Światłoczuła",
            "Terytorium",
            "Trzy miłości",
            "Vinci 2",
            "Wielka Warszawska",
            "Zamach na papieża",
            "Życie dla początkujących",
        ],
    },
    {
        section: "Konkurs Perspektywy",
        titles: [
            "13 dni do wakacji",
            "Dziennik z wycieczki do Budapesztu",
            "Glorious Summer",
            "Las",
            "Północ Południe",
            "Przepiękne!",
            "To się nie dzieje",
            "Zaprawdę Hitler umarł"
        ],
    },
];

// === KONFIG B: czasy trwania (minuty) ===
// UZUPEŁNIAJ TU: tytuł -> runtime (w minutach)
// Przykłady, dopisz swoje pozycje:
const MOVIE_RUNTIMES = [
    { title: "Brat", runtime: 98 },                           // 1h38m
    { title: "CAPO", runtime: 83 },                           // 1h23m
    { title: "Chopin, Chopin!", runtime: 133 },               // 2h13m
    { title: "Dom dobry", runtime: 107 },                     // 1h47m
    { title: "Franz Kafka", runtime: 127 },                   // 2h07m
    { title: "Klarnet", runtime: 101 },                       // 1h41m
    { title: "LARP. Miłość, trolle i inne questy", runtime: 94 }, // 1h34m
    { title: "Ministranci", runtime: 110 },                   // 1h50m
    { title: "Nie ma duchów w mieszkaniu na Dobrej", runtime: 90 }, // 1h30m
    { title: "Światłoczuła", runtime: 93 },                   // 1h33m
    { title: "Terytorium", runtime: 97 },                     // 1h37m
    { title: "Trzy miłości", runtime: 100 },                  // 1h40m
    { title: "Vinci 2", runtime: 119 },                       // 1h59m
    { title: "Wielka Warszawska", runtime: 105 },             // 1h45m
    { title: "Zamach na papieża", runtime: 116 },             // 1h56m
    { title: "Życie dla początkujących", runtime: 76 },       // 1h16m
    { title: "SHORTSY", runtime: 75 },
];


// === NORMALIZACJA TYTUŁU (tolerancyjna) ===
const norm = (s) =>
    String(s ?? "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[.:,;!?'"’„”(){}\[\]-]/g, "")
        .replace(/\s+/g, " ")
        .trim();

// === INDEKSY ===
// tytuł -> sekcja
const SECTION_INDEX = new Map();
const duplicates = [];
for (const group of TITLE_GROUPS) {
    for (const t of group.titles) {
        const k = norm(t);
        if (SECTION_INDEX.has(k) && SECTION_INDEX.get(k) !== group.section) {
            duplicates.push({ title: t, a: SECTION_INDEX.get(k), b: group.section });
        }
        SECTION_INDEX.set(k, group.section);
    }
}
if (duplicates.length) {
    console.warn("⚠️ Tytuły przypisane do więcej niż jednej sekcji:");
    for (const d of duplicates) console.warn(` - "${d.title}" : ${d.a} ↔ ${d.b}`);
}

// tytuł -> runtimeMin
const RUNTIME_INDEX = new Map(MOVIE_RUNTIMES.map((x) => [norm(x.title), x.runtime]));

// === Wczytaj dane ===
if (!fs.existsSync(INPUT)) {
    console.error("❌ Nie znaleziono pliku:", INPUT);
    process.exit(1);
}
const raw = fs.readFileSync(INPUT, "utf8");
let data;
try {
    data = JSON.parse(raw);
} catch (e) {
    console.error("❌ Błąd parsowania JSON:", e?.message);
    process.exit(1);
}
if (!Array.isArray(data)) {
    console.error("❌ Oczekiwano tablicy w", INPUT);
    process.exit(1);
}

// === Wzbogacenie (section + runtimeMin) ===
let updatedSections = 0;
let updatedRuntimes = 0;

const enriched = data.map((item) => {
    const titleKey = norm(item?.tytul);

    // SECTION
    const newSection = SECTION_INDEX.get(titleKey);
    const hasSection = item?.section != null && item.section !== "";
    const section =
        newSection && (FORCE_SECTION || !hasSection) ? (updatedSections++, newSection) : item?.section ?? newSection ?? null;

    // RUNTIME
    const mappedRuntime = RUNTIME_INDEX.get(titleKey);
    const hasRuntime = Number.isFinite(item?.runtimeMin);
    const runtimeMin =
        Number.isFinite(mappedRuntime) && (FORCE_RUNTIME || !hasRuntime)
            ? (updatedRuntimes++, mappedRuntime)
            : hasRuntime
                ? item.runtimeMin
                : mappedRuntime ?? item?.runtimeMin ?? null;

    return { ...item, section, runtimeMin };
});

// === Raport braków ===
const uniqueTitles = [...new Set(data.map((x) => norm(x.tytul)))];

const notMappedSections = uniqueTitles
    .filter((k) => !SECTION_INDEX.has(k))
    .map((k) => data.find((x) => norm(x.tytul) === k)?.tytul)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

const notMappedRuntimes = uniqueTitles
    .filter((k) => !RUNTIME_INDEX.has(k))
    .map((k) => data.find((x) => norm(x.tytul) === k)?.tytul)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

console.log(`✅ Ustawiono 'section' dla ${updatedSections} / ${data.length} rekordów.`);
console.log(`✅ Ustawiono 'runtimeMin' dla ${updatedRuntimes} / ${data.length} rekordów.`);

if (notMappedSections.length) {
    console.log(`🔎 Brak sekcji dla (unikalne: ${notMappedSections.length}):`);
    console.log("   ", notMappedSections.slice(0, 20));
    if (notMappedSections.length > 20) console.log("   …i jeszcze", notMappedSections.length - 20, "więcej");
}

if (notMappedRuntimes.length) {
    console.log(`⏱️ Brak runtime dla (unikalne: ${notMappedRuntimes.length}):`);
    console.log("   ", notMappedRuntimes.slice(0, 20));
    if (notMappedRuntimes.length > 20) console.log("   …i jeszcze", notMappedRuntimes.length - 20, "więcej");
}

// === Zapis ===
const OUT = IN_PLACE ? INPUT : OUTPUT_DEFAULT;
if (IN_PLACE) {
    const backup = INPUT.replace(/\.json$/i, `.backup.${Date.now()}.json`);
    fs.writeFileSync(backup, raw, "utf8");
    console.log("💾 Backup oryginału:", backup);
}
fs.writeFileSync(OUT, JSON.stringify(enriched, null, 2) + "\n", "utf8");
console.log("📁 Zapisano do:", OUT);
