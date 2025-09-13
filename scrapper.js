(() => {
    // == helpers ==
    const isVisible = (el) => {
        for (let n = el; n && n !== document.body; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        }
        return true;
    };
    const txt = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ');
    const safe = (s) => (s == null ? '' : String(s));

    // == 1) mapa dayNum -> pełny tekst daty ==
    const dayHeaders = Array.from(document.querySelectorAll('tr.item-day-row[data-day]'))
        .filter(tr => tr.querySelector('.day-title'));
    const dayMap = new Map(
        dayHeaders.map(tr => {
            const dayNum = tr.getAttribute('data-day') || [...tr.classList].find(c => /^item-day-\d+$/.test(c))?.split('-').pop();
            const dayText = tr.querySelector('.day-title')?.textContent?.trim().replace(/\s+/g, ' ') || dayNum || '';
            return [dayNum, dayText];
        })
    );

    // == 2) wszystkie wiersze seansów (widoczne) ==
    const allRows = Array.from(document.querySelectorAll('tr[class*="item-id-"][class*="item-day-"]'));
    const movieRows = allRows.filter(tr => isVisible(tr));

    // kolekcjoner unikalnych lokacji (po ID)
    /** @type {Map<number, {locationId:number, location:string}>} */
    const locIndex = new Map();

    // == 3) parsowanie ==
    const data = movieRows.map(row => {
        // dzień
        const dayClass = [...row.classList].find(c => /^item-day-\d+$/.test(c));
        const dayNum = dayClass ? dayClass.split('-').pop() : '';
        const dzien = safe(dayMap.get(dayNum) || dayNum);

        // godzina, sala (nazwa) i locationId z klasy
        const godzina = txt(row.querySelector('td.hour'));
        const salaKinowa = txt(row.querySelector('td.location'));

        // wyciągnij ID lokacji z klasy item-location-####
        let locationId = null;
        const locClass = [...row.classList].find(c => /^item-location-\d+$/.test(c));
        if (locClass) {
            const m = /item-location-(\d+)/.exec(locClass);
            if (m) locationId = Number(m[1]);
        }

        // tytuł / shortsy
        const titleCell = row.querySelector('td.title');
        const links = Array.from(titleCell?.querySelectorAll('a[title], a') ?? []);
        const multi = links.map(a => (a.getAttribute('title') || a.textContent || '').trim()).filter(Boolean);

        let tytul, titles;
        if (multi.length > 1) {
            tytul = 'SHORTSY';
            titles = multi;
        } else {
            const a = links[0];
            tytul = a ? (a.getAttribute('title') || a.textContent || '').trim().replace(/\s+/g, ' ') : txt(titleCell);
            titles = undefined;
        }

        // budujemy rekord
        const rec = { dzien, godzina, tytul, salaKinowa, locationId };
        if (titles) rec.titles = titles;

        // zbierz unikalne lokacje (priorytet: pierwszy niepusty opis dla danego ID)
        if (Number.isFinite(locationId)) {
            if (!locIndex.has(locationId)) {
                locIndex.set(locationId, { locationId, location: salaKinowa || '' });
            } else {
                // jeśli wcześniej było pusto, a teraz mamy nazwę — uzupełnij
                const cur = locIndex.get(locationId);
                if (!cur.location && salaKinowa) cur.location = salaKinowa;
            }
        }

        return rec;
    }).filter(x => x.godzina || x.tytul || x.salaKinowa || Number.isFinite(x.locationId));

    // == 4) zbuduj locations.json ==
    const locations = Array.from(locIndex.values())
        .map(o => ({ locationId: o.locationId, location: o.location || '' }))
        // jeśli zdarzy się bez nazwy — zostawiamy pusty string; sort po nazwie, potem po ID
        .sort((a, b) => (a.location || '').localeCompare(b.location || '') || a.locationId - b.locationId);

    // == 5) log ==
    console.clear();
    console.table(data);
    console.log('Liczba rekordów:', data.length);
    console.table(locations);
    console.log('Unikalne lokacje:', locations.length);

    // == 6) zapisz JSON-y ==
    const saveJSON = (filename, obj) => {
        const json = JSON.stringify(obj, null, 2);
        try {
            const blob = new Blob([json], { type: 'application/json;charset=utf-8' });

            // IE/Edge Legacy
            if (window.navigator && 'msSaveOrOpenBlob' in window.navigator) {
                // @ts-ignore
                window.navigator.msSaveOrOpenBlob(blob, filename);
                return;
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.rel = 'noopener';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 500);
        } catch (e) {
            console.warn('⚠️ saveJSON fallback:', e);
            const encoded = encodeURIComponent(json);
            window.open(`data:application/json;charset=utf-8,${encoded}`, '_blank');
        }
    };

    saveJSON('seanse.json', data);
    saveJSON('locations.json', locations);

    // (opcjonalnie) skopiuj seanse do schowka
    const jsonStr = JSON.stringify(data, null, 2);
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(jsonStr).then(
            () => console.log('📋 JSON seansów skopiowany do schowka'),
            () => {}
        );
    }

    return { seanse: data, locations };
})();
