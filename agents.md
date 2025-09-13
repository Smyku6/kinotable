# agents.md

> **Dokumentacja robocza** — podsumowanie całej rozmowy oraz uzgodnionych komponentów
> (scrapery, formaty danych, Next.js UI, pipeline). Wszystko w PL, z komentarzami i gotowymi
> snippetami.


## Spis treści
1. [Cel projektu](#cel-projektu)
2. [Struktury danych](#struktury-danych)
3. [Scraping w przeglądarce (snippety do konsoli)](#scraping-w-przegladarce-snippety-do-konsoli)
4. [Scraping w Node + TypeScript (jsdom)](#scraping-w-node--typescript-jsdom)
5. [Integracja z WordPress REST (WP JSON)](#integracja-z-wordpress-rest-wp-json)
6. [Aplikacja Next.js — timetable](#aplikacja-nextjs--timetable)
7. [Filtrowanie: dni, sekcje, podsekcje](#filtrowanie-dni-sekcje-podsekcje)
8. [Kolorystyka i style](#kolorystyka-i-style)
9. [Tooltipy i pakiety shortów](#tooltipy-i-pakiety-shortów)
10. [Runtime — parsowanie i nadpisy](#runtime--parsowanie-i-nadpisy)
11. [Pipeline danych](#pipeline-danych)
12. [FAQ / Troubleshooting](#faq--troubleshooting)


---

## Cel projektu
- Zeskrobać kompletny **repertuar** festiwalu z HTML, uzupełnić metadanymi i wizualizować w **Next.js** jako siatkę *sale × godziny*.
- Wspierać **pakiety** (np. krótkie metraże) oraz łączenie danych z **WordPress REST** (tytuły EN, opisy EN).
- Umożliwić szybki scraping **w przeglądarce** (ad hoc) oraz **headless** (Node + TS).


## Struktury danych

### 1) `Seans` (rekord z repertuaru)
```ts
type Seans = {
  screeningId: string;              // z klas item-id-… (np. "60391"); opcjonalnie bez prefiksu
  dzien: string;                    // np. "22 września 2025"
  godzina: string;                  // "HH:MM"
  salaKinowa: string;               // np. "GCF - Sala Warszawa"
  locationId: number | null;        // z klasy item-location-####
  reservationUrl?: string | null;   // link z kolumny „rezerwacja” (jeśli istnieje)

  // Nowy, docelowy model treści seansu:
  items: Array<{
    id: string;                 // slug z URL /filmy/<slug>/ lub wyprowadzony ze ścieżki
    title: string;                  // tytuł wyświetlany
    href: string;                   // URL do filmu
  }>;

  // Pola legacy (dla kompatybilności w trakcie migracji UI):
  tytul?: string;                   // dla 1 filmu → tytuł; dla pakietu → "SHORTSY" (lub nazwa pakietu)
  titles?: string[];                // dla pakietu → lista tytułów
  section?: string | null;          // „Konkurs Główny”, „KFK”, „Specjalne”… (z enhancerów)
  runtimeMin?: number;              // jeżeli znane
};
```

### 2) `locations.json` (unikalne sale)
```ts
type LocationRef = {
  locationId: number;
  location: string;   // opis z <td class="location">…</td>
};
```

### 3) `movies.json` (lista filmów do meta-scrapu)
```ts
type MovieListItem = { id: number; movieTitle: string };
```

### 4) `movies-meta.json` (wynik scrapa metadanych z podstron filmów)
```ts
type MovieMeta = {
  id: number;
  movieTitle: string;                // z wejścia lub z <title>/og:title, fallback
  directors: string | string[] | null;
  year: number | null;
  runtimeMin: number | null;
  url: string;
  englishMovieTitle?: string | null; // z WP JSON (tłumaczenie EN)
  englishDescription?: string | null;// z WP JSON (tłumaczenie EN)
  error?: string;                    // jeśli coś poszło nie tak
};
```


## Scraping w przeglądarce (snippety do konsoli)

### 1) Repertuar → `seanse.json` + `locations.json`
- Wykorzystuje <tr class="item-day-row">, <tr class*="item-id-"> i **klasy z ID lokacji** (`item-location-####`).
- Obsługuje **pakiety**: jeśli w komórce tytułu jest wiele `<a>`, to buduje `items[]`, a w legacy ustawia `tytul: "SHORTSY", titles: [...]`.
- Zapisuje dwa pliki przez `Blob` + „a[href] download”.

*(Pełny kod był dostarczony w wątku — patrz „wersja z items[] i locationId”.)*

### 2) Listy `<select>` → `movies.json`, `contests.json`, `locations.json`
- Z trzech selektorów `.select-box.filter-movie`, `.select-box.filter-contest`, `.select-box.filter-location-room`.
- Usuwa prefiks `m-`/`c-`/`l-` i zwraca **liczbowe** ID.
- Export 3 plików JSON.

### 3) Ekstrakcja tytułów z tabeli (unique)
- Z `td.title a[title]`, pomija wiersze z `display:none` (ukryte).


## Scraping w Node + TypeScript (jsdom)

### Setup
```json
// package.json (istotne fragmenty)
{
  "type": "module",
  "scripts": {
    "scrape": "tsx scrape-movies.ts"
  },
  "devDependencies": {
    "@types/node": "^22.x",
    "tsx": "^4.x",
    "typescript": "^5.x"
  },
  "dependencies": {
    "jsdom": "^24.x"
  }
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts"]
}
```

### Główne elementy skryptu
- **Pobór HTML** z timeoutem i retry:
  ```ts
  async function fetchHtml(url: string, retries = 3): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 10_000);
      try {
        const res = await fetch(url, { redirect: "follow", signal: ac.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      } catch (e) {
        clearTimeout(t);
        if (attempt === retries) throw e;
        await new Promise(r => setTimeout(r, 300 * attempt));
      }
    }
    throw new Error("Unreachable");
  }
  ```

- **Parser meta** (reżyserzy/rok/runtime) + **timer** całego przebiegu (hrtime):
  ```ts
  const t0 = process.hrtime.bigint();
  // ...scrape loop...
  const t1 = process.hrtime.bigint();
  const elapsedMs = Number((t1 - t0) / 1_000_000n);
  console.log(`⏱️ ${elapsedMs} ms (${(elapsedMs/1000).toFixed(2)} s)`);
  ```

- **Parser runtime** (wersja verbose + warningi):
  ```ts
  export function parseRuntimeToMinutes(text?: string): number | null { /* ... */ }
  ```

- **Ekstrakcja reżyserów** (sub-funkcja z ostrzeżeniami, zwraca `string[] | null`):
  ```ts
  export function extractDirectorsListFromInfoBlock(info: Element | null): string[] | null { /* ... */ }
  ```

- **Zakres po ID (bez movies.json)**:
    - CLI: `npm run scrape -- --from=5000 --to=6000`
    - albo env: `FROM=5000 TO=6000 npm run scrape`

- **WP JSON** wzbogacenie:
    - `GET /wp-json/wp/v2/filmy/{id}` — porównanie `title.rendered` z danym `originalTitle` (warning przy różnicy).
    - Jeśli `translations.en` istnieje: `GET /wp-json/wp/v2/filmy/{enId}` → `englishMovieTitle`, `englishDescription`.


## Integracja z WordPress REST (WP JSON)

- Endpoint bazowy: `https://festiwalgdynia.pl/wp-json/wp/v2/filmy/{id}`
- Schemat istotny dla nas:
  ```ts
  type WPFilm = {
    id: number;
    title?: { rendered?: string };
    content?: { rendered?: string };
    translations?: Record<string, number>; // np. { en: 12345 }
  };
  ```
- Procedura:
    1. Pobierz bazowy wpis (PL), porównaj `originalTitle` z `title.rendered` (po normalizacji).
    2. Jeżeli jest tłumaczenie EN (`translations.en`), pobierz i zapisz:
        - `englishMovieTitle = title.rendered`
        - `englishDescription = content.rendered`


## Aplikacja Next.js — timetable

- **Układ:** siatka `Sala × Oś czasu`. Kolumny to sloty minutowe (np. co 15/30 min), wiersze to sale. Kafelki zajmują `grid-column: start / span` proporcjonalnie do `runtimeMin`.
- **Kluczowe komponenty:**
    - `TimetableSpans` — render kafelków jako *spany* w CSS grid.
    - `DatePills` — wybór dnia w formie pigułek (z dniem tygodnia).
    - `SectionPills` — filtracje po sekcjach + rozwijane **podsekcje** po kliknięciu nadrzędnego pigułka.
- **Zasilanie danymi:** `public/movies.json` (lub `seanse.json`) wczytywane przez `fetch("/movies.json", { cache: "no-store" })`.
- **Zasada „stałe sale po lewej”:** lista sal pochodzi z pełnego zbioru lokacji (nie tylko z bieżącego filtra).


## Filtrowanie: dni, sekcje, podsekcje

- **Dni:** `DatePills` (z obliczaniem dnia tygodnia), ustawienie aktywnego dnia steruje filtrem.
- **Sekcje:** `SectionPills` (pigułki). Pusty wybór = wszystkie.
- **Podsekcje:** po kliknięciu sekcji „Specjalne” wyświetlają się **podpigułki**. Wybór podsekcji ogranicza wynik **do filmów z tej sekcji i tej podsekcji** (logika: sekcja musi być aktywna ORAZ dopasowanie podsekcji jeśli zaznaczona).


## Kolorystyka i style

- Paleta „onyx/coal/cream/gold” (ciemne tło, złote akcenty).
- **Sekcja → kolor**: funkcje pomocnicze w `styles/sectionStyles.ts`:
    - `getSectionPillStyles(sectionName)` — warianty `active/idle` dla pigułek.
    - `getSectionBlockStyles(sectionName)` — tła/obramowania dla kafelków filmów.
- Ta sama mapa kolorów używana **spójnie** w `SectionPills` i kafelkach w `TimetableSpans`.


## Tooltipy i pakiety shortów

- Jeśli `Seans.items.length > 1` (pakiet), kafelek ma `cursor-help` i **tooltip** z listą tytułów (`titles[]` / `items[].title`).
- Tooltip realizowany przez `group-hover` (Tailwind) + `position: absolute; top:100%; left:0` z przejściem `opacity/translate`.


## Runtime — parsowanie i nadpisy

- Parser `parseRuntimeToMinutes()` obsługuje warianty polskie i angielskie (`"1 godz. 20 min"`, `"1h20m"`, `"80 min"`, fallback `"80"`).
- **Log warnings** (opcjonalne) przy braku dopasowań, użyciu fallbacku, wyniku ≤ 0.
- Możliwość ręcznego nadpisania `runtimeMin` np. przez tabelę `MOVIE_RUNTIMES` lub w enrichment-scripcie (sekcje + runtime-y).


## Pipeline danych

1. **Konsola (przeglądarka)**  
   `repertuar → seanse.json` oraz `locations.json` *(IIFE — pobranie plików)*.
2. **Node/TS scraper**  
   `movies.json` (lub zakres ID) → `movies-meta.json` (reżyserzy/rok/runtime + WP EN).
3. **Enrichment**  
   Skrypt Node (CLI) nadpisujący/uzupełniający `section`, `runtimeMin` według map (`TITLE_GROUPS`, `MOVIE_RUNTIMES`).
4. **Next.js UI**  
   Wczytuje `public/movies.json` i renderuje timetable z filtrami.


## FAQ / Troubleshooting

- **Tailwind / PostCSS błąd:**  
  Zainstaluj `@tailwindcss/postcss` i skonfiguruj `postcss.config.js` zgodnie z komunikatem o „plugin moved”.

- **Pobieranie pliku z konsoli nie działa (clipboard/Blob):**  
  Upewnij się, że strona jest w **secure context** (https) i przeglądarka nie blokuje pobierania wyskakujących okien.

- **WP JSON zwraca błąd:**  
  Najczęściej `HTTP 404` dla nieistniejącego wpisu lub brak tłumaczenia EN — logujemy `warn` i kontynuujemy.

- **Zbyt wolny scraping Node:**  
  Podbij `CONCURRENCY` (np. 25) i wyłącz `DELAY_MS`. Dodany 10s timeout i `retries` ogarną sporadyczne zwisy.

- **Brak kafelków w sali (UI):**  
  Mechanizm pokazuje **wszystkie sale** po lewej. Jeśli w danym dniu i filtrze sala jest pusta, renderuje się wiersz bez kafelków (intencjonalnie).

---

> Masz pomysł na kolejne usprawnienia (np. automatyczny merge `movies-meta.json` z `seanse.json` w jeden spójny model czy eksport do ICS)? Dopiszemy w kolejnym kroku 😉
