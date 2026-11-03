// Build Netlify : regroupe tous les articles dans articles/index.json
// pour que le site les charge en une seule requête (au lieu d'appeler
// l'API GitHub + 1 requête par article à chaque visite).
// Ne fait jamais échouer le déploiement : en cas d'erreur, le site
// retombe sur le chargement via l'API GitHub.
const fs = require('fs');
const path = require('path');
const { parseArticleText } = require('../article-parser.js');

const dir = path.join(__dirname, '..', 'articles');
try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');
    const index = [];
    for (const file of files) {
        try {
            index.push({ file, ...parseArticleText(fs.readFileSync(path.join(dir, file), 'utf8')) });
        } catch (e) {
            console.warn('Article ignoré :', file, e.message);
        }
    }
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index));
    console.log(`articles/index.json : ${index.length} articles`);
} catch (e) {
    console.warn('Index non généré :', e.message);
}
