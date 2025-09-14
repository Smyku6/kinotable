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

export type ScreeningOutput = {
    id: number;
    movieIds: number[];
    contestId: number | null;
    locationId: number | null;
    startsAt: string;
    accreditationOnly: boolean;
};

export type Db = {
    $schemaVersion: string;
    generatedAt: string;
    moviesById: Record<string, MovieOutput>;
    contestsById: Record<string, { id: number; name: string; isVisibleInFilters?: boolean; order?: number }>;
    locationsById: Record<string, { id: number; name: string }>;
    screenings: Array<ScreeningOutput>;
    indexes: {
        contestIdToMovieIds: Record<string, number[]>;     // contestId -> unique movieIds (sorted)
        movieIdToContestIds: Record<string, number[]>;     // movieId   -> unique contestIds (sorted)
    };
};
