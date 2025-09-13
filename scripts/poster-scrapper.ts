/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { promises as fsp } from "node:fs";
import puppeteer, { Browser } from "puppeteer";
import axios from "axios";

/**
 * CLI:
 *  --force         overwrite existing files
 *  --limit=N       concurrency (default 3)
 *  --timeout=ms    per-movie timeout (default 30000)
 */

type MovieMeta = {
    id: number;
    originalTitle: string;
    directors?: string | string[] | null;
    year?: number | null;
    runtimeMin?: number | null;
    url?: string;
};

const INPUT = path.resolve(process.cwd(), "../public/data/raw/movies-meta.json");
const OUT_DIR = path.resolve(process.cwd(), "public/data/posters");
const FORCE = process.argv.includes("--force");

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1]!, 10)) : 3;

const timeoutArg = process.argv.find((a) => a.startsWith("--timeout="));
const PER_MOVIE_TIMEOUT = timeoutArg ? Math.max(5000, parseInt(timeoutArg.split("=")[1]!, 10)) : 30_000;

const STEP_DELAY_MS = 200;

const FILMWEB_SEARCH = (q: string) =>
    `https://www.filmweb.pl/search#/all?query=${encodeURIComponent(q)}`;

function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

async function ensureDir(dir: string) {
    await fsp.mkdir(dir, { recursive: true });
}

function norm(s: string) {
    return s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}
function stripPunct(s: string) {
    return s.replace(/[.,;:!?"'’„”(){}\[\]\-_/]/g, "");
}
function titlesEqual(a: string, b: string) {
    return stripPunct(norm(a)) === stripPunct(norm(b));
}
function toArray<T>(x: T | T[] | null | undefined): T[] {
    if (x == null) return [];
    return Array.isArray(x) ? x : [x];
}
function pickExtension(url: string, contentType?: string): string {
    try {
        const urlObj = new URL(url);
        const urlExt = path.extname(urlObj.pathname).toLowerCase();
        if (urlExt && urlExt.length <= 5) return urlExt || ".jpg";
    } catch {}
    if (contentType) {
        if (contentType.includes("image/webp")) return ".webp";
        if (contentType.includes("image/png")) return ".png";
        if (contentType.includes("image/jpeg")) return ".jpg";
    }
    return ".jpg";
}
async function downloadToFile(url: string, outBaseNoExt: string) {
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 20_000 });
    const ext = pickExtension(url, res.headers["content-type"]);
    const target = outBaseNoExt + ext;
    await fsp.writeFile(target, res.data);
    return target;
}
async function findExistingPoster(baseOut: string) {
    const exts = [".webp", ".jpg", ".jpeg", ".png"];
    for (const ext of exts) {
        const p = baseOut + ext;
        if (fs.existsSync(p)) return p;
    }
    return null;
}
async function readMoviesMeta(): Promise<MovieMeta[]> {
    const raw = await fsp.readFile(INPUT, "utf8");
    const arr = JSON.parse(raw) as MovieMeta[];
    return arr.filter(
        (m) => m && typeof m.id === "number" && typeof m.originalTitle === "string"
    );
}

/** Async pool (concurrency limiter) — bez zewnętrznych zależności */
async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<void>
) {
    const queue = items.map((_, i) => i);
    let running = 0;
    return new Promise<void>((resolve, reject) => {
        const next = () => {
            if (queue.length === 0 && running === 0) return resolve();
            while (running < limit && queue.length) {
                const idx = queue.shift()!;
                running++;
                worker(items[idx], idx)
                    .catch(reject)
                    .finally(() => {
                        running--;
                        next();
                    });
            }
        };
        next();
    });
}

/** From search page: extract result "cards" with href, title, year, posterSrc */
async function getSearchCards(
    browser: Browser,
    query: string
): Promise<Array<{ href: string; title: string; year: number | null; posterSrc: string | null }>> {
    const page = await browser.newPage();
    try {
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36"
        );
        await page.goto(FILMWEB_SEARCH(query), {
            waitUntil: "networkidle2",
            timeout: 30_000,
        });
        await sleep(STEP_DELAY_MS);

        const cards = await page.evaluate(() => {
            function closestCard(el: Element): Element {
                let n: Element | null = el;
                for (let i = 0; i < 6 && n && n.parentElement; i++) {
                    const links = n.querySelectorAll('a[href^="/film/"]');
                    const imgs = n.querySelectorAll("img");
                    if (links.length >= 1 && imgs.length >= 1) return n;
                    n = n.parentElement;
                }
                return el;
            }

            const filmAnchors = Array.from(
                document.querySelectorAll<HTMLAnchorElement>('a[href^="/film/"]')
            );
            const seen = new Set<string>();
            const out: Array<{
                href: string;
                title: string;
                year: number | null;
                posterSrc: string | null;
            }> = [];

            for (const a of filmAnchors) {
                const href = a.getAttribute("href") || "";
                if (!href || seen.has(href)) continue;
                seen.add(href);

                const card = closestCard(a);

                let title = a.textContent?.trim() || "";
                if (!title) {
                    const titleA = card.querySelector<HTMLAnchorElement>('a[href^="/film/"]');
                    title = titleA?.textContent?.trim() || "";
                }

                let year: number | null = null;
                const spans = Array.from(card.querySelectorAll("span"));
                for (const s of spans) {
                    const t = (s.textContent || "").trim();
                    if (/^\d{4}$/.test(t)) {
                        year = parseInt(t, 10);
                        break;
                    }
                }

                let posterSrc: string | null = null;
                const imgs = Array.from(card.querySelectorAll<HTMLImageElement>("img"));
                const fw = imgs.find((img) => (img.getAttribute("src") || "").includes("fwcdn"));
                posterSrc = fw?.getAttribute("src") || null;

                out.push({ href, title, year, posterSrc });
            }
            return out;
        });

        return cards;
    } finally {
        await page.close().catch(() => {});
    }
}

/** Visit film page and verify director(s) OR get og:image as fallback poster */
async function validateByDirectorOrGetOgImage(
    browser: Browser,
    filmHref: string,
    wantedDirectors: string[]
): Promise<{ directorMatch: boolean; ogImage: string | null }> {
    const url = new URL(filmHref, "https://www.filmweb.pl").toString();
    const page = await browser.newPage();
    try {
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36"
        );
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await sleep(STEP_DELAY_MS);

        const data = await page.evaluate(() => {
            const ogImage =
                document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content || null;

            const scripts = Array.from(
                document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')
            );
            let directorsFromLd: string[] = [];
            for (const sc of scripts) {
                try {
                    const obj = JSON.parse(sc.textContent || "null");
                    const arr = Array.isArray(obj) ? obj : [obj];
                    for (const item of arr) {
                        const dir = item?.director;
                        if (Array.isArray(dir)) {
                            directorsFromLd.push(
                                ...dir
                                    .map((d: any) => (typeof d?.name === "string" ? d.name : ""))
                                    .filter((s: string) => s && s.trim().length > 0)
                            );
                        } else if (dir && typeof dir?.name === "string") {
                            directorsFromLd.push(dir.name);
                        }
                    }
                } catch {}
            }

            let directorsFromDom: string[] = [];
            const allEls = Array.from(document.querySelectorAll<HTMLElement>("*"));
            const labelEl = allEls.find((el) => /reżyseria/i.test(el.textContent || ""));
            if (labelEl) {
                const personLinks = Array.from(
                    labelEl.parentElement?.querySelectorAll<HTMLAnchorElement>('a[href^="/person/"]') || []
                );
                directorsFromDom = personLinks
                    .map((a) => (a.textContent || "").trim())
                    .filter(Boolean);
            }

            return {
                ogImage,
                directorsLd: directorsFromLd,
                directorsDom: directorsFromDom,
            };
        });

        const have = new Set(
            [...data.directorsLd, ...data.directorsDom].map((s) =>
                s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
            )
        );
        const wants = new Set(
            wantedDirectors.map((s) =>
                s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
            )
        );

        let directorMatch = false;
        for (const w of wants) {
            if (have.has(w)) {
                directorMatch = true;
                break;
            }
        }

        return { directorMatch, ogImage: data.ogImage };
    } finally {
        await page.close().catch(() => {});
    }
}

/** Process a single movie end-to-end. */
async function processMovie(
    browser: Browser,
    m: MovieMeta
): Promise<{ id: number; saved?: string; skipped?: string; error?: string }> {
    const outBase = path.join(OUT_DIR, `${m.id}-filmweb`);

    if (!FORCE) {
        const exists = await findExistingPoster(outBase);
        if (exists) return { id: m.id, skipped: path.basename(exists) };
    }

    const cards = await getSearchCards(browser, m.originalTitle);
    if (!cards.length) return { id: m.id, error: "No search results" };

    const titlePeers = cards.filter((c) => titlesEqual(c.title, m.originalTitle));
    const candidates = titlePeers.length ? titlePeers : cards;

    let chosen = candidates.find((c) => m.year != null && c.year === m.year) || candidates[0];

    const dirList = toArray(m.directors);
    if (m.year != null && chosen.year !== m.year && dirList.length > 0 && chosen.href) {
        try {
            const dirCheck = await validateByDirectorOrGetOgImage(browser, chosen.href, dirList);
            if (!dirCheck.directorMatch) {
                const alt = candidates.find((c) => c !== chosen);
                if (alt) {
                    const altCheck = await validateByDirectorOrGetOgImage(browser, alt.href, dirList);
                    if (altCheck.directorMatch) {
                        chosen = alt;
                        if (!chosen.posterSrc && altCheck.ogImage) chosen.posterSrc = altCheck.ogImage;
                    }
                }
            } else {
                if (!chosen.posterSrc && dirCheck.ogImage) chosen.posterSrc = dirCheck.ogImage;
            }
        } catch {
            // ignore
        }
    }

    let posterUrl = chosen.posterSrc;
    if (!posterUrl && chosen.href) {
        const { ogImage } = await validateByDirectorOrGetOgImage(browser, chosen.href, dirList);
        posterUrl = ogImage;
    }
    if (!posterUrl) return { id: m.id, error: "No poster url found" };

    const saved = await downloadToFile(posterUrl, outBase);
    return { id: m.id, saved: path.basename(saved) };
}

async function main() {
    const t0 = Date.now();
    await ensureDir(OUT_DIR);

    const movies = await readMoviesMeta();
    console.log(`🎬 Movies: ${movies.length} | concurrency=${LIMIT} | force=${FORCE}`);

    const browser = await puppeteer.launch({
        headless: true, // bezpieczniejsze ustawienie
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    let ok = 0,
        skipped = 0,
        fail = 0;

    try {
        await runWithConcurrency(movies, LIMIT, async (m) => {
            const start = Date.now();
            const outcome = await Promise.race([
                processMovie(browser, m),
                (async () => {
                    await sleep(PER_MOVIE_TIMEOUT);
                    return { id: m.id, error: `Timeout ${PER_MOVIE_TIMEOUT}ms` } as const;
                })(),
            ]);
            const ms = Date.now() - start;

            if ("saved" in outcome && outcome.saved) {
                ok++;
                console.log(`✅ [${m.id}] ${m.originalTitle} → ${outcome.saved}  (${ms} ms)`);
            } else if ("skipped" in outcome && outcome.skipped) {
                skipped++;
                console.log(`⏭️  [${m.id}] exists → ${outcome.skipped}  (${ms} ms)`);
            } else {
                fail++;
                console.warn(`⚠️  [${m.id}] ${outcome.error}  (${ms} ms) — ${m.originalTitle}`);
            }
        });
    } finally {
        await browser.close().catch(() => {});
    }

    const elapsed = Date.now() - t0;
    console.log(`\n⏱️  Done in ${elapsed} ms — saved: ${ok}, skipped: ${skipped}, failed: ${fail}`);
}

main().catch((err) => {
    console.error("❌ Fatal:", err);
    process.exit(1);
});
