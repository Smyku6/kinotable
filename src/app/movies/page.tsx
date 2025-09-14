"use client";

import { useMemo } from "react";
import { useDb } from "@/hooks/useDb";
import {useMoviesFiltersStore} from "@/components/features/movies/store";
import {MovieGrid} from "@/components/features/movies/MovieGrid";
import {ContestSelect} from "@/components/features/movies/ContestSelect";


export default function MoviesPage() {
    const { db, loading, error } = useDb();
    console.log({ db, loading, error });
    const selectedContests = useMoviesFiltersStore((s) => s.selectedContestIds);

    const filteredIds = useMemo(() => {
        if (!db) return [];

        const sortIdsByTitle = (ids: number[]) =>
            ids.slice().sort((a, b) =>
                db.moviesById[String(a)].originalTitle
                    .localeCompare(db.moviesById[String(b)].originalTitle, "pl", { sensitivity: "base" })
            );

        if (selectedContests.size === 0) {
            const all = Object.values(db.moviesById).map((m) => m.id);
            return sortIdsByTitle(all);
        }

        const parts: number[][] = [];
        for (const cid of selectedContests) {
            const arr = db.indexes.contestIdToMovieIds[String(cid)] || [];
            if (arr.length) parts.push(arr);
        }

        // Prosty union — możesz zostawić swój helper unionSortedMany, jeśli wolisz
        const union = Array.from(new Set(parts.flat())).sort((a, b) => a - b);
        return sortIdsByTitle(union);
    }, [db, selectedContests]);

    return (
        <main className="min-h-screen bg-gray-50">
            <div className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 py-4 space-y-3">
                    <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Przeglądarka filmów</h1>

                    {db && (
                        <div className="flex flex-wrap gap-4">
                            <ContestSelect db={db} />
                            {/* tu potem dojdą kolejne dropdowny: rok, sala, data itd. */}
                        </div>
                    )}

                    {loading && <p className="text-sm text-gray-500">Wczytywanie…</p>}
                    {error && <p className="text-sm text-red-600">Nie udało się wczytać danych: {error}</p>}
                </div>
            </div>

            {db && <MovieGrid db={db} movieIds={filteredIds} />}

            {!loading && !error && !db && (
                <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-gray-600">
                    Brak danych do wyświetlenia.
                </div>
            )}
        </main>
    );
}