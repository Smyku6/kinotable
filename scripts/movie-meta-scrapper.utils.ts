/**
 * Parse a human-readable runtime string into total minutes.
 *
 * Supported examples:
 *  - "1 godz. 20 min"      → 80
 *  - "1 godz 20 min"       → 80
 *  - "1g 20m"              → 80
 *  - "1 h 5 m"             → 65
 *  - "1h"                  → 60
 *  - "80 min"              → 80
 *  - "80"                  → 80      (fallback: plain number means minutes)
 *
 * Returns:
 *  - number of minutes (integer) when a positive duration can be derived
 *  - null when parsing fails or the computed duration is zero/non-positive
 */
export function parseRuntimeToMinutes(runtimeText: string | null | undefined, originalTitle: string): number | null {
    // Toggle this to silence warnings globally.
    const ENABLE_WARNINGS = true;

    const warn = (msg: string, extra?: unknown) => {
        if (!ENABLE_WARNINGS) return;
        // starannie sformatowany warning z kontekstem
        if (extra !== undefined) {
            console.warn(`${originalTitle} - [parseRuntimeToMinutes] ${msg}`, extra);
        } else {
            console.warn(`${originalTitle} - [parseRuntimeToMinutes] ${msg}`);
        }
    };

    // 1) Guard: nullish/empty input → nothing to parse
    if (runtimeText == null) {
        warn(`${originalTitle} - Input is null/undefined; returning null.`);
        return null;
    }

    // 2) Normalize the input (NBSP → space, trim, lowercase)
    const normalized = String(runtimeText)
        .replace(/\u00A0/g, " ")
        .trim()
        .toLowerCase();

    if (normalized.length === 0) {
        warn(`${originalTitle} - Input is an empty string after normalization; returning null.`, { input: runtimeText });
        return null;
    }

    // 3) Prepare accumulators for hours and minutes
    let hours = 0;
    let minutes = 0;

    // 4) Tolerant regexes for hours/minutes
    const hoursMatch = normalized.match(/(\d+)\s*(godz\.?|g|h)/i);
    const minutesMatch = normalized.match(/(\d+)\s*(min\.?|m)/i);

    // 5) Hours
    if (hoursMatch) {
        const parsedHours = parseInt(hoursMatch[1], 10);
        if (Number.isFinite(parsedHours)) {
            hours = parsedHours;
        } else {
            warn(`${originalTitle} - Failed to parse hours numeric value.`, { input: runtimeText, captured: hoursMatch[1] });
        }
    }

    // 6) Minutes
    if (minutesMatch) {
        const parsedMinutes = parseInt(minutesMatch[1], 10);
        if (Number.isFinite(parsedMinutes)) {
            minutes = parsedMinutes;
        } else {
            warn(`${originalTitle} - Failed to parse minutes numeric value.`, { input: runtimeText, captured: minutesMatch[1] });
        }
    }

    // 7) Fallback: bare number → minutes
    let usedFallback = false;
    if (!hoursMatch && !minutesMatch) {
        const bareNumber = normalized.match(/(\d{1,3})/); // typical runtimes
        if (bareNumber) {
            const parsedBare = parseInt(bareNumber[1], 10);
            if (Number.isFinite(parsedBare)) {
                minutes = parsedBare;
                usedFallback = true;
            } else {
                warn(`${originalTitle} - Bare number fallback found but not parseable.`, { input: runtimeText, captured: bareNumber[1] });
            }
        } else {
            warn(`${originalTitle} - No hours/minutes units detected and no bare number found; returning null.`, { input: runtimeText });
            return null;
        }
    }

    // 8) Compute total minutes
    const totalMinutes = hours * 60 + minutes;

    // 9) Validate and return
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
        warn(`${originalTitle} - Computed total minutes is non-positive or NaN; returning null.`, {
            input: runtimeText,
            hours,
            minutes,
            totalMinutes
        });
        return null;
    }

    // 10) Soft warning if we had to use the fallback
    if (usedFallback) {
        warn(`${originalTitle} - Used bare-number fallback (interpreted as minutes).`, { input: runtimeText, totalMinutes });
    }

    return totalMinutes;
}


/**
 * Extract a normalized list of directors from the film "info" block.
 *
 * Strategy:
 *  1) Prefer anchor-based directors: `.details-directors a` (each <a> → one person)
 *  2) If there are no anchors, fallback to raw text inside `.details-directors`,
 *     remove a prefix like "reż." and split on commas.
 *
 * Returns:
 *  - string[] with at least one name (unique, trimmed) on success
 *  - null if nothing could be extracted (also logs a warning)
 */
export function extractDirectorsListFromInfoBlock(
    infoRoot: Element | Document | null,
    originalTitle: string,
    enableWarnings: boolean = true
): string[] {
    const warn = (message: string, extra?: unknown) => {
        if (!enableWarnings) return;
        // Nice, contextual warning
        if (extra !== undefined) {
            console.warn(`${originalTitle} [extractDirectors] ${message}`, extra);
        } else {
            console.warn(`${originalTitle} [extractDirectors] ${message}`);
        }
    };

    // Helper: normalize whitespace and remove NBSPs
    const normalizeWhitespace = (value: unknown): string =>
        String(value ?? "")
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    if (!infoRoot) {
        warn(`${originalTitle} Missing infoRoot element; cannot search for .details-directors.`);
        return [];
    }

    // 1) Try anchor-based extraction
    const anchorNodes = Array.from(
        infoRoot.querySelectorAll<HTMLAnchorElement>(".details-directors a")
    );

    let names: string[] = anchorNodes
        .map((a) => normalizeWhitespace(a.textContent))
        .filter((txt) => txt.length > 0);

    // 2) Fallback: raw text inside `.details-directors`
    if (names.length === 0) {
        const rawDirectorsText = normalizeWhitespace(
            infoRoot.querySelector(".details-directors")?.textContent || ""
        );

        if (!rawDirectorsText) {
            warn(`${originalTitle} No directors found: .details-directors is empty or missing.`);
            return [];
        }

        // Remove a common Polish prefix like "reż." / "reż"
        // You can add more variants here if needed (e.g., "reżyseria:")
        const withoutPrefix = rawDirectorsText.replace(/^reż\.\s*|^reż\s*/i, "").trim();

        if (!withoutPrefix) {
            warn(`${originalTitle} Directors text exists but became empty after removing prefix.`, {
                raw: rawDirectorsText,
            });
            return [];
        }

        // Split by commas; trim, drop empties
        names = withoutPrefix
            .split(",")
            .map((s) => normalizeWhitespace(s))
            .filter(Boolean);
    }

    // 3) Deduplicate while preserving order
    const uniqueNames = Array.from(new Set(names));

    if (uniqueNames.length === 0) {
        warn(`${originalTitle} Directors parsing yielded an empty list after normalization.`);
        return [];
    }

    return uniqueNames;
}
