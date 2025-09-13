// "use client";
//
//
// import { useMemo } from "react";
// import type { Seans } from "@/lib/types";
// import { parseTimeToMinutes } from "@/lib/time";
// import MoviePill from "@/components/MoviePill";
//
//
// const uniq = <T,>(arr: T[]): T[] => Array.from(new Set(arr));
// const byTimeAsc = (a: string, b: string) => parseTimeToMinutes(a) - parseTimeToMinutes(b);
//
//
// export default function Timetable({ data, day }: { data: Seans[]; day: string | null }) {
//     const filtered = useMemo(() => (day ? data.filter((s) => s.dzien === day) : []), [data, day]);
//
//
//     const rooms = useMemo(
//         () => uniq(filtered.map((s) => s.salaKinowa)).sort((a, b) => a.localeCompare(b)),
//         [filtered]
//     );
//
//
//     const times = useMemo(
//         () => uniq(filtered.map((s) => s.godzina)).sort(byTimeAsc),
//         [filtered]
//     );
//
//
//     const byRoomAndTime = useMemo(() => {
//         const map = new Map<string, Map<string, Seans[]>>();
//         for (const s of filtered) {
//             if (!map.has(s.salaKinowa)) map.set(s.salaKinowa, new Map());
//             const inner = map.get(s.salaKinowa)!;
//             if (!inner.has(s.godzina)) inner.set(s.godzina, []);
//             inner.get(s.godzina)!.push(s);
//         }
//         return map; // Map<room, Map<time, Seans[]>>
//     }, [filtered]);
//
//
//     if (!day) return <p className="text-sm text-gray-600">Wybierz dzień, aby zobaczyć plan projekcji.</p>;
//     if (filtered.length === 0) return <p className="text-sm text-gray-600">Brak seansów dla wybranego dnia.</p>;
//
// return (
//     <div className="overflow-auto border rounded-xl bg-white">
//         <div className="min-w-[720px]">
//             <div className="grid" style={{ gridTemplateColumns: `280px repeat(${times.length}, minmax(120px, 1fr))` }}>
//                 {/* Header */}
//                 <div className="sticky top-0 z-10 bg-white border-b p-3 font-semibold">Sala</div>
//                 {times.map((t) => (
//                     <div key={t} className="sticky top-0 z-10 bg-white border-b p-3 text-sm font-semibold text-center" title={t}>
//                         {t}
//                     </div>
//                 ))}
//
//
//                 {/* Rows */}
//                 {rooms.map((room) => (
//                     <>
//                         <div key={`label:${room}`} className="sticky left-0 bg-white border-r p-3 font-medium" title={room}>
//                             <div className="truncate max-w-[260px]" aria-label="Sala">
//                                 {room}
//                             </div>
//                         </div>
//                         {times.map((t) => {
//                             const items = byRoomAndTime.get(room)?.get(t) ?? [];
//                             return (
//                                 <div key={`${room}:${t}`} className="border p-2">
//                                     {items.length > 0 ? (
//                                         <div className="flex flex-wrap gap-2">
//                                             {items.map((s, idx) => (
//                                                 <MoviePill key={idx} title={s.tytul} section={(s as any).section}/>
//                                             ))}
//                                         </div>
//                                     ) : (
//                                         <span className="block h-6" />
//                                     )}
//                                 </div>
//                             );
//                         })}
//                     </>
//                 ))}
//             </div>
//         </div>
//     </div>
// );
// }