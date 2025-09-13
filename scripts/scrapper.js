(() => {
    const norm = (s) => (s ?? "").trim().replace(/\s+/g, " ");
    const isAll = (val, label) =>
        val === "-1" || norm(label).toLowerCase() === "wszystkie";

    // usuń prefiks liter + "-" (np. "m-60507" -> "60507"), a potem zamień na liczbę
    const stripPrefixToNum = (v) => {
        const s = String(v || "").trim().replace(/^[a-zA-Z]+-/, "");
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    };

    // Zbiera pary (value, label) z <select> oraz z custom dropdowna w danym kontenerze
    const collectPairs = (containerSel, selectSel = "select", customSel = ".select-items [data-value]") => {
        const root = document.querySelector(containerSel);
        if (!root) return [];

        const fromSelect = Array.from(root.querySelectorAll(`${selectSel} option`)).map(o => ({
            value: o.getAttribute("value") || "",
            label: norm(o.textContent || "")
        }));

        const fromCustom = Array.from(root.querySelectorAll(customSel)).map(div => ({
            value: div.getAttribute("data-value") || "",
            label: norm(div.textContent || "")
        }));

        // połącz i odfiltruj "Wszystkie"/-1
        const raw = [...fromSelect, ...fromCustom].filter(x => !isAll(x.value, x.label));

        // unikalne po value (pierwsze zwycięża)
        const byVal = new Map();
        raw.forEach(x => { if (!byVal.has(x.value)) byVal.set(x.value, x); });

        return Array.from(byVal.values());
    };

    // ZAPIS PLIKU
    const saveJSON = (filename, obj) => {
        const json = JSON.stringify(obj, null, 2);
        try {
            const blob = new Blob([json], { type: "application/json;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename; a.rel = "noopener"; a.style.display = "none";
            document.body.appendChild(a); a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
        } catch (e) {
            const encoded = encodeURIComponent(json);
            window.open(`data:application/json;charset=utf-8,${encoded}`, "_blank");
        }
    };

    // --- 1) Filmy ---
    const moviePairs = collectPairs('.select-box.filter-movie');
    const movies = moviePairs.map(({ value, label }) => ({
        id: stripPrefixToNum(value),
        movieTitle: label
    })).filter(x => x.id !== null)
        .sort((a, b) => a.movieTitle.localeCompare(b.movieTitle, "pl", { sensitivity: "base" }));

    console.table(movies);
    console.log("🎬 Filmy:", movies.length);
    saveJSON("movies.json", movies);

    // --- 2) Konkursy (contests) ---
    const contestPairs = collectPairs('.select-box.filter-contest');
    const contests = contestPairs.map(({ value, label }) => ({
        contestId: stripPrefixToNum(value),
        contestName: label
    })).filter(x => x.contestId !== null)
        .sort((a, b) => a.contestName.localeCompare(b.contestName, "pl", { sensitivity: "base" }));

    console.table(contests);
    console.log("🏆 Konkursy:", contests.length);
    saveJSON("contests.json", contests);

    // --- 3) Sale (locations) ---
    const locationPairs = collectPairs('.select-box.filter-location-room');
    const locations = locationPairs.map(({ value, label }) => ({
        locationId: stripPrefixToNum(value),
        locationName: label
    })).filter(x => x.locationId !== null)
        .sort((a, b) => a.locationName.localeCompare(b.locationName, "pl", { sensitivity: "base" }));

    console.table(locations);
    console.log("🏛️ Lokacje:", locations.length);
    saveJSON("locations.json", locations);

    // (opcjonalnie) skopiuj wszystko do schowka
    if (navigator.clipboard && window.isSecureContext) {
        const bundle = { movies, contests, locations };
        navigator.clipboard.writeText(JSON.stringify(bundle, null, 2))
            .then(() => console.log("📋 Skopiowano zestaw JSON do schowka"));
    }

    return { movies, contests, locations };
})();
