"use client";

import { useEffect, useState } from "react";
import {Db} from "../../scripts/build-db.types";

export function useDb() {
    const [db, setDb] = useState<Db | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const base = process.env.NEXT_PUBLIC_BASE_PATH ? `/${process.env.NEXT_PUBLIC_BASE_PATH}` : "";
                console.log({base})
                const res = await fetch(`${base}/data/build/db.json`, { cache: "no-store" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as Db;
                if (alive) setDb(json);
            } catch (e) {
                if (alive) setError("Failed to load db.json");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    return { db, error, loading };
}
