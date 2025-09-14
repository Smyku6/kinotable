"use client";

import {MovieOutput} from "../../../../scripts/build-db.types";

export function MovieCard({ movie }: { movie: MovieOutput }) {
    console.log({movie})
    const originalTitle = movie.originalTitle;
    const year = movie.year ?? null;
    const runtime = movie.runtimeMin ?? null;
    const directors = movie.directors ?? null;

    return (
        <article
            className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition"
            title={originalTitle}
        >
            <h3 className="line-clamp-2 font-medium text-gray-900">{originalTitle}</h3>

            <p className="mt-1 text-xs text-gray-600 tabular-nums">
                {year ? `${year}` : ""}
                {runtime ? ` • ${runtime} min` : ""}
                {directors ? ` • ${directors.join(', ')}` : ""}
            </p>
        </article>
    );
}
