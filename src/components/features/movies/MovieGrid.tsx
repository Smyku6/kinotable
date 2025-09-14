import { useMemo } from "react";
import {MovieCard} from "@/components/features/movies/MovieCard";
import {Db, MovieOutput} from "../../../../scripts/build-db.types";

const collator = new Intl.Collator("pl", { sensitivity: "base" });

export function MovieGrid({ db, movieIds }: { db: Db; movieIds?: number[] }) {
    // 1) Zbierz listę filmów (całość lub podzbiór)
    const movies: MovieOutput[] = useMemo(() => {
        if (movieIds && movieIds.length) {
            const out: MovieOutput[] = [];
            for (const id of movieIds) {
                const m = db.moviesById[String(id)];
                if (m) out.push(m);
            }
            return out;
        }
        return Object.values(db.moviesById);
    }, [db, movieIds]);

    // 2) Zbuduj grupy po konkursach (sekcjach)
    const groups = useMemo(() => {
        type Group = {
            key: string;                 // contestId jako string lub "__none__"
            order: number;               // do sortowania sekcji (dla "__none__" MAX_SAFE_INTEGER)
            name: string;                // nazwa sekcji
            movies: MovieOutput[];
        };

        const map = new Map<string, Group>();

        const { movieIdToContestIds } = db.indexes;

        const ensureGroup = (key: string) => {
            if (!map.has(key)) {
                if (key === "__none__") {
                    map.set(key, {
                        key,
                        order: Number.MAX_SAFE_INTEGER,
                        name: "Bez sekcji",
                        movies: [],
                    });
                } else {
                    const meta = db.contestsById[key];
                    const num = Number(key);
                    map.set(key, {
                        key,
                        order: Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER - 1,
                        name: meta?.name ?? `Sekcja ${key}`,
                        movies: [],
                    });
                }
            }
            return map.get(key)!;
        };

        for (const m of movies) {
            const mid = String(m.id);
            const contestIds = movieIdToContestIds[mid];

            if (contestIds && contestIds.length) {
                for (const cid of contestIds) {
                    const key = String(cid);
                    ensureGroup(key).movies.push(m);
                }
            } else {
                ensureGroup("__none__").movies.push(m);
            }
        }

        // Posortuj filmy w obrębie sekcji po tytule
        for (const g of map.values()) {
            g.movies.sort((a, b) => collator.compare(a.originalTitle, b.originalTitle));
        }

        // Posortuj sekcje po order, a potem po nazwie
        const arr = Array.from(map.values()).sort((a, b) => {
            if (a.order !== b.order) return a.order - b.order;
            return collator.compare(a.name, b.name);
        });

        return arr;
    }, [db.contestsById, db.indexes, movies]);

    return (
        <div className="mx-auto max-w-7xl px-4 py-6">
            <div className="mb-3 text-sm text-gray-600">{movies.length} filmów</div>

            {groups.map((group) => (
                <section key={group.key} className="mb-10">
                    <h2 className="text-gray-500 mb-3 text-lg font-semibold">
                        {group.name}{" "}
                        <span className="text-gray-500">({group.movies.length})</span>
                    </h2>

                    <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {group.movies.map((movie) => (
                            <li key={movie.id}>
                                <MovieCard movie={movie} />
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}
