// src/components/MoviePill.tsx
import { getSectionPillStyles } from "@/styles/sectionStyles";

export default function MoviePill({ title, section }: { title: string; section?: string | null }) {
    const s = getSectionPillStyles(section);
    return (
        <div className={["inline-block text-xs md:text-sm rounded-full px-3 py-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-full border transition", s.idle].join(" ")}>
            {title}
        </div>
    );
}
