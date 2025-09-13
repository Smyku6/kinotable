export function DatePills({ dates, value, onChange }: { dates: string[]; value: string|null; onChange:(d:string)=>void }) {
    if (!dates.length) return null;
    return (
        <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-cream/80">Dzień:</span>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {dates.map(d => {
                    const active = d === value;
                    return (
                        <button
                            key={d}
                            type="button"
                            onClick={() => onChange(d)}
                            className={[
                                "whitespace-nowrap rounded-full px-3 py-1 text-sm border transition",
                                active
                                    ? "bg-gold-600 text-coal border-gold-600 shadow"
                                    : "bg-onyx text-cream/90 border-border hover:border-gold-600 hover:text-cream"
                            ].join(" ")}
                            aria-pressed={active}
                            title={d}
                        >
                            {d}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}