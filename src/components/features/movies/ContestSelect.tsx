"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {Db} from "../../../../scripts/build-db.types";
import {useMoviesFiltersStore} from "@/components/features/movies/store";


/**
 * Multi-select dropdown for contests (sections).
 * - Uses zustand store for selectedContestIds
 * - Checkbox list inside a popover
 * - "All" = empty selection (consistent with store semantics)
 */
export function ContestSelect({ db }: { db: Db }) {
    const selected = useMoviesFiltersStore((s) => s.selectedContestIds);
    const toggle = useMoviesFiltersStore((s) => s.toggleContest);
    const clear = useMoviesFiltersStore((s) => s.clearContests);
    const setContests = useMoviesFiltersStore((s) => s.setContests);

    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    // Sort contests once
    const contests = useMemo(() => {
        const arr = Object.values(db.contestsById).filter(c => c.isVisibleInFilters)
        arr.sort((a, b) => a.name.localeCompare(b.name, "pl", { sensitivity: "base" }));
        return arr;
    }, [db]);

    const counts = db.indexes.contestIdToMovieIds;

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (!ref.current) return;
            if (!ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onEsc);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onEsc);
        };
    }, [open]);

    // Button label
    const label = selected.size === 0
        ? "Wszystkie sekcje"
        : `Sekcje (${selected.size})`;

    // Helpers
    const allIds = useMemo(() => contests.map(c => c.id), [contests]);
    const selectAll = () => setContests(allIds);
    const selectNone = () => clear();

    return (
        <div className="relative inline-block text-left" ref={ref}>
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Sekcje:</span>
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className="inline-flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 min-w-[220px]"
                >
                    <span className="truncate">{label}</span>
                    <svg className="ml-2 h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"/>
                    </svg>
                </button>
            </div>

            {open && (
                <div
                    role="listbox"
                    aria-multiselectable="true"
                    className="absolute z-20 mt-2 w-[360px] max-h-[60vh] overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                >
                    {/* Actions */}
                    <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2">
                        <div className="text-xs text-gray-500">Zaznacz:</div>
                        <div className="flex items-center gap-2">
                            <button
                                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-gray-400"
                                onClick={selectAll}
                            >
                                wszystkie
                            </button>
                            <button
                                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-gray-400"
                                onClick={selectNone}
                            >
                                żadne
                            </button>
                        </div>
                    </div>

                    {/* Options */}
                    <ul className="p-2">
                        {contests.map((c) => {
                            const checked = selected.has(c.id);
                            const count = counts[String(c.id)]?.length ?? 0;
                            return (
                                <li key={c.id}>
                                    <label className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-gray-50">
                    <span className="flex items-center gap-2">
                      <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={() => toggle(c.id)}
                          aria-checked={checked}
                      />
                      <span className="text-sm text-gray-900">{c.name}</span>
                    </span>
                                        <span className="text-[11px] text-gray-500 tabular-nums">({count})</span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
