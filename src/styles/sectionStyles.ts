// Jedno źródło prawdy dla kolorów sekcji
type StylePair = { idle: string; active: string };
type BlockStyle = { bg: string; border: string; text: string };

const SECTION_STYLES: Record<string, StylePair> = {
    "Konkurs Główny": {
        idle: "bg-onyx text-cream/90 border border-gold-700/50 hover:border-gold-500",
        active: "bg-gold-600 text-coal border border-gold-600 shadow",
    },
    "Konkurs Filmów Krótkometrażowych": {
        idle: "bg-onyx text-cream/90 border border-indigo-700/50 hover:border-indigo-500",
        active: "bg-indigo-600 text-white border border-indigo-600 shadow",
    },
    Panorama: {
        idle: "bg-onyx text-cream/90 border border-emerald-700/50 hover:border-emerald-500",
        active: "bg-emerald-600 text-white border border-emerald-600 shadow",
    },
    Specjalne: {
        idle: "bg-onyx text-cream/90 border border-rose-700/50 hover:border-rose-500",
        active: "bg-rose-600 text-white border border-rose-600 shadow",
    },
    "(brak)": {
        idle: "bg-onyx text-cream/80 border border-slate-700/50 hover:border-slate-500",
        active: "bg-slate-600 text-white border border-slate-600 shadow",
    },
};

// fallback dla nieznanych sekcji
const FALLBACKS: StylePair[] = [
    { idle: "bg-onyx text-cream/90 border border-sky-700/50 hover:border-sky-500",    active: "bg-sky-600 text-white border border-sky-600 shadow" },
    { idle: "bg-onyx text-cream/90 border border-violet-700/50 hover:border-violet-500", active: "bg-violet-600 text-white border border-violet-600 shadow" },
    { idle: "bg-onyx text-cream/90 border border-amber-700/50 hover:border-amber-500",   active: "bg-amber-600 text-coal border border-amber-600 shadow" },
    { idle: "bg-onyx text-cream/90 border border-cyan-700/50 hover:border-cyan-500",     active: "bg-cyan-600 text-white border border-cyan-600 shadow" },
];

const pickFallback = (key: string): StylePair => {
    let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    return FALLBACKS[Math.abs(h) % FALLBACKS.length];
};

export const sectionLabel = (s?: string | null) => s ?? "(brak)";

export function getSectionPillStyles(section?: string | null): StylePair {
    const key = sectionLabel(section);
    return SECTION_STYLES[key] ?? pickFallback(key);
}

// Dodatkowo styl dla „kafelków” filmów (blok na osi czasu)
export function getSectionBlockStyles(section?: string | null): BlockStyle {
    const pair = getSectionPillStyles(section);
    // aktywny → rozbijamy na bg/border/text (prosty parser klas)
    // Możesz doprecyzować ręcznie per sekcja – poniżej sensowny default:
    if (pair.active.includes("bg-gold-600")) return { bg: "bg-coal", border: "border-gold-600", text: "text-cream" };
    if (pair.active.includes("bg-indigo-600")) return { bg: "bg-coal", border: "border-indigo-600", text: "text-cream" };
    if (pair.active.includes("bg-emerald-600")) return { bg: "bg-coal", border: "border-emerald-600", text: "text-cream" };
    if (pair.active.includes("bg-rose-600")) return { bg: "bg-coal", border: "border-rose-600", text: "text-cream" };
    if (pair.active.includes("bg-sky-600")) return { bg: "bg-coal", border: "border-sky-600", text: "text-cream" };
    if (pair.active.includes("bg-violet-600")) return { bg: "bg-coal", border: "border-violet-600", text: "text-cream" };
    if (pair.active.includes("bg-amber-600")) return { bg: "bg-coal", border: "border-amber-600", text: "text-cream" };
    if (pair.active.includes("bg-cyan-600")) return { bg: "bg-coal", border: "border-cyan-600", text: "text-cream" };
    return { bg: "bg-coal", border: "border-border", text: "text-cream" };
}
