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
            {/* Placeholder na plakat (opcjonalnie w przyszłości podłączysz src) */}
            {/*<div className="aspect-[2/3] w-full rounded-lg bg-gray-100 mb-3 overflow-hidden">*/}
            {/*    /!* <img src={movie.poster ?? "/placeholder.svg"} alt={title} className="h-full w-full object-cover" /> *!/*/}
            {/*    <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">*/}
            {/*        Poster*/}
            {/*    </div>*/}
            {/*</div>*/}

            <h3 className="line-clamp-2 font-medium text-gray-900">{originalTitle}</h3>

            <p className="mt-1 text-xs text-gray-600 tabular-nums">
                {year ? `${year}` : ""}
                {runtime ? ` • ${runtime} min` : ""}
                {directors ? ` • ${directors.join(', ')}` : ""}
            </p>
        </article>
    );
}
