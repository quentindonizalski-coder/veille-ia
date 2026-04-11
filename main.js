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

async function fetchArticles() {
    const container = document.getElementById('dynamic-news-container');
    const archivesList = document.getElementById('archives-list');
    if (!container || !archivesList) return;

    try {
        // On revient à l'API GitHub pour obtenir la liste en temps réel des fichiers. 
        // L'API a une limite de 60 appels/heure PAR VISITEUR, ce qui est suffisant.
        const repoUrl = 'https://api.github.com/repos/quentindonizalski-coder/veille-ia/contents/articles';
        const response = await fetch(repoUrl);
        if (!response.ok) throw new Error('Impossible de charger le dépôt.');
        
        const files = await response.json();
        const jsonFiles = files.filter(f => f.name.endsWith('.json') && f.name !== 'index.json').map(f => f.name);
        const baseUrl = 'https://raw.githubusercontent.com/quentindonizalski-coder/veille-ia/main/articles/';
        
        const articles = [];

        const fetchPromises = jsonFiles.map(async fileName => {
            try {
                const articleResponse = await fetch(baseUrl + fileName);
                if (articleResponse.ok) {
                    const textData = await articleResponse.text();
                    
                    // Fonction pour nettoyer le Markdown du résumé
                    const stripMarkdown = (text) => {
                        if (!text) return "";
                        return text
                            .replace(/(\*\*|__)(.*?)\1/g, '$2') // Gras
                            .replace(/(\*|_)(.*?)\1/g, '$2') // Italique
                            .replace(/!\[.*?\]\(.*?\)/g, '') // Images
                            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Liens (garde le texte)
                            .replace(/^\s{0,3}>\s?/gm, '') // Citations
                            .replace(/^(#+)\s+/gm, '') // Titres (H1, H2...)
                            .replace(/(`{1,3})([\s\S]*?)\1/g, '$2') // Code
                            .replace(/^-{3,}/gm, '') // Lignes horizontales
                            .trim();
                    };

                    // Extraction du bloc JSON strict (ignorer le texte avant ou après)
                    let jsonString = textData;
                    const jsonMatch = textData.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        jsonString = jsonMatch[0];
                    }

                    let articleData;
                    try {
                        articleData = JSON.parse(jsonString);
                    } catch (e) {
                        // Tolérance d'erreur
                        articleData = {
                            titre: "Actualité",
                            resume: textData.substring(0, 200) + "...",
                            categorie: "Auto"
                        };
                    }

                    // Mapping des propriétés (support du français et anglais)
                    const mappedTitle = articleData.titre || articleData.title || "Nouvel Article";
                    let rawSummary = articleData.resume || articleData.summary || "Résumé indisponible.";
                    const mappedSummary = stripMarkdown(rawSummary); // Nettoyage Markdown
                    
                    const mappedCategory = articleData.categorie || articleData.category || "Général";
                    const mappedSourceUrl = articleData.source_url || articleData.lien_source || "#";
                    const mappedSourceName = articleData.source_name || articleData.nom_source || "Lire la source";
                    
                    // Assignation de l'image via la catégorie
                    let dynamicImageUrl = 'assets/ai_data_processing.png';
                    const catStr = mappedCategory.toLowerCase();
                    if (catStr.includes('innovation')) dynamicImageUrl = 'assets/category_innovation.png';
                    else if (catStr.includes('soci')) dynamicImageUrl = 'assets/category_societe.png';
                    else if (catStr.includes('technologi')) dynamicImageUrl = 'assets/category_technologie.png';
                    else if (catStr.includes('business')) dynamicImageUrl = 'assets/ai_data_processing.png';

                    const finalArticle = {
                        title: mappedTitle,
                        summary: mappedSummary,
                        category: mappedCategory,
                        source_url: mappedSourceUrl,
                        source_name: mappedSourceName,
                        image: articleData.image || dynamicImageUrl,
                        date: articleData.date
                    };

                    // Détection du timestamp dans le nom du fichier poussé par Make.com
                    const tsMatch = fileName.match(/(\d{10,13})\.json/);
                    if (tsMatch && !finalArticle.date) {
                        const ts = parseInt(tsMatch[1], 10);
                        const tsDate = ts > 9999999999 ? new Date(ts) : new Date(ts * 1000);
                        const moisNoms = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
                        finalArticle.date = `${tsDate.getDate()} ${moisNoms[tsDate.getMonth()]} ${tsDate.getFullYear()}`;
                    }

                    articles.push(finalArticle);
                }
            } catch (err) {
                console.error("Impossible de parser le fichier", fileName, err);
            }
        });

        await Promise.all(fetchPromises);

        // Mois FR pour le tri
        const moisFR = {
            "Janvier": 0, "Février": 1, "Mars": 2, "Avril": 3, "Mai": 4, "Juin": 5, 
            "Juillet": 6, "Août": 7, "Septembre": 8, "Octobre": 9, "Novemre": 10, "Décembre": 11,
            "Fevrier": 1, "Aout": 7, "Novembre": 10, "Decembre": 11
        };

        // Parse et tri par date du plus récent au plus ancien
        articles.forEach(a => {
            const dateStr = a.date || "";
            const parts = dateStr.split(" ");
            if (parts.length === 3) {
                const jour = parseInt(parts[0], 10);
                const mois = moisFR[parts[1]] !== undefined ? moisFR[parts[1]] : 0;
                const annee = parseInt(parts[2], 10);
                a._parsedDate = new Date(annee, mois, jour);
                a._archiveKey = parts[1] + " " + parts[2]; // ex: "Avril 2026"
                a._monthYearIndex = annee * 100 + mois; // Pour trier les archives
            } else {
                a._parsedDate = new Date(0);
                a._archiveKey = "Anciens articles";
                a._monthYearIndex = 0;
            }
        });

        articles.sort((a, b) => b._parsedDate - a._parsedDate);

        // Remplir Archives
        const archiveGroups = {};
        articles.forEach(a => {
            if (!archiveGroups[a._archiveKey]) {
                archiveGroups[a._archiveKey] = { index: a._monthYearIndex, articles: [] };
            }
            archiveGroups[a._archiveKey].articles.push(a);
        });

        const sortedArchiveKeys = Object.keys(archiveGroups).sort((k1, k2) => archiveGroups[k2].index - archiveGroups[k1].index);

        archivesList.innerHTML = `<li><a class="active" id="btn-show-latest">5 derniers articles</a></li>`;
        
        sortedArchiveKeys.forEach(key => {
            archivesList.innerHTML += `<li><a class="archive-link" data-key="${key}">${key}</a></li>`;
        });

        // Fonction d'affichage
        const renderArticles = (articlesToRender) => {
            container.innerHTML = '';
            if (articlesToRender.length === 0) {
                container.innerHTML = '<p style="text-align: center; width: 100%; color: var(--text-muted);">Aucun article publié pour le moment.</p>';
                return;
            }

            articlesToRender.forEach(article => {
                const imageUrl = article.image || 'assets/ai_data_processing.png';
                const articleHtml = `
                    <article class="news-card large">
                        <div class="card-image-wrapper">
                            <img src="${imageUrl}" alt="Illustration de l'article" class="card-image">
                            <span class="category-badge">${article.category || 'Non classé'}</span>
                        </div>
                        <div class="card-content">
                            <span class="date">${article.date || ''}</span>
                            <h3 class="card-title">${article.title}</h3>
                            <p class="card-excerpt">${article.summary}</p>
                            <a href="${article.source_url}" target="_blank" rel="noopener noreferrer" class="read-more">
                                Source: ${article.source_name || 'Lien externe'} &rarr;
                            </a>
                        </div>
                    </article>
                `;
                container.innerHTML += articleHtml;
            });
        };

        // Events de navigation
        const navLinks = archivesList.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                navLinks.forEach(l => l.classList.remove('active'));
                e.target.classList.add('active');

                if (e.target.id === 'btn-show-latest') {
                    renderArticles(articles.slice(0, 5));
                } else {
                    const key = e.target.getAttribute('data-key');
                    renderArticles(archiveGroups[key].articles);
                }
            });
        });

        // Affichage par défaut (5 plus récents)
        renderArticles(articles.slice(0, 5));

    } catch (error) {
        console.error('Erreur lors de la récupération des articles:', error);
        container.innerHTML = '<p style="text-align: center; width: 100%; color: #ef4444;">Impossible de charger les actualités.</p>';
    }
}
