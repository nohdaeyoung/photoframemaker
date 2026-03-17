/**
 * site.js — 정적 페이지 공통 요소 관리
 * 네비게이션 + footer 렌더링 + 햄버거 토글
 * 변경 시 이 파일만 수정하면 됨 (SSR 블로그 페이지는 worker.js renderLayout() 참고)
 * Note: All innerHTML content is static/hardcoded strings — no user input, safe from XSS.
 */
(function () {
    var path = location.pathname;

    // --- Top Navigation ---
    var navEl = document.getElementById('top-nav');
    if (!navEl) {
        // Auto-inject nav if placeholder exists
        var placeholder = document.getElementById('site-nav');
        if (placeholder) {
            var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            var blogHref = isLocal ? 'https://f.324.ing/blog/' : '/blog/';
            var links = [
                { href: '/featured/', label: 'Featured' },
                { href: '/tools.html', label: 'Tools' },
                { href: blogHref, label: 'Blog' },
                { href: '/devnote.html', label: 'DevNote' },
                { href: '/about.html', label: 'About' }
            ];
            var isActive = function (href) {
                if (href === '/') return path === '/' || path === '/index.html';
                return path.startsWith(href.replace(/\.html$/, ''));
            };
            var desktopLinks = links.map(function (l) {
                return '<li><a href="' + l.href + '" class="top-nav-link' + (isActive(l.href) ? ' active' : '') + '">' + l.label + '</a></li>';
            }).join('');
            var mobileLinks = links.map(function (l) {
                return '<a href="' + l.href + '" class="top-nav-mobile-link' + (isActive(l.href) ? ' active' : '') + '">' + l.label + '</a>';
            }).join('');

            // Safe: all strings below are hardcoded constants, no user input involved
            placeholder.outerHTML =
                '<nav class="top-nav" id="top-nav">' +
                    '<a class="top-nav-logo" href="/"><span class="top-nav-logo-text">Photo Frame Maker</span></a>' +
                    '<ul class="top-nav-links">' + desktopLinks + '</ul>' +
                    '<div class="top-nav-actions">' +
                        '<button class="top-nav-hamburger" id="nav-hamburger" type="button" aria-label="메뉴 열기" aria-expanded="false">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
                        '</button>' +
                    '</div>' +
                    '<div class="top-nav-mobile-menu" id="nav-mobile-menu">' + mobileLinks + '</div>' +
                '</nav>';
        }
    }

    // --- Hamburger menu toggle ---
    var hamburger = document.getElementById('nav-hamburger');
    var menu = document.getElementById('nav-mobile-menu');
    if (hamburger && menu) {
        hamburger.addEventListener('click', function () {
            var open = menu.classList.toggle('open');
            hamburger.setAttribute('aria-expanded', open);
        });
        document.addEventListener('click', function (e) {
            if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // --- Footer ---
    // Safe: hardcoded static HTML string, no user input processed
    var footerEl = document.querySelector('footer.footer');
    if (footerEl) {
        var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        var footerBlogHref = isLocal ? 'https://f.324.ing/blog/' : '/blog/';
        var footerP = document.createElement('p');
        footerP.textContent = '\u00A9 2026 ';
        var a1 = document.createElement('a'); a1.href = 'https://324.ing'; a1.target = '_blank'; a1.rel = 'noopener noreferrer'; a1.textContent = '324.ing'; footerP.appendChild(a1);
        footerP.append(' \u00B7 Built by photographer ');
        var a2 = document.createElement('a'); a2.href = 'https://www.instagram.com/dyno/'; a2.target = '_blank'; a2.rel = 'noopener noreferrer'; a2.textContent = 'DY'; footerP.appendChild(a2);
        footerP.append(' \u00B7 ');
        var a3 = document.createElement('a'); a3.href = footerBlogHref; a3.textContent = 'Blog'; footerP.appendChild(a3);
        footerP.append(' \u00B7 ');
        var a4 = document.createElement('a'); a4.href = '/about.html'; a4.textContent = 'About'; footerP.appendChild(a4);
        footerP.append(' \u00B7 ');
        var a5 = document.createElement('a'); a5.href = '/devnote.html'; a5.textContent = 'Dev Note'; footerP.appendChild(a5);
        footerEl.textContent = '';
        footerEl.appendChild(footerP);
    }

    // --- Site title (all pages) ---
    fetch('/api/settings/public').then(function (r) { return r.json(); }).then(function (s) {
        if (s.site_title) {
            var logo = document.querySelector('.top-nav-logo-text');
            if (logo) logo.textContent = s.site_title;
            var h1a = document.querySelector('.blog-header h1 a');
            if (h1a) h1a.textContent = s.site_title;
            var heroH1 = document.querySelector('.header h1');
            if (heroH1 && heroH1.querySelector('a')) {
                var link = heroH1.querySelector('a');
                heroH1.textContent = s.site_title + ' by ';
                heroH1.appendChild(link);
            }
            document.title = document.title.replace(/Photo Frame Maker/, s.site_title);
        }
    }).catch(function () {});
})();
