export const parseTimeToMinutes = (hhmm: string): number => {
    const m = /^([0-2]?\d):([0-5]\d)$/.exec(hhmm.trim());
    if (!m) return Number.POSITIVE_INFINITY;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    return h * 60 + min;
};