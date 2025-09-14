// app/table/page.tsx
"use client";

import { Suspense } from "react";
import {useDb} from "@/hooks/useDb";
import ClientSchedule from "@/app/table/ClientSchedule";


export default function SchedulePage() {
    const { db, loading, error } = useDb();
    if (loading) return <div className="p-6">Ładowanie…</div>;
    if (error || !db) return <div className="p-6 text-red-600">Nie udało się wczytać bazy.</div>;

    return (
        <main className="mx-auto max-w-[1400px] px-4 py-6">
            <h1 className="text-2xl font-bold mb-4">Harmonogram</h1>
            <Suspense>
                <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
                   <ClientSchedule db={db} />
                 </div>
            </Suspense>
        </main>
    );
}
