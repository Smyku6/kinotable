/* eslint-disable no-console */
import path from "node:path";
import { z } from "zod";
import {Db, MovieOutput, ScreeningOutput} from "./build-db.types";
import {readJson, readOrInitOverride, writeJson} from "./build-db.utils";

function buildIndexes(db: Omit<Db, "indexes">) {
    const contestIdToMovieIdsSet = new Map<number, Set<number>>();
    const movieIdToContestIdsSet = new Map<number, Set<number>>();

    db.screenings.forEach((screening) => {
        if (screening.contestId == null) return;
        if (!contestIdToMovieIdsSet.has(screening.contestId)) contestIdToMovieIdsSet.set(screening.contestId, new Set());

        const movieIdsFromScreening = Array.isArray(screening.movieIds) ? screening.movieIds : [];
        for (const movieId of movieIdsFromScreening) {
            contestIdToMovieIdsSet.get(screening.contestId)!.add(movieId);
            if (!movieIdToContestIdsSet.has(movieId)) movieIdToContestIdsSet.set(movieId, new Set());
            movieIdToContestIdsSet.get(movieId)!.add(screening.contestId);
        }
    });

    const contestIdToMovieIds: Record<string, number[]> = {};
    for (const [cid, set] of contestIdToMovieIdsSet) {
        contestIdToMovieIds[String(cid)] = Array.from(set).sort((a, b) => a - b);
    }

    const movieIdToContestIds: Record<string, number[]> = {};
    for (const [mid, set] of movieIdToContestIdsSet) {
        movieIdToContestIds[String(mid)] = Array.from(set).sort((a, b) => a - b);
    }


    return { contestIdToMovieIds, movieIdToContestIds };
}


/**
 * Build canonical DB (db.json) from raw JSON sources.
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
        directors: z.array(z.string()).nullable().optional(),
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
export const ContestsOverrideSchema = z.object({
    $version: z.number().default(1),
    items: z.record(
        z.string(),
        z.object({
            isVisibleInFilters: z.boolean().optional(),
            order: z.number().optional(),
            name: z.string().optional(),
        })
    ).default({}),
});

// NOTE: screenings may contain either a single id (number) or multiple (number[])
const ScreeningsSchema = z.array(
    z.object({
        movieIds: z.union([z.number(), z.array(z.number())]).nullable(),
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
export type ContestsOverride = z.infer<typeof ContestsOverrideSchema>;
type Screenings = z.infer<typeof ScreeningsSchema>;

// ==============================
// 4) Utilities
// ==============================




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
    const overrideContests = await readOrInitOverride(contests);
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
    const contestsById: Record<string, { id: number; name: string; isVisibleInFilters?: boolean; order?: number }> = {};
    for (const c of contests) {
        const key = String(c.contestId);
        const ov = overrideContests.items[key];
        contestsById[key] = {
            id: c.contestId,
            name: ov?.name ?? c.contestName,
            isVisibleInFilters: ov?.isVisibleInFilters ?? true,
            order: ov?.order,
        };
    }

    //      locationId -> { id, name }
    const locationsById: Record<string, { id: number; name: string }> = {};
    for (const l of locations) {
        locationsById[String(l.locationId)] = { id: l.locationId, name: l.locationName };
    }

    // 5.3) Build moviesById (canonical movie dictionary)
    //      Source of truth for title is movie-list.json (you can apply merge precedence if needed).
    const moviesById: Record<string,MovieOutput> = {};

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
    const outScreenings: ScreeningOutput[] = screenings.map((screening) => {
        // Always store film IDs as an array (supports short packages).
        const movieIds = Array.isArray(screening.movieIds) ? screening.movieIds.slice() : screening.movieIds != null ? [screening.movieIds] : [];

        // Normalize to a single boolean: accreditationOnly
        // Raw: accreditationNeeded === true (no-ticket) → accreditationOnly: true
        //      accreditationNeeded === false (has-ticket) → accreditationOnly: false
        //      null → default to false (configurable)
        const accreditationOnly = screening.accreditationNeeded ?? false;

        // Building stringId
        const timePart = new Date(screening.startsAt).getTime();
        const movieIdsPart = movieIds.join('');

        return {
            id: (`${timePart}${screening.placeId}${screening.contestId}${movieIdsPart}`),
            movieIds: movieIds,
            contestId: screening.contestId ?? null,
            locationId: screening.placeId ?? null,
            startsAt: screening.startsAt, // already ISO
            accreditationOnly,
        };
    });

    // 5.5) Compose final canonical DB object
    const coreDbWithoutIndexes: Omit<Db, "indexes"> = {
        $schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        moviesById,
        contestsById,
        locationsById,
        screenings: outScreenings,
    };

    const indexes = buildIndexes(coreDbWithoutIndexes);
    const db: Db = { ...coreDbWithoutIndexes, indexes };
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
