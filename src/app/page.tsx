"use client";

import {useDb} from "@/hooks/useDb";
import {MovieGrid} from "@/components/features/movies/MovieGrid";

export default function MoviesPage() {
    const { db, error, loading } = useDb();

    return (
        <main className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 py-4">
                    <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Przeglądarka filmów</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Poniżej prosta lista wszystkich filmów (wersja POC). W kolejnym kroku dołożymy wyszukiwarkę i filtry.
                    </p>
                    {loading && <p className="mt-2 text-sm text-gray-500">Wczytywanie…</p>}
                    {error && (
                        <p className="mt-2 text-sm text-red-600">Nie udało się wczytać danych: {error}</p>
                    )}
                </div>
            </div>

            {/* Grid */}
            {db && <MovieGrid db={db} />}

            {/* Empty state */}
            {!loading && !error && !db && (
                <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-gray-600">
                    Brak danych do wyświetlenia.
                </div>
            )}
        </main>
    );
}
