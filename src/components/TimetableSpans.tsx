// import React, { useMemo } from "react";
// import {moviesWithRuntime} from "@/components/moviesWithRuntime";
// import { getSectionBlockStyles } from "@/styles/sectionStyles";
//
// const ADS_MINUTES = 10;
//
// export type Seans = {
//     dzien: string;
//     godzina: string; // HH:MM
//     tytul: string;
//     salaKinowa: string;
//     runtimeMin?: number; // w przyszłości
// };
//
// const toMin = (hhmm: string) => {
//     const m = /^([0-2]?\d):([0-5]\d)$/.exec(hhmm.trim());
//     if (!m) return 0;
//     return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
// };
//
// const uniq = <T,>(a: T[]) => Array.from(new Set(a));
//
// // prosta normalizacja tytułów
// const norm = (s: string) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
//
// // jednorazowy indeks: tytuł → runtime
// const RUNTIME_INDEX = new Map<string, number>(
//     moviesWithRuntime.map(m => [norm(m.title), m.runtime])
// );
//
// // NOWA wersja pickRuntime: lookup w mapie + fallback
// const pickRuntime = (title: string): number => {
//     return RUNTIME_INDEX.get(norm(title)) ?? 0; // fallback np. 90, albo 0 jeśli wolisz
// };
//
//
// const floorTo = (x: number, step: number) => Math.floor(x / step) * step;
// const ceilTo = (x: number, step: number) => Math.ceil(x / step) * step;
//
// function buildSlots(minStart: number, maxEnd: number, slotMin: number): number[] {
//     const start = floorTo(minStart, slotMin);
//     const end = ceilTo(maxEnd, slotMin);
//     const out: number[] = [];
//     for (let t = start; t <= end; t += slotMin) out.push(t);
//     return out;
// }
//
// function fmtHM(totalMin: number) {
//     const h = Math.floor(totalMin / 60).toString().padStart(2, "0");
//     const m = (totalMin % 60).toString().padStart(2, "0");
//     return `${h}:${m}`;
//
// }function fmtDuration(min: number) {
//     const h = Math.floor(min / 60);
//     const m = min % 60;
//     if (h && m) return `${h}h ${m}min`;
//     if (h && !m) return `${h}h`;
//     return `${m} min`;
// }
//
// function HourHeader({ slots, slotMin }: { slots: number[]; slotMin: number }) {
//     // renderuj pełne godziny jako agregaty kolumn (bez tła komórkowego)
//     const step = 60 / slotMin; // ile slotów na godzinę
//     return (
//         <div className="sticky top-0 z-10 bg-onyx border-b border-border">
//             <div
//                 className="grid text-sm font-semibold text-center w-full text-cream/80"
//                 style={{gridTemplateColumns: `repeat(${slots.length - 1}, minmax(50px, 1fr))`}}
//             >
//                 {slots.slice(0, -1).map((t, i) => (
//                     <div key={i} className="p-2 border-l border-border">
//                         {t % 60 === 0 ? fmtHM(t) : ""}
//                     </div>
//                 ))}
//             </div>
//         </div>
//     );
// }
//
// function RoomRow({
//                      room,
//                      items,
//                      slots,
//                      slotMin,
//                  }: {
//     room: string;
//     items: Seans[];
//     slots: number[];
//     slotMin: number;
// }) {
//     const blocks = items
//         .map((s) => {
//             const start = toMin(s.godzina);
//             const dur = s.runtimeMin ?? pickRuntime(s.tytul);
//             const end = start + dur;
//             const startIdx = Math.max(1, Math.floor((start - slots[0]) / slotMin) + 1);
//             const endIdx = Math.max(startIdx + 1, Math.ceil((end - slots[0]) / slotMin) + 1);
//             const span = Math.min(Math.max(1, endIdx - startIdx), Math.max(1, slots.length - startIdx));
//             return { s, start, end, startIdx, span, dur };
//         })
//         .sort((a, b) => a.start - b.start || a.s.tytul.localeCompare(b.s.tytul));
//
//     return (
//         <div className="grid" style={{ gridTemplateColumns: `280px 1fr` }}>
//             <div
//                 className="sticky left-0 bg-coal border-r border-border p-3 font-medium truncate text-cream"
//                 title={room}
//             >
//                 {room}
//             </div>
//
//             <div className="border-b border-border">
//                 <div
//                     className="grid relative p-2 gap-x-1 w-full"
//                     style={{ gridTemplateColumns: `repeat(${slots.length - 1}, minmax(50px, 1fr))` }}
//                 >
//                     {blocks.length === 0 ? (
//                         // ⬇️ pusty wiersz (bez kafelków), ale z zajętą szerokością siatki
//                         <div className="col-span-full h-8 flex items-center text-cream/35 text-xs select-none">
//                             {/* Możesz usunąć tekst jeśli chcesz zupełnie pusto */}
//                             Brak seansów w tym dniu/filtrach
//                         </div>
//                     ) : (
//                         blocks.map((b, idx) => {
//                             const sec = (b.s as any).section;
//                             const st = getSectionBlockStyles(sec);
//                             const titles = (b.s as any).titles as string[] | undefined;
//                             const hasTitles = Array.isArray(titles) && titles.length > 0;
//
//                             return (
//                                 <div
//                                     key={idx}
//                                     className="flex items-center"
//                                     style={{ gridColumn: `${b.startIdx} / span ${b.span}` }}
//                                 >
//                                     <div className="relative group w-full">
//                                         <div
//                                             className={[
//                                                 "rounded-lg px-3 py-1 text-xs md:text-sm overflow-hidden text-ellipsis border transition",
//                                                 st.bg,
//                                                 st.border,
//                                                 st.text,
//                                                 hasTitles ? "cursor-help" : "",
//                                             ].join(" ")}
//                                             title={hasTitles ? titles!.join(", ") : b.s.tytul}
//                                             aria-label={hasTitles ? `Pakiet shortów: ${titles!.join(", ")}` : b.s.tytul}
//                                         >
//                                             <div className="font-medium truncate" title={b.s.tytul}>
//                                                 {b.s.tytul}
//                                             </div>
//                                             <div className="opacity-70">
//                                                 {fmtHM(b.start)}–{fmtHM(b.end + ADS_MINUTES)} • {fmtDuration(b.dur)}
//                                             </div>
//                                         </div>
//
//                                         {hasTitles && (
//                                             <div
//                                                 role="tooltip"
//                                                 className="
//                           pointer-events-none absolute left-0 top-full mt-1 z-20
//                           max-w-[420px] whitespace-normal
//                           rounded-md border border-border bg-onyx text-cream text-xs
//                           px-3 py-2 shadow-xl
//                           opacity-0 translate-y-1 transition
//                           group-hover:opacity-100 group-hover:translate-y-0
//                         "
//                                             >
//                                                 <div className="mb-1 font-semibold text-cream/90">W pakiecie:</div>
//                                                 <ul className="list-disc pl-5 space-y-0.5">
//                                                     {titles!.map((t, i) => (
//                                                         <li key={i}>{t}</li>
//                                                     ))}
//                                                 </ul>
//                                             </div>
//                                         )}
//                                     </div>
//                                 </div>
//                             );
//                         })
//                     )}
//                 </div>
//             </div>
//         </div>
//     );
// }
//
// export default function TimetableSpans({
//                                            data,
//                                            day,
//                                            slotMin = 15,
//                                            roomsAll,            // ⬅️ NOWE
//                                        }: {
//     data: Seans[];
//     day: string | null;
//     slotMin?: number;
//     roomsAll?: string[]; // ⬅️ NOWE
// }) {
//     const filtered = useMemo(() => (day ? data.filter((s) => s.dzien === day) : []), [data, day]);
//
//     // ⬇️ jeśli podano roomsAll, użyj jej; inaczej wróć do starego zachowania
//     const rooms = useMemo(
//         () => (roomsAll?.length ? roomsAll : Array.from(new Set(filtered.map((s) => s.salaKinowa))).sort((a,b)=>a.localeCompare(b))),
//         [filtered, roomsAll]
//     );
//     const { slots } = useMemo(() => {
//         if (filtered.length === 0) return { slots: [8 * 60, 9 * 60] };
//         let minStart = Infinity;
//         let maxEnd = -Infinity;
//         for (const s of filtered) {
//             const start = toMin(s.godzina);
//             const dur = s.runtimeMin ?? pickRuntime(s.tytul);
//             const end = start + dur;
//             if (start < minStart) minStart = start;
//             if (end > maxEnd) maxEnd = end;
//         }
//         minStart -= 15;
//         maxEnd += 15;
//         return { slots: buildSlots(minStart, maxEnd, slotMin) };
//     }, [filtered, slotMin]);
//
//     if (!day) return <p className="text-sm text-gray-600">Wybierz dzień.</p>;
//     if (filtered.length === 0) return <p className="text-sm text-gray-600">Brak seansów dla wybranego dnia.</p>;
//
//     return (
//         <div className="overflow-auto border border-border rounded-xl bg-onyx">
//             <div className="grid" style={{gridTemplateColumns: `280px 1fr`}}>
//                 <div className="sticky top-0 z-10 bg-onyx border-b border-border p-3 font-semibold text-cream">Sala
//                 </div>
//                 <HourHeader slots={slots} slotMin={slotMin}/>
//             </div>
//             {rooms.map((room) => (
//                 <RoomRow key={room} room={room} items={filtered.filter((s) => s.salaKinowa === room)} slots={slots}
//                          slotMin={slotMin}/>
//             ))}
//         </div>
//     );
// }