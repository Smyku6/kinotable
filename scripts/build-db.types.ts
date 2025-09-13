// scripts/types.ts (opcjonalnie)

export type MovieOutput = {
    id: number;
    originalTitle: string;
    directors: string[] | null;
    year: number | null;
    runtimeMin: number | null;
    url?: string;
    error?: string;
};

export type Db = {
    $schemaVersion: string;
    generatedAt: string;
    moviesById: Record<string, MovieOutput>;
    contestsById: Record<string, { id: number; name: string }>;
    locationsById: Record<string, { id: number; name: string }>;
    screenings: Array<{
        ids: number[];
        movieTitles: string[];
        contestId: number | null;
        locationId: number | null;
        startsAt: string;
        accreditationOnly: boolean;
    }>;
};
