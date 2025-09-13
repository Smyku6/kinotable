// "use client";
//
// import { useMemo, useState, useEffect } from "react";
// import TimetableSpans from "@/components/TimetableSpans";
// import type { Seans } from "@/lib/types";
// import { DatePills } from "@/components/DatePills";
// import { SectionPills } from "@/components/SectionPills";
//
// const sectionLabel = (s: string | null | undefined) => s ?? "(brak)";
//
// export default function Page() {
//     const [data, setData] = useState<Seans[]>([]);
//     const dates = useMemo(() => Array.from(new Set(data.map((s) => s.dzien))), [data]);
//     const [selectedDate, setSelectedDate] = useState<string | null>(null);
//
//     useEffect(() => {
//         (async () => {
//             try {
//                 const res = await fetch("/movies.json", { cache: "no-store" });
//                 const arr = (await res.json()) as Seans[];
//                 setData(arr);
//             } catch (e) {
//                 console.error("Nie udało się wczytać /movies.json", e);
//             }
//         })();
//     }, []);
//
//     // sekcje
//     const allSections = useMemo(() => {
//         const set = new Set<string>();
//         for (const s of data) set.add(sectionLabel((s as any).section));
//         return Array.from(set).sort((a, b) => a.localeCompare(b));
//     }, [data]);
//     const [selectedSections, setSelectedSections] = useState<string[]>([]);
//
//     // podsekcje: mapowanie sekcja -> unikalne podsekcje
//     const subsectionsMap = useMemo(() => {
//         const map = new Map<string, Set<string>>();
//         for (const s of data) {
//             const sec = sectionLabel((s as any).section);
//             const sub = (s as any).subsection as string | undefined;
//             if (!map.has(sec)) map.set(sec, new Set());
//             if (sub) map.get(sec)!.add(sub);
//         }
//         const obj: Record<string, string[]> = {};
//         for (const [k, v] of map) obj[k] = Array.from(v);
//         return obj;
//     }, [data]);
//
//     const [selectedSubsections, setSelectedSubsections] = useState<string[]>([]);
//
//     useEffect(() => {
//         if (!selectedDate && dates.length > 0) setSelectedDate(dates[0]!);
//         if (selectedDate && !dates.includes(selectedDate)) setSelectedDate(dates[0] ?? null);
//     }, [dates, selectedDate]);
//
//     const filteredData = useMemo(() => {
//         // 1) najpierw dzień
//         const byDate = selectedDate ? data.filter((s) => s.dzien === selectedDate) : [];
//
//         // 2) potem sekcje (puste = wszystkie)
//         const bySection =
//             selectedSections.length === 0
//                 ? byDate
//                 : byDate.filter((s) => selectedSections.includes(sectionLabel((s as any).section)));
//
//         // 3) podsekcje: jeżeli jakieś wybrane, to pokazujemy **całe** ich sekcje
//         if (selectedSubsections.length === 0) return bySection;
//
//         // znajdź sekcje, które mają co najmniej jedną zaznaczoną podsekcję
//         const sectionsWithSelectedSubs = new Set(
//             Object.entries(subsectionsMap)
//                 .filter(([, subs]) => subs.some((ss) => selectedSubsections.includes(ss)))
//                 .map(([sec]) => sec)
//         );
//
//         // dodaj te sekcje do wybranych (unikalne)
//         const effectiveSections =
//             selectedSections.length === 0
//                 ? Array.from(sectionsWithSelectedSubs)
//                 : Array.from(new Set([...selectedSections, ...sectionsWithSelectedSubs]));
//
//         // zwróć **całą** zawartość efektywnie wybranych sekcji (bez dalszego zawężania po sub)
//         if (effectiveSections.length === 0) return bySection;
//         return byDate.filter((s) => effectiveSections.includes(sectionLabel((s as any).section)));
//     }, [data, selectedDate, selectedSections, selectedSubsections, subsectionsMap]);
//
//     const allRooms = useMemo(() => {
//         const set = new Set<string>();
//         for (const s of data) set.add(s.salaKinowa);
//         return Array.from(set).sort((a,b)=>a.localeCompare(b));
//     }, [data]);
//     return (
//         <main className="space-y-6">
//             <section className="flex flex-col gap-4">
//                 <DatePills dates={dates} value={selectedDate} onChange={setSelectedDate} />
//                 <SectionPills
//                     sections={allSections}
//                     subsectionsMap={subsectionsMap}
//                     value={selectedSections}
//                     subValue={selectedSubsections}
//                     onChange={(nextSections, nextSubs) => {
//                         setSelectedSections(nextSections);
//                         setSelectedSubsections(nextSubs);
//                     }}
//                 />
//             </section>
//
//             <section>
//                 <TimetableSpans data={filteredData} day={selectedDate} slotMin={30}  roomsAll={allRooms}          />
//             </section>
//         </main>
//     );
// }
