export type IsoDate = string;      // e.g. "2025-09-22"
export type TimeHHmm = string;     // e.g. "09:30"

export interface ScreeningData {
    screeningId: string; // from data-screening
    title: string;       // from data-title
    date: IsoDate;       // from data-date
    time: TimeHHmm;      // from data-time
    room: string;        // from data-sala
    place: string;     // from data-miejsce
}
