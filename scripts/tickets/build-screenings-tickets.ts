import {extractFromHtmlFileAndSave} from "./scrap-ticket-site";


extractFromHtmlFileAndSave()
    .then((outPath) => console.log('JSON zapisany pod:', outPath))
    .catch((e) => {
        console.error('Błąd podczas ekstrakcji/zapisu:', e);
        process.exit(1);
    });