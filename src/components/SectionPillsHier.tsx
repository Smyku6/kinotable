// src/components/SectionPills.tsx

import { getSectionPillStyles } from "@/styles/sectionStyles";



export function SectionPills({
                                 sections,
                                 value,
                                 onChange,
                             }: {
    sections: string[];
    value: string[];
    onChange: (next: string[]) => void;
}) {
    const toggle = (s: string) => {
        const set = new Set(value);
        set.has(s) ? set.delete(s) : set.add(s);
        onChange(Array.from(set));
    };
    const isAll = value.length === 0;

    return (
        <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-cream/80">Sekcje:</span>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                <button
                    type="button"
                    onClick={() => onChange([])}
                    className={[
                        "whitespace-nowrap rounded-full px-3 py-1 text-sm transition",
                        isAll
                            ? "bg-gold-600 text-coal border border-gold-600 shadow"
                            : "bg-onyx text-cream/90 border border-border hover:border-gold-600",
                    ].join(" ")}
                >
                    Wszystkie
                </button>

                {sections.map((s) => {
                    const active = value.includes(s);
                    const styles = getSectionPillStyles(s); // s = nazwa sekcji
                    return (
                        <button
                            key={s}
                            type="button"
                            onClick={() => toggle(s)}
                            className={["whitespace-nowrap rounded-full px-3 py-1 text-sm transition", active ? styles.active : styles.idle].join(" ")}
                            aria-pressed={active}
                            title={s}
                        >
                            {s}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}