/*
 * Lecture tolérante des fichiers d'articles produits par Make.com.
 * Utilisé à la fois par le navigateur (main.js) et par le script de build
 * Netlify (scripts/build-index.js) pour que les deux lisent les articles
 * exactement de la même façon.
 */
(function (root) {
    const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    // Noms de mois acceptés dans les dates (Make.com écrit les dates en anglais).
    const MONTH_INDEX = {
        janvier: 0, january: 0, jan: 0,
        fevrier: 1, février: 1, february: 1, feb: 1,
        mars: 2, march: 2, mar: 2,
        avril: 3, april: 3, apr: 3,
        mai: 4, may: 4,
        juin: 5, june: 5, jun: 5,
        juillet: 6, july: 6, jul: 6,
        aout: 7, août: 7, august: 7, aug: 7,
        septembre: 8, september: 8, sep: 8, sept: 8,
        octobre: 9, october: 9, oct: 9,
        novembre: 10, november: 10, nov: 10,
        decembre: 11, décembre: 11, december: 11, dec: 11
    };

    // Récupère un champ texte dans un JSON invalide (ex : guillemets non échappés
    // dans le résumé). On s'arrête au guillemet suivi de `,"clé":` ou de `}`.
    function extractLoose(text, keys) {
        for (const key of keys) {
            const re = new RegExp('"' + key + '"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"[a-z_]+"\\s*:|\\s*\\}\\s*$)');
            const m = text.match(re);
            if (m) return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
        }
        return undefined;
    }

    function parseLoose(text) {
        return {
            title: extractLoose(text, ['title', 'titre']),
            summary: extractLoose(text, ['summary', 'resume']),
            category: extractLoose(text, ['category', 'categorie']),
            source_url: extractLoose(text, ['source_url', 'lien_source']),
            source_name: extractLoose(text, ['source_name', 'nom_source']),
            date: extractLoose(text, ['date']),
            image: extractLoose(text, ['image'])
        };
    }

    function looksLikeRawJson(value) {
        return typeof value === 'string' && /^\s*\{\s*"/.test(value);
    }

    // Transforme le contenu brut d'un fichier en objet { title, summary, ... }.
    function parseArticleText(textData) {
        let jsonString = textData;
        const jsonMatch = textData.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonString = jsonMatch[0];

        let data;
        try {
            data = JSON.parse(jsonString);
        } catch (e) {
            data = parseLoose(jsonString);
        }

        // Cas Make.com : la réponse brute (invalide) de l'IA a été copiée telle
        // quelle dans chaque champ. On la relit champ par champ.
        const nested = Object.values(data).find(looksLikeRawJson);
        if (nested) data = parseLoose(nested);

        return {
            title: data.titre || data.title,
            summary: data.resume || data.summary,
            category: data.categorie || data.category,
            source_url: data.source_url || data.lien_source,
            source_name: data.source_name || data.nom_source,
            date: data.date,
            image: data.image
        };
    }

    // "23 October 2026" / "3 Juin 2026" / "2026-10-23" -> Date (ou null)
    function parseDate(dateStr) {
        if (!dateStr) return null;
        const iso = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
        const parts = String(dateStr).trim().split(/\s+/);
        if (parts.length === 3) {
            const mois = MONTH_INDEX[parts[1].toLowerCase()];
            const jour = parseInt(parts[0], 10);
            const annee = parseInt(parts[2], 10);
            if (mois !== undefined && jour && annee) return new Date(annee, mois, jour);
        }
        return null;
    }

    // Date à partir du nom de fichier (article-1792733439.json ou article-2026-04-12-00-46.json)
    function dateFromFileName(fileName) {
        const dateMatch = fileName.match(/article-(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) return new Date(+dateMatch[1], +dateMatch[2] - 1, +dateMatch[3]);
        const tsMatch = fileName.match(/-(1\d{9,12})\.json/);
        if (tsMatch) {
            const ts = parseInt(tsMatch[1], 10);
            return ts > 9999999999 ? new Date(ts) : new Date(ts * 1000);
        }
        return null;
    }

    function formatDateFR(date) {
        return `${date.getDate()} ${MOIS_FR[date.getMonth()]} ${date.getFullYear()}`;
    }

    const api = { parseArticleText, parseDate, dateFromFileName, formatDateFR, MOIS_FR };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ArticleParser = api;
})(typeof window !== 'undefined' ? window : this);
