#!/usr/bin/env node
/* eslint-disable no-console */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
// @ts-ignore
import { JSDOM } from "jsdom";
import {extractDirectorsListFromInfoBlock, parseRuntimeToMinutes} from "./movie-meta-scrapper.utils";
import {MovieOutput} from "./build-db.types";

// ===== Typy =====
type MovieInput = {
    id: number;
    originalTitle: string;
};



// ===== Konfiguracja =====
const INPUT = path.resolve(process.cwd(), "../public/data/raw/movie-list.json");
const OUTPUT = path.resolve(process.cwd(), "../public/data/raw/movies-meta.json");
const BASE = "https://festiwalgdynia.pl";

const CONCURRENCY = 25;   // ile naraz pobierać
const DELAY_MS = 0;    // pauza między batchami

const t0 = performance.now();

// ===== Utils =====
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: unknown) => String(s ?? "").replace(/\u00A0/g, " ").trim();


async function fetchHtml(url: string, retries = 3): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 10_000); // 10s timeout
        try {
            const res = await fetch(url, { redirect: "follow", signal: ac.signal });
            clearTimeout(t);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (e) {
            clearTimeout(t);
            if (attempt === retries) throw e;
            await sleep(300 * attempt); // krótki backoff
        }
    }
    throw new Error("Unreachable");
}


// ===== Scraper pojedynczego filmu =====
async function scrapeMovieMeta(id: number, originalTitle: string): Promise<{
    directors: string[] | null;
    year: number | null;
    runtimeMin: number | null;
    url: string;
}> {
    const url = `${BASE}/?p=${id}`;
    const html = await fetchHtml(url);
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const info = doc.querySelector(".content-box-text .item-info");

    const directors = extractDirectorsListFromInfoBlock(info, originalTitle, /* enableWarnings */ true);


    // Year
    const yearTxt = norm(info?.querySelector(".details-premiere")?.textContent || "");
    const year = (yearTxt.match(/\d{4}/) || [null])[0];
    const yearNum = year ? parseInt(year, 10) : null;

    // Runtime
    const timeTxt = norm(info?.querySelector(".details-time")?.textContent || "");
    const runtimeMin = parseRuntimeToMinutes(timeTxt, originalTitle);

    return { directors, year: yearNum, runtimeMin, url };
}

// ===== Main =====
async function main(): Promise<void> {
    // Wczytaj listę filmów
    const raw = await readFile(INPUT, "utf8");
    const movies: MovieInput[] = JSON.parse(raw).filter((m: any) => m?.id != null);

    console.log(`🔎 Do zebrania: ${movies.length} filmów`);

    const results: MovieOutput[] = [];
    let processed = 0;

    for (let i = 0; i < movies.length; i += CONCURRENCY) {
        const batch = movies.slice(i, i + CONCURRENCY);
        const done = await Promise.all(
            batch.map(async (m): Promise<MovieOutput> => {
                processed++;
                try {
                    const meta = await scrapeMovieMeta(m.id, m.originalTitle);
                    console.log(`✅ [${processed}/${movies.length}] ${m.originalTitle}`);
                    return {
                        id: m.id,
                        originalTitle: m.originalTitle,
                        directors: meta.directors,
                        year: meta.year,
                        runtimeMin: meta.runtimeMin,
                        url: meta.url
                    };
                } catch (err: any) {
                    console.warn(`⚠️ [${processed}/${movies.length}] ${m.originalTitle} – ${String(err?.message || err)}`);
                    return {
                        id: m.id,
                        originalTitle: m.originalTitle,
                        directors: null,
                        year: null,
                        runtimeMin: null,
                        url: `${BASE}/?p=${m.id}`,
                        error: String(err?.message || err)
                    };
                }
            })
        );
        results.push(...done);
        if (i + CONCURRENCY < movies.length) await sleep(DELAY_MS);
    }

    await writeFile(OUTPUT, JSON.stringify(results, null, 2) + "\n", "utf8");
    console.log("💾 Zapisano:", OUTPUT);
    const elapsedMs = performance.now() - t0;
    console.log(`⏱️ Czas całkowity: ${Math.round(elapsedMs)} ms (${(elapsedMs/1000).toFixed(2)} s)`);

    // Podgląd
    console.table(
        results.slice(0, 10).map((r) => ({
            id: r.id,
            tytul: r.originalTitle,
            rezyser: Array.isArray(r.directors) ? r.directors.join(" / ") : r.directors,
            rok: r.year,
            min: r.runtimeMin
        }))
    );
}

// uruchom
main().catch((e) => {

    console.error("❌ Błąd krytyczny:", e);
    process.exit(1);
});
