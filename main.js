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
    if (!container) return;

    try {
        // Au lieu d'utiliser l'API publique restreinte, on télécharge un fichier statique d'index
        // depuis le nom de domaine brut de GitHub, qui ne possède pas de limite sévère.
        const indexUrl = 'https://raw.githubusercontent.com/quentindonizalski-coder/veille-ia/main/articles/index.json';
        const response = await fetch(indexUrl);
        if (!response.ok) throw new Error('Impossible de charger l\'index des articles.');
        
        const jsonFiles = await response.json();
        
        container.innerHTML = ''; // Nettoyage du texte de chargement
        
        const baseUrl = 'https://raw.githubusercontent.com/quentindonizalski-coder/veille-ia/main/articles/';

        for (const fileName of jsonFiles) {
            const articleResponse = await fetch(baseUrl + fileName);
            if (!articleResponse.ok) continue;
            
            const article = await articleResponse.json();
            
            // Image par défaut si manquante
            const imageUrl = article.image || 'assets/ai_data_processing.png';
            
            const articleHtml = `
                <article class="news-card">
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
        }

        // Si aucun article n'est posté
        if (jsonFiles.length === 0) {
            container.innerHTML = '<p style="text-align: center; width: 100%; grid-column: 1 / -1; color: var(--text-muted);">Aucun article publié pour le moment.</p>';
        }

    } catch (error) {
        console.error('Erreur lors de la récupération des articles:', error);
        container.innerHTML = '<p style="text-align: center; width: 100%; grid-column: 1 / -1; color: #ef4444;">Impossible de charger les actualités (Erreur ou Limite API GitHub atteinte).</p>';
    }
}
