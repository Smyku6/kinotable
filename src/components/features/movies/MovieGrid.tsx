"use client";

import { useMemo } from "react";
import { MovieCard } from "./MovieCard";
import {Db} from "../../../../scripts/build-db.types";

export function MovieGrid({ db }: { db: Db }) {
    const movies = useMemo(() => {
        const arr = Object.values(db.moviesById);
        arr.sort((a, b) => a.originalTitle.localeCompare(b.originalTitle, "pl", { sensitivity: "base" }));
        return arr;
    }, [db]);

    return (
        <div className="mx-auto max-w-7xl px-4 py-6">
            <div className="mb-3 text-sm text-gray-600">{movies.length} filmów</div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {movies.map((movie) => (
                    <li key={movie.id}>
                        <MovieCard movie={movie} />
                    </li>
                ))}
            </ul>
        </div>
    );
}
