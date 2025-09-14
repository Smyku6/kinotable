import {ContestsOverride, ContestsOverrideSchema} from "./build-db";

import path from "node:path";
import {z} from "zod";
import {promises as fs} from "fs";

export async function writeJson(filePath: string, data: unknown) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function readJson<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
    let raw: string;
    try {
        raw = await fs.readFile(filePath, "utf8");
    } catch (e) {
        console.error(`❌ Cannot read file: ${filePath}`);
        throw e;
    }

    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch (e: any) {
        // Pretty diagnostic: show context around the error position if available
        const msg = String(e?.message || e);
        const m = msg.match(/position\s+(\d+)/i);
        let ctx = "";
        if (m) {
            const pos = Number(m[1]);
            const start = Math.max(0, pos - 80);
            const end = Math.min(raw.length, pos + 80);
            const snippet = raw.slice(start, end);
            const caret = " ".repeat(Math.max(0, pos - start)) + "^";
            ctx = `\n--- JSON context (~pos ${pos}) ---\n${snippet}\n${caret}\n-------------------------------`;
        }
        console.error(`❌ JSON.parse error in ${filePath}: ${msg}${ctx}`);
        console.error("💡 Common causes: stray comma, comments, BOM, or multiple JSON objects concatenated.");
        throw e;
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
        console.error(`❌ Schema error in ${filePath}`);
        console.error(parsed.error.issues);
        throw new Error(`Invalid JSON schema for ${path.basename(filePath)}`);
    }
    return parsed.data;
}

/** Read override if exists; if missing create a scaffold and return it */
const OVERRIDE_FILE = '../public/data/override/contests-override.json';
export async function readOrInitOverride(contests: { contestId: number; contestName: string }[]): Promise<ContestsOverride> {
    try {
        const data = await readJson<ContestsOverride>(OVERRIDE_FILE, ContestsOverrideSchema);
        // auto-sync: dopisz brakujące konkursy jako szkic (bez zmiany istniejących)
        let mutated = false;
        for (const c of contests) {
            const key = String(c.contestId);
            if (!data.items[key]) {
                data.items[key] = { /* inherit defaults; user zdecyduje */ };
                mutated = true;
            }
        }
        if (mutated) {
            await writeJson(OVERRIDE_FILE, data);
            console.log("📝 contests-override.json synced with new contests");
        }
        return data;
    } catch {
        // brak pliku → zbuduj szkic
        const items: Record<string, { isVisibleInFilters?: boolean; order?: number; name?: string }> = {};
        let order = 10;
        for (const c of contests) {
            items[String(c.contestId)] = {
                // startowo nic nie wymuszamy—zadziała defaultVisible
                // możesz też ustawić order rosnąco, żeby od razu dać stabilny porządek:
                order: order,
                name: c.contestName,
                isVisibleInFilters: true,
            };
            order += 10;
        }
        const initial: ContestsOverride = { $version: 1, items };
        await writeJson(OVERRIDE_FILE, initial);
        console.log("🆕 Created contests-override.json (scaffold)");
        return initial;
    }
}
