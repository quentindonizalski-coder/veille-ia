document.addEventListener('DOMContentLoaded', () => {
    // Menu mobile toggle
    const menuToggle = document.getElementById('mobile-menu');
    const mainNav = document.getElementById('main-nav');
    
    menuToggle.addEventListener('click', () => {
        mainNav.classList.toggle('active');
        // Animation simple pour le burger
        const bars = menuToggle.querySelectorAll('.bar');
        if (mainNav.classList.contains('active')) {
            bars[0].style.transform = 'rotate(-45deg) translate(-5px, 6px)';
            bars[1].style.opacity = '0';
            bars[2].style.transform = 'rotate(45deg) translate(-5px, -6px)';
        } else {
            bars[0].style.transform = 'none';
            bars[1].style.opacity = '1';
            bars[2].style.transform = 'none';
        }
    });

    // Fermer le menu lors du clic sur un lien (mobile)
    const navLinks = mainNav.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mainNav.classList.contains('active')) {
                menuToggle.click();
            }
        });
    });

    // Effet de header au scroll
    const header = document.getElementById('main-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.background = 'rgba(7, 11, 25, 0.95)';
            header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
        } else {
            header.style.background = 'rgba(7, 11, 25, 0.8)';
            header.style.boxShadow = 'none';
        }
    });

    // Le formulaire newsletter est désormais géré par Mailjet.

    // Chargement dynamique des articles GitHub
    fetchArticles();
});

const REPO = 'quentindonizalski-coder/veille-ia';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main/articles/`;

const CATEGORY_FALLBACK_IMAGES = {
    'technologie': 'assets/category_technologie.png',
    'société': 'assets/category_societe.png',
    'societe': 'assets/category_societe.png',
    'innovation': 'assets/category_innovation.png',
    'business': 'assets/ai_data_processing.png'
};

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function stripMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/^\s{0,3}>\s?/gm, '')
        .replace(/^(#+)\s+/gm, '')
        .replace(/(`{1,3})([\s\S]*?)\1/g, '$2')
        .replace(/^-{3,}/gm, '')
        .trim();
}

function normalizeArticle(raw, fileName) {
    const P = window.ArticleParser;
    const id = fileName.replace(/^article-/, '').replace(/\.json$/, '');
    const title = raw.title || 'Nouvel article';
    const category = raw.category || 'Technologie';
    const parsedDate = P.parseDate(raw.date) || P.dateFromFileName(fileName);
    const sourceUrl = /^https?:\/\//.test(raw.source_url || '') ? raw.source_url : '';
    let sourceName = raw.source_name;
    if (!sourceName && sourceUrl) {
        try {
            const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
            sourceName = host === 'news.google.com' ? 'Google Actualités' : host;
        } catch (e) { /* ignore */ }
    }
    return {
        id,
        title,
        summary: stripMarkdown(raw.summary || 'Résumé indisponible.'),
        category,
        source_url: sourceUrl,
        source_name: sourceName || 'Source',
        // Miniature générée une fois pour toutes par la GitHub Action (scripts/generate-thumbnails.js).
        // Si elle n'existe pas encore, l'image de la catégorie s'affiche à la place.
        image: raw.image || `assets/thumbs/${id}.jpg`,
        fallbackImage: CATEGORY_FALLBACK_IMAGES[category.toLowerCase()] || 'assets/ai_data_processing.png',
        _parsedDate: parsedDate || new Date(0),
        date: parsedDate ? P.formatDateFR(parsedDate) : '',
        _archiveKey: parsedDate ? `${P.MOIS_FR[parsedDate.getMonth()]} ${parsedDate.getFullYear()}` : 'Anciens articles',
        _monthYearIndex: parsedDate ? parsedDate.getFullYear() * 100 + parsedDate.getMonth() : 0
    };
}

// 1) Index généré au build Netlify (1 seule requête, rapide).
// 2) Secours : liste via l'API GitHub + téléchargement de chaque fichier.
async function loadRawArticles() {
    try {
        const res = await fetch('articles/index.json', { cache: 'no-cache' });
        if (res.ok) {
            const index = await res.json();
            if (Array.isArray(index) && index.length) return index;
        }
    } catch (e) { /* on passe au plan B */ }

    const response = await fetch(`https://api.github.com/repos/${REPO}/contents/articles`);
    if (!response.ok) throw new Error('Impossible de charger le dépôt.');
    const files = (await response.json())
        .filter(f => f.name.endsWith('.json') && f.name !== 'index.json')
        .map(f => f.name);

    const results = await Promise.all(files.map(async file => {
        try {
            const r = await fetch(RAW_BASE + file);
            if (!r.ok) return null;
            return { file, ...window.ArticleParser.parseArticleText(await r.text()) };
        } catch (e) {
            console.error('Impossible de lire', file, e);
            return null;
        }
    }));
    return results.filter(Boolean);
}

async function fetchArticles() {
    const container = document.getElementById('dynamic-news-container');
    const archivesList = document.getElementById('archives-list');
    if (!container || !archivesList) return;

    try {
        const rawArticles = await loadRawArticles();
        const articles = rawArticles.map(r => normalizeArticle(r, r.file));
        articles.sort((a, b) => b._parsedDate - a._parsedDate || b.id.localeCompare(a.id));

        // Archives par mois
        const archiveGroups = {};
        articles.forEach(a => {
            if (!archiveGroups[a._archiveKey]) {
                archiveGroups[a._archiveKey] = { index: a._monthYearIndex, articles: [] };
            }
            archiveGroups[a._archiveKey].articles.push(a);
        });
        const sortedArchiveKeys = Object.keys(archiveGroups).sort((k1, k2) => archiveGroups[k2].index - archiveGroups[k1].index);

        archivesList.innerHTML = `<li><a href="#news" class="active" id="btn-show-latest">5 derniers articles</a></li>` +
            sortedArchiveKeys.map(key =>
                `<li><a href="#news" class="archive-link" data-key="${escapeHtml(key)}">${escapeHtml(key)} <small>(${archiveGroups[key].articles.length})</small></a></li>`
            ).join('');

        const renderArticles = (articlesToRender, { expandId } = {}) => {
            if (articlesToRender.length === 0) {
                container.innerHTML = '<p style="text-align: center; width: 100%; color: var(--text-muted);">Aucun article publié pour le moment.</p>';
                return;
            }

            container.innerHTML = articlesToRender.map((article, index) => {
                const searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(article.title);
                const sourceLink = article.source_url
                    ? `<a href="${escapeHtml(article.source_url)}" target="_blank" rel="noopener noreferrer" class="read-more">Lire l'article complet (${escapeHtml(article.source_name)}) &rarr;</a>`
                    : '';
                return `
                    <article class="news-card large" id="a-${escapeHtml(article.id)}">
                        <div class="card-image-wrapper">
                            <img src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title)}" class="card-image"
                                 loading="${index < 2 ? 'eager' : 'lazy'}" decoding="async"
                                 onerror="this.onerror=null;this.src='${escapeHtml(article.fallbackImage)}';">
                            <span class="category-badge">${escapeHtml(article.category)}</span>
                        </div>
                        <div class="card-content">
                            <span class="date">${escapeHtml(article.date)}</span>
                            <h3 class="card-title"><a href="#a-${escapeHtml(article.id)}" class="card-permalink">${escapeHtml(article.title)}</a></h3>
                            <div class="card-excerpt-container" style="flex-grow: 1;">
                                <p class="card-excerpt" id="article-resume-${index}" style="max-height: 100px; overflow: hidden; transition: max-height 0.4s ease; margin-bottom: 0;">${escapeHtml(article.summary)}</p>
                                <button id="btn-more-${index}" style="background: none; border: none; color: var(--accent); cursor: pointer; font-weight: bold; margin-bottom: 1.5rem; padding-top: 5px; text-decoration: underline;">Lire la suite ↓</button>
                            </div>
                            ${sourceLink}
                            <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="search-fallback">Lien cassé ? Rechercher l'article</a>
                        </div>
                    </article>`;
            }).join('');

            articlesToRender.forEach((article, index) => {
                const btn = document.getElementById(`btn-more-${index}`);
                const text = document.getElementById(`article-resume-${index}`);
                if (!btn || !text) return;
                const toggle = (open) => {
                    text.style.maxHeight = open ? text.scrollHeight + 'px' : '100px';
                    btn.innerHTML = open ? 'Fermer ↑' : 'Lire la suite ↓';
                };
                if (text.scrollHeight <= 100) btn.style.display = 'none';
                btn.addEventListener('click', () => toggle(text.style.maxHeight === '100px'));
                if (article.id === expandId) toggle(true);
            });
        };

        const setActive = (link) => {
            archivesList.querySelectorAll('a').forEach(l => l.classList.remove('active'));
            if (link) link.classList.add('active');
        };

        archivesList.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                const target = e.currentTarget;
                setActive(target);
                if (target.id === 'btn-show-latest') {
                    renderArticles(articles.slice(0, 5));
                } else {
                    renderArticles(archiveGroups[target.getAttribute('data-key')].articles);
                }
            });
        });

        // Lien direct vers un article : https://site/#a-1792733439
        const showFromHash = () => {
            const m = location.hash.match(/^#a-(.+)$/);
            const article = m && articles.find(a => a.id === decodeURIComponent(m[1]));
            if (!article) return false;
            const group = archiveGroups[article._archiveKey];
            setActive(archivesList.querySelector(`a[data-key="${CSS.escape(article._archiveKey)}"]`));
            renderArticles(group.articles, { expandId: article.id });
            const el = document.getElementById(`a-${article.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return true;
        };
        window.addEventListener('hashchange', showFromHash);

        if (!showFromHash()) renderArticles(articles.slice(0, 5));

    } catch (error) {
        console.error('Erreur lors de la récupération des articles:', error);
        container.innerHTML = '<p style="text-align: center; width: 100%; color: #ef4444;">Impossible de charger les actualités.</p>';
    }
}
