"use client";

import { useMemo, useState } from "react";
import { Db, ScreeningOutput } from "../../../scripts/build-db.types";

// Timeline config
const START_HOUR = 8;   // 08:00
const END_HOUR = 25;    // 01:00 (next day, exclusive)
const SLOT_MIN = 10;    // 10 minutes per column
const SLOTS_PER_HOUR = 60 / SLOT_MIN; // 6
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * SLOTS_PER_HOUR; // 102

// Festival days
const FEST_START = new Date("2025-09-22T00:00:00");
const FEST_END = new Date("2025-09-27T00:00:00"); // inclusive

function daysBetweenInclusive(start: Date, end: Date) {
    const out: Date[] = [];
    const d = new Date(start);
    while (d <= end) {
        out.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }
    return out;
}
function fmtDay(d: Date) {
    return d.toLocaleDateString("pl-PL", { weekday: "short", day: "2-digit", month: "short" });
}
function sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dateToSlot(dt: Date) {
    const hour = dt.getHours();
    const min = dt.getMinutes();
    const totalMinutes = (hour - START_HOUR) * 60 + min;
    return Math.floor(totalMinutes / SLOT_MIN);
}
function estimateDurationMin(movieIds: number[], moviesById: Db["moviesById"]) {
    let best: number | null = null;
    for (const id of movieIds) {
        const m = moviesById[String(id)];
        if (m?.runtimeMin != null) best = Math.max(best ?? 0, m.runtimeMin);
    }
    return best ?? 90;
}
function titleFor(screening: ScreeningOutput, moviesById: Db["moviesById"]) {
    const titles = screening.movieIds
        .map((mid) => moviesById[String(mid)]?.originalTitle)
        .filter(Boolean) as string[];
    return titles.join(", ");
}
function hourLabels() {
    const labels: { colStart: number; text: string }[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
        const text = `${String(h % 24).padStart(2, "0")}:00`;
        const colStart = (h - START_HOUR) * SLOTS_PER_HOUR + 1;
        labels.push({ colStart, text });
    }
    return labels;
}

/**
 * Stała paleta klas Tailwind do wyróżniania konkursów.
 * (ważne: wszystkie klasy są wymienione jawnie, żeby przeszły purge)
 */
const CONTEST_PALETTE = [
    { bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-400",   text: "text-amber-900" },
    { bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-400",    text: "text-blue-900" },
    { bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-400", text: "text-emerald-900" },
    { bg: "bg-rose-50",    border: "border-rose-200",    dot: "bg-rose-400",    text: "text-rose-900" },
    { bg: "bg-violet-50",  border: "border-violet-200",  dot: "bg-violet-400",  text: "text-violet-900" },
    { bg: "bg-slate-50",   border: "border-slate-200",   dot: "bg-slate-400",   text: "text-slate-900" },
] as const;

function contestStyle(contestId: number | null | undefined) {
    if (contestId == null) return CONTEST_PALETTE[5]; // neutral/szary dla braku konkursu
    const idx = Math.abs(contestId) % CONTEST_PALETTE.length;
    return CONTEST_PALETTE[idx];
}
function formatMinutes(total: number) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
}

export default function ClientSchedule({ db }: { db: Db }) {
    const days = useMemo(() => daysBetweenInclusive(FEST_START, FEST_END), []);
    const [selected, setSelected] = useState<Date>(days[0]);

    // Locations
    const locations = useMemo(() => {
        const arr = Object.values(db.locationsById);
        arr.sort((a, b) => a.name.localeCompare(b.name, "pl", { sensitivity: "base" }));
        return arr;
    }, [db.locationsById]);

    // Screenings by selected day & location
    const screeningsByLocation = useMemo(() => {
        const map = new Map<number, ScreeningOutput[]>();
        for (const row of db.screenings) {
            const dt = new Date(row.startsAt);
            if (!sameDay(dt, selected)) continue;
            if (row.locationId == null) continue;
            if (!map.has(row.locationId)) map.set(row.locationId, []);
            map.get(row.locationId)!.push(row);
        }
        for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        return map;
    }, [db.screenings, selected]);

    // Legend: visible contests that actually appear today
    const todaysContestIds = useMemo(() => {
        const set = new Set<number>();
        for (const rows of screeningsByLocation.values()) {
            for (const s of rows) if (s.contestId != null) set.add(s.contestId);
        }
        return Array.from(set).sort((a, b) => {
            const oa = db.contestsById[String(a)]?.order ?? a;
            const ob = db.contestsById[String(b)]?.order ?? b;
            return oa - ob;
        });
    }, [screeningsByLocation, db.contestsById]);

    const labels = useMemo(() => hourLabels(), []);

    return (
        <div className="space-y-6 text-gray-900">
            {/* Day selector */}
            <div className="flex flex-wrap gap-2">
                {days.map((d) => {
                    const active = sameDay(d, selected);
                    return (
                        <button
                            key={d.toISOString()}
                            onClick={() => setSelected(d)}
                            className={`px-3 py-1 rounded border transition ${
                                active
                                    ? "bg-white border-gray-900 text-gray-900 shadow-sm"
                                    : "bg-white border-gray-200 hover:bg-gray-50"
                            }`}
                            title={d.toLocaleDateString("pl-PL", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        >
                            {fmtDay(d)}
                        </button>
                    );
                })}
            </div>

            {/* Grid table (full width) */}
            <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
                <div className="w-screen rounded-lg border border-gray-200 overflow-hidden bg-white isolate">
                    {/* header row: timeline */}
                    <div
                        className="grid border-b border-gray-200 bg-gray-50/70 text-xs text-gray-700 relative z-0"
                        style={{
                            gridTemplateColumns: `240px repeat(${TOTAL_SLOTS}, minmax(20px, 1fr))`,
                        }}
                    >
                        <div className="p-2 border-r border-gray-200 font-medium">Godzina</div>
                        <div className="relative">
                            <div className="relative">
                                {/* siatka kresek */}
                                <div
                                    className="grid"
                                    style={{gridTemplateColumns: `repeat(${TOTAL_SLOTS}, minmax(20px, 1fr))`}}
                                >
                                    {Array.from({length: TOTAL_SLOTS}).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`border-r ${i % SLOTS_PER_HOUR === 0 ? "border-gray-300" : "border-gray-100"}`}
                                        />
                                    ))}
                                </div>

                                {/* WIDOCZNE etykiety godzin — nakładka */}
                                <div
                                    className="grid absolute inset-0 z-10 h-8"
                                    style={{gridTemplateColumns: `repeat(${TOTAL_SLOTS}, minmax(20px, 1fr))`}}
                                >
                                    {labels.map((l) => (
                                        <div
                                            key={l.colStart}
                                            className="flex items-center justify-center text-[11px] font-medium text-gray-800"
                                            style={{gridColumn: `${l.colStart} / span ${SLOTS_PER_HOUR}`}}
                                        >
                                            {l.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* rows per location */}
                    {locations.map((loc) => {
                        const list = screeningsByLocation.get(loc.id) ?? [];
                        return (
                            <div
                                key={loc.id}
                                className="grid border-b border-gray-200 isolate"
                                style={{
                                    gridTemplateColumns: `240px repeat(${TOTAL_SLOTS}, minmax(20px, 1fr))`,
                                }}
                            >
                                {/* sticky location name */}
                                <div className="p-2 border-r border-gray-200 text-sm bg-white sticky left-0 z-10">
                                    <div className="font-medium">{loc.name}</div>
                                </div>

                                <div className="relative z-[1]">
                                    {/* background grid */}
                                    <div
                                        className="grid absolute inset-0 pointer-events-none z-0"
                                        style={{
                                            gridTemplateColumns: `repeat(${TOTAL_SLOTS}, minmax(20px, 1fr))`,
                                        }}
                                    >
                                        {Array.from({length: TOTAL_SLOTS}).map((_, i) => (
                                            <div
                                                key={i}
                                                className={`border-r ${
                                                    i % SLOTS_PER_HOUR === 0
                                                        ? "border-gray-200"
                                                        : "border-gray-100"
                                                }`}
                                            />
                                        ))}
                                    </div>

                                    {/* screenings tiles */}
                                    <div
                                        className="grid"
                                        style={{
                                            gridTemplateColumns: `repeat(${TOTAL_SLOTS}, minmax(20px, 1fr))`,
                                        }}
                                    >
                                        {list.map((s) => {
                                            const dt = new Date(s.startsAt);
                                            const startSlot = dateToSlot(dt);
                                            if (startSlot >= TOTAL_SLOTS || startSlot < 0) return null;

                                            const duration = estimateDurationMin(
                                                s.movieIds,
                                                db.moviesById
                                            );
                                            const span = Math.max(1, Math.ceil(duration / SLOT_MIN));
                                            const clampedSpan = Math.max(
                                                1,
                                                Math.min(span, TOTAL_SLOTS - startSlot)
                                            );

                                            const title = titleFor(s, db.moviesById);
                                            const contest =
                                                s.contestId != null
                                                    ? db.contestsById[String(s.contestId)]
                                                    : undefined;
                                            const palette = contestStyle(s.contestId ?? null);

                                            return (
                                                <div
                                                    key={s.id}
                                                    className={`m-0.5 z-50 rounded-lg border text-xs leading-tight p-2 shadow-sm hover:shadow transition-shadow ${palette.bg} ${palette.border}`}
                                                    style={{
                                                        gridColumn: `${startSlot + 1} / span ${clampedSpan}`,
                                                    }}
                                                    title={`${title} • ${dt.toLocaleTimeString("pl-PL", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })} • ${duration} min`}
                                                >
                                                    {/* subtle top accent line */}
                                                    <div className={`h-0.5 w-full rounded-full mb-1 ${palette.dot}`}/>

                                                    <div className="font-medium truncate text-gray-900">
                                                        {title || "Seans"}
                                                    </div>

                                                    <div className="text-[11px] text-gray-700 flex gap-2">
                        <span>
                          {dt.toLocaleTimeString("pl-PL", {
                              hour: "2-digit",
                              minute: "2-digit",
                          })}
                        </span>
                                                        <span>•</span>
                                                        <span>{formatMinutes(duration)}</span>
                                                    </div>

                                                    {contest?.name ? (
                                                        <div className={`text-[11px] truncate ${palette.text}`}>
                                                            {contest.name}
                                                        </div>
                                                    ) : null}

                                                    {s.accreditationOnly ? (
                                                        <div className="text-[10px] text-amber-800 mt-1">
                                                            Akredytacje
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="text-xs text-gray-600">
                Zakres czasu: 08:00–01:00, siatka co 10 min. Długość kafelka = max runtime
                z filmów (fallback 90).
            </div>
        </div>

    );
}
