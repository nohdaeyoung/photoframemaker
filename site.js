/**
 * site.js — 정적 페이지 공통 요소 관리
 * footer 렌더링 + 사이트 타이틀 업데이트
 * 변경 시 이 파일만 수정하면 됨 (SSR 블로그 페이지는 worker.js renderLayout() 참고)
 */
(function () {
    // --- Footer ---
    const footerEl = document.querySelector('footer.footer');
    if (footerEl) {
        footerEl.innerHTML =
            '<p>&copy; 2026 <a href="https://324.ing" target="_blank" rel="noopener noreferrer">324.ing</a>' +
            ' &middot; Built by photographer <a href="https://www.instagram.com/dyno/" target="_blank" rel="noopener noreferrer">DY</a>' +
            ' &middot; <a href="/blog/">Blog</a>' +
            ' &middot; <a href="/about.html">About</a>' +
            ' &middot; <a href="/devnote.html">Dev Note</a></p>';
    }

    // --- Site title (blog-header h1) ---
    fetch('/api/settings/public').then(function (r) { return r.json(); }).then(function (s) {
        if (s.site_title) {
            var h1a = document.querySelector('.blog-header h1 a');
            if (h1a) h1a.textContent = s.site_title;
            document.title = document.title.replace(/Photo Frame Maker/, s.site_title);
        }
    }).catch(function () {});
})();
