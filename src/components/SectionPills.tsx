import { getSectionPillStyles } from "@/styles/sectionStyles";

export function SectionPills({
                                 sections,              // np. ["Konkurs Główny","Specjalne",...]
                                 subsectionsMap,        // mapowanie: sekcja -> ["Gala","Pokaz specjalny",...]
                                 value,                 // wybrane sekcje (multi; puste = wszystkie)
                                 subValue,              // wybrane podsekcje (multi; puste = wszystkie)
                                 onChange,              // (nextSections, nextSubsections)
                             }: {
    sections: string[];
    subsectionsMap: Record<string, string[]>;
    value: string[];
    subValue: string[];
    onChange: (nextSections: string[], nextSubsections: string[]) => void;
}) {
    const toggleSection = (s: string) => {
        const set = new Set(value);
        set.has(s) ? set.delete(s) : set.add(s);

        // oczyść podsekcje, których nie ma w aktualnie aktywnych sekcjach
        const allowedSubs = new Set(
            (set.size ? Array.from(set) : sections).flatMap(sec => subsectionsMap[sec] ?? [])
        );
        const nextSubs = subValue.filter(ss => allowedSubs.has(ss));
        onChange(Array.from(set), nextSubs);
    };

    const toggleSub = (sec: string, ss: string) => {
        const wasSectionSelected = value.includes(sec);

        // Toggling podsekcji
        const subSet = new Set(subValue);
        if (subSet.has(ss)) subSet.delete(ss);
        else subSet.add(ss);

        // Ile podsekcji tej sekcji zostaje po toggle?
        const subsOfSec = new Set(subsectionsMap[sec] ?? []);
        const hasAnySubOfSec = Array.from(subSet).some(x => subsOfSec.has(x));

        let nextSections = value;

        if (!wasSectionSelected) {
            if (hasAnySubOfSec) {
                // wybrano pierwszą podsekcję tej sekcji → dołącz sekcję
                nextSections = [...value, sec];
            } else {
                // odznaczono ostatnią podsekcję tej sekcji → zdejmij auto-dodawaną sekcję
                nextSections = value.filter(s => s !== sec);
            }
        }
        onChange(nextSections, Array.from(subSet));
    };


    const isAll = value.length === 0;

    return (
        <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-cream/80">Sekcje:</span>

            <div className="flex flex-wrap gap-3">
                {/* 'Wszystkie' */}
                <div className="flex flex-col">
                    <button
                        type="button"
                        onClick={() => onChange([], [])}
                        className={[
                            "whitespace-nowrap rounded-full px-3 py-1 text-sm transition border",
                            isAll
                                ? "bg-gold-600 text-coal border-gold-600 shadow"
                                : "bg-onyx text-cream/90 border-border hover:border-gold-600",
                        ].join(" ")}
                    >
                        Wszystkie
                    </button>
                </div>

                {/* Sekcje + (pod spodem) ich podsekcje gdy aktywne */}
                {sections.map((sec) => {
                    const active = value.includes(sec);
                    const styles = getSectionPillStyles(sec);
                    const subs = subsectionsMap[sec] ?? [];
                    const showSubs = active && subs.length > 0;

                    return (
                        <div key={sec} className="flex flex-col items-start gap-2">
                            <button
                                type="button"
                                onClick={() => toggleSection(sec)}
                                className={[
                                    "whitespace-nowrap rounded-full px-3 py-1 text-sm transition",
                                    active ? styles.active : styles.idle,
                                    active ? "ring-2 ring-offset-0 ring-current/40" : "",
                                ].join(" ")}
                                aria-pressed={active}
                                title={sec}
                            >
                                {sec}
                            </button>

                            {showSubs && (
                                <div className="flex flex-wrap gap-2 pl-2">
                                    {subs.map((ss) => {
                                        const ssActive = subValue.includes(ss);
                                        const idle = styles.idle
                                            .replace("bg-onyx", "bg-coal")
                                            .replace("text-cream/90", "text-cream/80");
                                        const act = styles.active;

                                        return (
                                            <button
                                                key={ss}
                                                type="button"
                                                onClick={() => toggleSub(sec, ss)}
                                                className={[
                                                    "whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs transition border",
                                                    ssActive ? act : idle,
                                                ].join(" ")}
                                                aria-pressed={ssActive}
                                                title={`${sec} — ${ss}`}
                                            >
                                                {ss}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
