// Génère une miniature IA par article et l'enregistre dans assets/thumbs/<id>.jpg.
// Lancé par la GitHub Action .github/workflows/thumbnails.yml.
//
// - Avec le secret POLLINATIONS_KEY (clé sk_... de https://enter.pollinations.ai/keys) :
//   modèle FLUX en haute qualité, sans filigrane ni limite de débit.
// - Sans clé : service gratuit limité à 1 image / 45 s, donc on traite
//   MAX_THUMBS articles par exécution (les plus récents d'abord).
const fs = require('fs');
const path = require('path');
const { parseArticleText, parseDate, dateFromFileName } = require('../article-parser.js');

const ROOT = path.join(__dirname, '..');
const ARTICLES = path.join(ROOT, 'articles');
const THUMBS = path.join(ROOT, 'assets', 'thumbs');
const KEY = process.env.POLLINATIONS_KEY || '';
const MODEL = process.env.POLLINATIONS_MODEL || 'flux';
const MAX = parseInt(process.env.MAX_THUMBS || (KEY ? '400' : '25'), 10);
const DELAY_MS = KEY ? 1000 : 46000;

const CATEGORY_STYLE = {
    'technologie': 'sleek futuristic technology, blue and cyan neon accents, clean studio lighting',
    'société': 'documentary photojournalism, people in a modern city, natural light, emotional',
    'innovation': 'cutting-edge research lab, prototypes, dramatic lighting, sense of discovery',
    'business': 'corporate finance and markets, glass skyscrapers, data charts, golden hour light'
};

function buildPrompt(a) {
    const style = CATEGORY_STYLE[(a.category || '').toLowerCase()] || CATEGORY_STYLE['technologie'];
    const context = (a.summary || '').split(/(?<=\.)\s/)[0].slice(0, 220);
    return `Editorial cover photo for a French tech news article. Headline: "${a.title}". ` +
        `Context: ${context} Visual style: ${style}. ` +
        `Photorealistic, cinematic composition, shallow depth of field, high detail, magazine quality. ` +
        `No text, no letters, no logo, no watermark.`;
}

function seedOf(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % 1000000;
}

async function generate(prompt, seed) {
    const p = encodeURIComponent(prompt);
    const params = `width=1024&height=576&nologo=true&seed=${seed}`;
    const url = KEY
        ? `https://gen.pollinations.ai/image/${p}?${params}&model=${MODEL}&enhance=true`
        : `https://image.pollinations.ai/prompt/${p}?${params}`;
    const res = await fetch(url, {
        headers: KEY ? { Authorization: `Bearer ${KEY}` } : {},
        signal: AbortSignal.timeout(180000)
    });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) {
        throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    return Buffer.from(await res.arrayBuffer());
}

(async () => {
    fs.mkdirSync(THUMBS, { recursive: true });
    const todo = fs.readdirSync(ARTICLES)
        .filter(f => /^article-.+\.json$/.test(f))
        .map(file => {
            const id = file.replace(/^article-/, '').replace(/\.json$/, '');
            const a = parseArticleText(fs.readFileSync(path.join(ARTICLES, file), 'utf8'));
            const d = parseDate(a.date) || dateFromFileName(file) || new Date(0);
            return { id, ...a, _d: d };
        })
        .filter(a => !fs.existsSync(path.join(THUMBS, `${a.id}.jpg`)))
        .sort((x, y) => y._d - x._d || y.id.localeCompare(x.id))
        .slice(0, MAX);

    console.log(`${todo.length} miniature(s) à générer (${KEY ? 'clé Pollinations' : 'mode gratuit'})`);
    let ok = 0;
    for (const [i, a] of todo.entries()) {
        if (i > 0) await new Promise(r => setTimeout(r, DELAY_MS));
        try {
            const img = await generate(buildPrompt(a), seedOf(a.id));
            fs.writeFileSync(path.join(THUMBS, `${a.id}.jpg`), img);
            ok++;
            console.log(`OK  ${a.id}  ${a.title}`);
        } catch (e) {
            console.warn(`ERR ${a.id}  ${e.message}`);
        }
    }
    console.log(`${ok}/${todo.length} miniature(s) générée(s)`);
})();
