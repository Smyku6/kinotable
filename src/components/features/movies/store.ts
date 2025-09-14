import { create } from "zustand";

/**
 * Filters state is intentionally tiny and generic.
 * We only keep IDs/flags here — no heavy data from DB.
 * This makes components subscribe to exactly what they need,
 * minimizing re-renders.
 */
type MoviesFiltersState = {
    /** Selected contest IDs (empty = all) */
    selectedContestIds: Set<number>;

    // Actions
    toggleContest: (contestId: number) => void;
    setContests: (ids: number[] | Set<number>) => void;
    clearContests: () => void;
};

/**
 * Internal util to create a *new* Set with a toggled value.
 * We NEVER mutate the existing Set in-place to preserve referential stability.
 */
function toggleInSet(prev: Set<number>, id: number): Set<number> {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
}

/**
 * Internal util to normalize array/Set input into a brand-new Set<number>.
 */
function toSet(input: number[] | Set<number>): Set<number> {
    return input instanceof Set ? new Set(input) : new Set(input);
}

/**
 * Global store for movie filters.
 * - Kept minimal on purpose (only filters, not DB/data).
 * - Selectors in components should subscribe to tiny slices
 *   (e.g. selectedContestIds) to avoid re-renders.
 */
export const useMoviesFiltersStore = create<MoviesFiltersState>((set) => ({
    selectedContestIds: new Set<number>(),

    toggleContest: (contestId: number) =>
        set((s) => ({ selectedContestIds: toggleInSet(s.selectedContestIds, contestId) })),

    setContests: (ids: number[] | Set<number>) =>
        set(() => ({ selectedContestIds: toSet(ids) })),

    clearContests: () => set(() => ({ selectedContestIds: new Set<number>() })),
}));
