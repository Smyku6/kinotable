import { useMemo } from "react";
import { MovieCard } from "@/components/features/movies/MovieCard";
import { Db, MovieOutput } from "../../../../scripts/build-db.types";

const collator = new Intl.Collator("pl", { sensitivity: "base" });

export function MovieGrid({ db, movieIds }: { db: Db; movieIds?: number[] }) {
    // 1) Lista filmów (całość lub podzbiór)
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

    // 2) Grupowanie po konkursach z uwzględnieniem isVisibleInFilters i order
    const groups = useMemo(() => {
        type Group = {
            key: string;            // contestId lub "__none__"
            name: string;           // nazwa sekcji
            order: number;          // sortowanie sekcji
            visible: boolean;       // czy sekcja ma być widoczna
            movies: MovieOutput[];
        };

        const map = new Map<string, Group>();
        const { movieIdToContestIds } = db.indexes;

        const ensureGroup = (key: string): Group => {
            if (!map.has(key)) {
                if (key === "__none__") {
                    map.set(key, {
                        key,
                        name: "Bez sekcji",
                        order: Number.MAX_SAFE_INTEGER,
                        visible: true, // "Bez sekcji" zawsze widoczna (możesz to też kontrolować override'em)
                        movies: [],
                    });
                } else {
                    const meta = db.contestsById[key];
                    const numKey = Number(key);
                    const orderFromMeta =
                        typeof meta?.order === "number"
                            ? meta.order
                            : Number.isFinite(numKey)
                                ? numKey
                                : Number.MAX_SAFE_INTEGER - 1;

                    map.set(key, {
                        key,
                        name: meta?.name ?? `Sekcja ${key}`,
                        order: orderFromMeta,
                        visible: meta?.isVisibleInFilters ?? true, // <-- nowy switch widoczności
                        movies: [],
                    });
                }
            }
            return map.get(key)!;
        };

        for (const m of movies) {
            const mid = String(m.id);
            const contestIds = movieIdToContestIds[mid];

            let pushedToVisibleSection = false;

            if (contestIds && contestIds.length) {
                for (const cid of contestIds) {
                    const key = String(cid);
                    const g = ensureGroup(key);
                    // dodaj do grupy tylko jeśli ta sekcja jest widoczna
                    if (g.visible) {
                        g.movies.push(m);
                        pushedToVisibleSection = true;
                    }
                }
            }

            // Jeżeli film nie trafił do żadnej widocznej sekcji (albo nie miał contestów) → "Bez sekcji"
            if (!pushedToVisibleSection) {
                ensureGroup("__none__").movies.push(m);
            }
        }

        // Posortuj filmy w każdej sekcji po tytule
        for (const g of map.values()) {
            g.movies.sort((a, b) => collator.compare(a.originalTitle, b.originalTitle));
        }

        // Sekcje: najpierw filtr (tylko widoczne) + "Bez sekcji"
        let arr = Array.from(map.values()).filter(
            (g) => g.key === "__none__" || g.visible
        );

        // Sortuj sekcje po order, potem po nazwie
        arr.sort((a, b) => {
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
                        {group.name} <span className="text-gray-500">({group.movies.length})</span>
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
