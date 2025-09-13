/* eslint-disable no-console */
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * Step 2 — Build canonical DB (db.json) from raw JSON sources.
 *
 * Input (data/raw):
 *  - movie-list.json
 *  - movies-meta.json
 *  - locations.json
 *  - contests.json
 *  - screenings.json
 *
 * Output (data/build):
 *  - db.json (canonical, normalized dataset)
 */

// ==============================
// 1) Paths (input/output)
// ==============================
const RAW_DIR = path.resolve(process.cwd(), "../public/data/raw");
const OUT_DIR = path.resolve(process.cwd(), "../public/data/build");
const OUT_FILE = path.join(OUT_DIR, "db.json");

// ==============================
// 2) Input schemas (Zod)
//    Keep raw files predictable and fail fast on shape changes.
// ==============================
const MovieListSchema = z.array(
    z.object({
        id: z.number(),
        originalTitle: z.string(),
    })
);

const MoviesMetaSchema = z.array(
    z.object({
        id: z.number(),
        originalTitle: z.string(),
        directors: z.union([z.string(), z.array(z.string())]).nullable().optional(),
        year: z.number().nullable().optional(),
        runtimeMin: z.number().nullable().optional(),
        url: z.string().url().optional(),
    })
);

const LocationsSchema = z.array(
    z.object({
        locationId: z.number(),
        locationName: z.string(),
    })
);

const ContestsSchema = z.array(
    z.object({
        contestId: z.number(),
        contestName: z.string(),
    })
);

// NOTE: screenings may contain either a single id (number) or multiple (number[])
const ScreeningsSchema = z.array(
    z.object({
        id: z.union([z.number(), z.array(z.number())]).nullable(),
        movieTitles: z.array(z.string()),
        contestId: z.number().nullable(),
        placeId: z.number().nullable(),
        startsAt: z.string(), // ISO "YYYY-MM-DDTHH:mm:ss"
        accreditationNeeded: z.boolean().nullable(),
    })
);

// ==============================
// 3) Local TS types (derived from schemas)
// ==============================
type MovieList = z.infer<typeof MovieListSchema>;
type MoviesMeta = z.infer<typeof MoviesMetaSchema>;
type Locations = z.infer<typeof LocationsSchema>;
type Contests = z.infer<typeof ContestsSchema>;
type Screenings = z.infer<typeof ScreeningsSchema>;

// ==============================
// 4) Utilities
// ==============================
async function readJson<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
    let raw: string;
    try {
        raw = await fs.readFile(filePath, "utf8");
    } catch (e) {
        console.error(`❌ Cannot read file: ${filePath}`);
        throw e;
    }

    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch (e: any) {
        // Pretty diagnostic: show context around the error position if available
        const msg = String(e?.message || e);
        const m = msg.match(/position\s+(\d+)/i);
        let ctx = "";
        if (m) {
            const pos = Number(m[1]);
            const start = Math.max(0, pos - 80);
            const end = Math.min(raw.length, pos + 80);
            const snippet = raw.slice(start, end);
            const caret = " ".repeat(Math.max(0, pos - start)) + "^";
            ctx = `\n--- JSON context (~pos ${pos}) ---\n${snippet}\n${caret}\n-------------------------------`;
        }
        console.error(`❌ JSON.parse error in ${filePath}: ${msg}${ctx}`);
        console.error("💡 Common causes: stray comma, comments, BOM, or multiple JSON objects concatenated.");
        throw e;
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
        console.error(`❌ Schema error in ${filePath}`);
        console.error(parsed.error.issues);
        throw new Error(`Invalid JSON schema for ${path.basename(filePath)}`);
    }
    return parsed.data;
}


async function writeJson(filePath: string, data: unknown) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/** Normalize directors to an array, keep null if unknown. */
function toArrayString(input: string | string[] | null | undefined): string[] | null {
    if (input == null) return null;
    if (Array.isArray(input)) return input;
    return [input];
}

// ==============================
// 5) Main build procedure
// ==============================
async function main() {
    console.time("build-db");

    // 5.1) Read & validate raw inputs
    const movieList = await readJson<MovieList>(path.join(RAW_DIR, "movie-list.json"), MovieListSchema);
    const moviesMeta = await readJson<MoviesMeta>(path.join(RAW_DIR, "movies-meta.json"), MoviesMetaSchema);
    const locations = await readJson<Locations>(path.join(RAW_DIR, "locations.json"), LocationsSchema);
    const contests = await readJson<Contests>(path.join(RAW_DIR, "contests.json"), ContestsSchema);
    const screenings = await readJson<Screenings>(path.join(RAW_DIR, "screenings.json"), ScreeningsSchema);

    // 5.2) Build helper maps for fast lookups
    //      id -> canonical title from movie-list.json
    const titlesByid = new Map<number, string>();
    for (const m of movieList) {
        // If duplicates exist, last wins (or emit a warning if you prefer).
        titlesByid.set(m.id, m.originalTitle);
    }

    //      id -> subset of meta (year, runtime, directors[])
    const metaByid = new Map<
        number,
        { year?: number | null; runtimeMin?: number | null; directors?: string[] | null }
    >();
    for (const m of moviesMeta) {
        metaByid.set(m.id, {
            year: m.year ?? null,
            runtimeMin: m.runtimeMin ?? null,
            directors: toArrayString(m.directors),
        });
    }

    //      contestId -> { id, name } (as object map for O(1) lookup by string key)
    const contestsById: Record<string, { id: number; name: string }> = {};
    for (const c of contests) {
        contestsById[String(c.contestId)] = { id: c.contestId, name: c.contestName };
    }

    //      locationId -> { id, name }
    const locationsById: Record<string, { id: number; name: string }> = {};
    for (const l of locations) {
        locationsById[String(l.locationId)] = { id: l.locationId, name: l.locationName };
    }

    // 5.3) Build moviesById (canonical movie dictionary)
    //      Source of truth for title is movie-list.json (you can apply merge precedence if needed).
    const moviesById: Record<
        string,
        {
            id: number;
            originalTitle: string;
            year?: number | null;
            runtimeMin?: number | null;
            directors?: string[] | null;
        }
    > = {};

    // Start from movie-list.json (guarantees at least {id, title})
    for (const m of movieList) {
        const meta = metaByid.get(m.id);
        moviesById[String(m.id)] = {
            id: m.id,
            originalTitle: m.originalTitle,
            year: meta?.year ?? null,
            runtimeMin: meta?.runtimeMin ?? null,
            directors: meta?.directors ?? null,
        };
    }

    // Include movies that exist only in movies-meta.json (edge cases)
    for (const m of moviesMeta) {
        const key = String(m.id);
        if (!moviesById[key]) {
            moviesById[key] = {
                id: m.id,
                originalTitle: m.originalTitle,
                year: m.year ?? null,
                runtimeMin: m.runtimeMin ?? null,
                directors: toArrayString(m.directors),
            };
        }
    }

    // 5.4) Convert raw screenings into canonical structure
    const outScreenings = screenings.map((s) => {
        // Always store film IDs as an array (supports short packages).
        const ids = Array.isArray(s.id) ? s.id.slice() : s.id != null ? [s.id] : [];

        // Normalize to a single boolean: accreditationOnly
        // Raw: accreditationNeeded === true (no-ticket) → accreditationOnly: true
        //      accreditationNeeded === false (has-ticket) → accreditationOnly: false
        //      null → default to false (configurable)
        const accreditationOnly = s.accreditationNeeded ?? false;

        return {
            ids,
            titles: s.movieTitles,
            contestId: s.contestId ?? null,
            locationId: s.placeId ?? null,
            startsAt: s.startsAt, // already ISO
            accreditationOnly,
        };
    });

    // 5.5) Compose final canonical DB object
    const db = {
        $schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        moviesById,
        contestsById,
        locationsById,
        screenings: outScreenings,
    };

    // 5.6) Write to disk
    await writeJson(OUT_FILE, db);
    console.log("💾 Generated:", OUT_FILE);

    console.timeEnd("build-db");
}

// ==============================
// 6) Run
// ==============================
main().catch((err) => {
    console.error("❌ build-db failed:", err);
    process.exit(1);
});
