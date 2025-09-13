"use client";


import { useState } from "react";
import type { Seans } from "@/lib/types";


async function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}


export default function FileLoader({ onLoad }: { onLoad: (data: Seans[]) => void }) {
    const [error, setError] = useState<string | null>(null);


    const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError(null);
        try {
            const text = await readFileAsText(file);
            const json = JSON.parse(text);
            if (!Array.isArray(json)) throw new Error("JSON must be an array of objects");

            // normalize helper
            const norm = (s: string) => (s ?? "").trim().replace(/\s+/g, " ");

            // 1) Wszystkie (z duplikatami) -> [{ title, runtime: 0 }, ...]
            const moviesAll = (json as Seans[]).map(s => ({
                title: norm(s?.tytul as string),
                runtime: 0,
            }));

            // 2) Unikalne po title (często wygodniejsze do listy)
            const uniqMap = new Map<string, { title: string; runtime: number }>();
            for (const m of moviesAll) if (m.title) uniqMap.set(m.title, m);
            const moviesUnique = Array.from(uniqMap.values()).sort((a, b) => a.title.localeCompare(b.title));

            // Logi do konsoli
            console.log("🎬 Filmy (wszystkie: %d):", moviesAll.length, moviesAll);
            console.log("🎬 Filmy (unikalne: %d):", moviesUnique.length, moviesUnique);
            console.table(moviesUnique);

            // Opcjonalnie wystaw do konsoli
            (window as any).__moviesAll__ = moviesAll;
            (window as any).__moviesUnique__ = moviesUnique;

            // Standardowe wczytanie do appki
            onLoad(json as Seans[]);
        } catch (err: any) {
            setError(err?.message || "Failed to load file");
        }
    };


    return (
        <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Wczytaj seanse (seanse.json):</label>
    <input type="file" accept="application/json,.json" onChange={onChange} className="text-sm" />
    {error && <span className="text-red-600 text-sm">{error}</span>}
        </div>
);
}