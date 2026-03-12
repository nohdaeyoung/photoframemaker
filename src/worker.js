import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

const app = new Hono();

// --- Helpers ---

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function slugify(text) {
    return text.toLowerCase().trim()
        .replace(/[^\w\s가-힣-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100);
}

async function hashPassword(password) {
    const enc = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

async function getSettings(db) {
    const rows = await db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows.results) settings[r.key] = r.value;
    return settings;
}

// --- Auth middleware ---

async function authMiddleware(c, next) {
    const token = getCookie(c, 'session_token');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    const session = await c.env.DB.prepare(
        "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
    ).bind(token).first();
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    await next();
}

// --- Auth routes ---

app.post('/api/auth/login', async (c) => {
    const { password } = await c.req.json();
    if (!password) return c.json({ error: 'Password required' }, 400);

    const hash = await hashPassword(password);
    if (hash !== c.env.ADMIN_PASSWORD_HASH) {
        return c.json({ error: 'Invalid password' }, 401);
    }

    // Clean expired sessions
    await c.env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await c.env.DB.prepare('INSERT INTO sessions (token, expires_at) VALUES (?, ?)').bind(token, expiresAt).run();

    setCookie(c, 'session_token', token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60
    });

    return c.json({ ok: true });
});

app.post('/api/auth/logout', async (c) => {
    const token = getCookie(c, 'session_token');
    if (token) {
        await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    }
    deleteCookie(c, 'session_token', { path: '/' });
    return c.json({ ok: true });
});

app.get('/api/auth/check', async (c) => {
    const token = getCookie(c, 'session_token');
    if (!token) return c.json({ authenticated: false });
    const session = await c.env.DB.prepare(
        "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
    ).bind(token).first();
    return c.json({ authenticated: !!session });
});

// --- Public API ---

app.get('/api/posts', async (c) => {
    const page = parseInt(c.req.query('page') || '1');
    const perPage = 10;
    const offset = (page - 1) * perPage;
    const category = c.req.query('category') || '';
    const tag = c.req.query('tag') || '';
    const status = c.req.query('status') || 'published';

    let query = 'SELECT id, title, slug, excerpt, cover_image, category, tags, status, published_at, created_at, view_count FROM posts';
    let countQuery = 'SELECT COUNT(*) as total FROM posts';
    const params = [];
    const conditions = [];

    // Check if admin (for viewing drafts)
    const token = getCookie(c, 'session_token');
    let isAdmin = false;
    if (token) {
        const session = await c.env.DB.prepare(
            "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
        ).bind(token).first();
        isAdmin = !!session;
    }

    if (status === 'published' || !isAdmin) {
        conditions.push("status = 'published'");
    } else if (status === 'draft' && isAdmin) {
        conditions.push("status = 'draft'");
    }

    if (category) {
        conditions.push('category = ?');
        params.push(category);
    }
    if (tag) {
        conditions.push("tags LIKE ?");
        params.push(`%"${tag}"%`);
    }

    if (conditions.length > 0) {
        const where = ' WHERE ' + conditions.join(' AND ');
        query += where;
        countQuery += where;
    }

    query += ' ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?';

    const countResult = await c.env.DB.prepare(countQuery).bind(...params).first();
    const total = countResult.total;

    const posts = await c.env.DB.prepare(query).bind(...params, perPage, offset).all();

    return c.json({
        posts: posts.results,
        total,
        page,
        totalPages: Math.ceil(total / perPage)
    });
});

app.get('/api/posts/:slug', async (c) => {
    const slug = c.req.param('slug');
    const post = await c.env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(slug).first();
    if (!post) return c.json({ error: 'Not found' }, 404);

    // If draft, check admin
    if (post.status === 'draft') {
        const token = getCookie(c, 'session_token');
        if (!token) return c.json({ error: 'Not found' }, 404);
        const session = await c.env.DB.prepare(
            "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
        ).bind(token).first();
        if (!session) return c.json({ error: 'Not found' }, 404);
    }

    // Increment view count
    await c.env.DB.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').bind(post.id).run();

    return c.json(post);
});

app.get('/api/settings/public', async (c) => {
    const settings = await getSettings(c.env.DB);
    // Only return public keys
    const publicKeys = ['site_title', 'site_description', 'site_keywords', 'site_author', 'site_url', 'blog_title', 'blog_description', 'og_default_image'];
    const result = {};
    for (const k of publicKeys) if (settings[k]) result[k] = settings[k];
    return c.json(result);
});

// --- Admin API (auth required) ---

app.post('/api/admin/posts', authMiddleware, async (c) => {
    const data = await c.req.json();
    const slug = data.slug || slugify(data.title || 'untitled');

    // Check slug uniqueness
    const existing = await c.env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(slug).first();
    if (existing) return c.json({ error: 'Slug already exists' }, 409);

    const result = await c.env.DB.prepare(
        `INSERT INTO posts (title, slug, content, excerpt, cover_image, category, tags, status, meta_title, meta_description, og_image, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        data.title || '',
        slug,
        data.content || '',
        data.excerpt || '',
        data.cover_image || '',
        data.category || '',
        JSON.stringify(data.tags || []),
        data.status || 'draft',
        data.meta_title || '',
        data.meta_description || '',
        data.og_image || '',
        data.status === 'published' ? new Date().toISOString() : null
    ).run();

    return c.json({ id: result.meta.last_row_id, slug }, 201);
});

app.put('/api/admin/posts/:id', authMiddleware, async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();

    // Get current post
    const current = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
    if (!current) return c.json({ error: 'Not found' }, 404);

    // If slug changed, check uniqueness
    if (data.slug && data.slug !== current.slug) {
        const existing = await c.env.DB.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').bind(data.slug, id).first();
        if (existing) return c.json({ error: 'Slug already exists' }, 409);
    }

    // If publishing for first time, set published_at
    let publishedAt = current.published_at;
    if (data.status === 'published' && current.status === 'draft') {
        publishedAt = new Date().toISOString();
    }

    await c.env.DB.prepare(
        `UPDATE posts SET title=?, slug=?, content=?, excerpt=?, cover_image=?, category=?, tags=?, status=?, meta_title=?, meta_description=?, og_image=?, published_at=?, updated_at=datetime('now') WHERE id=?`
    ).bind(
        data.title ?? current.title,
        data.slug ?? current.slug,
        data.content ?? current.content,
        data.excerpt ?? current.excerpt,
        data.cover_image ?? current.cover_image,
        data.category ?? current.category,
        data.tags ? JSON.stringify(data.tags) : current.tags,
        data.status ?? current.status,
        data.meta_title ?? current.meta_title,
        data.meta_description ?? current.meta_description,
        data.og_image ?? current.og_image,
        publishedAt,
        id
    ).run();

    return c.json({ ok: true });
});

app.delete('/api/admin/posts/:id', authMiddleware, async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    return c.json({ ok: true });
});

app.get('/api/admin/settings', authMiddleware, async (c) => {
    const settings = await getSettings(c.env.DB);
    return c.json(settings);
});

app.put('/api/admin/settings', authMiddleware, async (c) => {
    const data = await c.req.json();
    const stmt = c.env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const batch = [];
    for (const [key, value] of Object.entries(data)) {
        batch.push(stmt.bind(key, String(value)));
    }
    if (batch.length > 0) await c.env.DB.batch(batch);
    return c.json({ ok: true });
});

app.get('/api/admin/stats', authMiddleware, async (c) => {
    const totalPosts = await c.env.DB.prepare('SELECT COUNT(*) as c FROM posts').first();
    const published = await c.env.DB.prepare("SELECT COUNT(*) as c FROM posts WHERE status='published'").first();
    const drafts = await c.env.DB.prepare("SELECT COUNT(*) as c FROM posts WHERE status='draft'").first();
    const totalViews = await c.env.DB.prepare('SELECT COALESCE(SUM(view_count),0) as c FROM posts').first();
    const recent = await c.env.DB.prepare(
        "SELECT id, title, slug, status, view_count, updated_at FROM posts ORDER BY updated_at DESC LIMIT 5"
    ).all();

    return c.json({
        totalPosts: totalPosts.c,
        published: published.c,
        drafts: drafts.c,
        totalViews: totalViews.c,
        recentPosts: recent.results
    });
});

// --- Image upload (R2) ---

app.post('/api/admin/upload', authMiddleware, async (c) => {
    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!file) return c.json({ error: 'No file' }, 400);

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) return c.json({ error: 'Invalid file type' }, 400);
    if (file.size > 5 * 1024 * 1024) return c.json({ error: 'File too large (max 5MB)' }, 400);

    const ext = file.name.split('.').pop() || 'jpg';
    const key = `blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    await c.env.BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type }
    });

    const url = `/uploads/${key}`;

    return c.json({ url, key });
});

// --- Serve R2 uploads ---

app.get('/uploads/*', async (c) => {
    const key = c.req.path.replace('/uploads/', '');
    const obj = await c.env.BUCKET.get(key);
    if (!obj) return c.notFound();

    const headers = new Headers();
    headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(obj.body, { headers });
});

// --- SSR Blog pages ---

function renderLayout(title, description, content, settings, extra = {}) {
    const gtmId = settings.gtm_id || '';
    const ogImage = extra.ogImage || settings.og_default_image || '';
    const canonical = extra.canonical || '';
    const jsonLd = extra.jsonLd || '';

    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    ${gtmId ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${escapeHtml(gtmId)}');</script>` : ''}
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="author" content="${escapeHtml(settings.site_author || 'DY')}">
    ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ''}
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(ogImage)}">
    ${extra.ogType ? `<meta property="og:type" content="${extra.ogType}">` : ''}
    ${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : ''}
    <meta name="twitter:card" content="summary_large_image">
    <link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml">
    <link rel="stylesheet" href="/style.css">
    <style>
        .blog-page { min-height: 100dvh; display: flex; flex-direction: column; }
        .blog-header { text-align: center; padding: 2rem 1.5rem 1rem; border-bottom: 1px solid var(--border); }
        .blog-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.25rem; }
        .blog-header h1 a { color: var(--text); text-decoration: none; }
        .blog-header h1 a:hover { color: var(--accent); }
        .blog-header p { font-size: 0.85rem; color: var(--text-secondary); margin: 0; }
        .blog-header nav { margin-top: 0.75rem; display: flex; gap: 1.5rem; justify-content: center; font-size: 0.85rem; }
        .blog-header nav a { color: var(--text-secondary); text-decoration: none; }
        .blog-header nav a:hover, .blog-header nav a.active { color: var(--accent); }
        .blog-container { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; flex: 1; width: 100%; }
        .blog-card { background: var(--surface); border-radius: var(--radius-lg); box-shadow: var(--shadow); padding: 1.5rem; margin-bottom: 1.5rem; transition: box-shadow 0.2s; }
        .blog-card:hover { box-shadow: var(--shadow-lg); }
        .blog-card h2 { font-size: 1.2rem; margin: 0 0 0.5rem; }
        .blog-card h2 a { color: var(--text); text-decoration: none; }
        .blog-card h2 a:hover { color: var(--accent); }
        .blog-card .meta { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem; }
        .blog-card .meta span + span::before { content: ' · '; }
        .blog-card .excerpt { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; }
        .blog-card .cover { width: 100%; border-radius: var(--radius); margin-bottom: 1rem; aspect-ratio: 16/9; object-fit: cover; }
        .blog-post-content { font-size: 1rem; line-height: 1.8; color: var(--text); }
        .blog-post-content h2 { font-size: 1.3rem; margin: 2rem 0 0.75rem; }
        .blog-post-content h3 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; }
        .blog-post-content p { margin-bottom: 1rem; }
        .blog-post-content img { max-width: 100%; border-radius: var(--radius); margin: 1rem 0; }
        .blog-post-content pre { background: var(--bg); padding: 1rem; border-radius: var(--radius); overflow-x: auto; margin: 1rem 0; }
        .blog-post-content code { font-family: 'Fira Code', monospace; font-size: 0.9em; }
        .blog-post-content blockquote { border-left: 3px solid var(--accent); padding-left: 1rem; color: var(--text-secondary); margin: 1rem 0; }
        .blog-post-content a { color: var(--accent); }
        .blog-post-content ul, .blog-post-content ol { padding-left: 1.5rem; margin-bottom: 1rem; }
        .blog-post-content li { margin-bottom: 0.25rem; }
        .blog-post-title { font-size: 1.6rem; font-weight: 700; margin: 0 0 0.75rem; }
        .blog-post-meta { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
        .blog-post-meta span + span::before { content: ' · '; }
        .pagination { display: flex; justify-content: center; gap: 0.5rem; margin-top: 2rem; }
        .pagination a, .pagination span { padding: 0.5rem 1rem; border-radius: var(--radius); font-size: 0.85rem; text-decoration: none; }
        .pagination a { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
        .pagination a:hover { border-color: var(--accent); color: var(--accent); }
        .pagination span.current { background: var(--accent); color: #fff; }
        .blog-empty { text-align: center; color: var(--text-secondary); padding: 3rem 0; }
        .blog-back { display: inline-block; margin-bottom: 1.5rem; color: var(--accent); text-decoration: none; font-size: 0.85rem; }
        .blog-back:hover { text-decoration: underline; }
        .blog-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.5rem; }
        .blog-tag { display: inline-block; padding: 0.25rem 0.75rem; background: var(--bg); border-radius: 999px; font-size: 0.75rem; color: var(--text-secondary); text-decoration: none; }
        .blog-tag:hover { color: var(--accent); background: #eef0ff; }
    </style>
    ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
</head>
<body>
    <div class="blog-page">
        <div class="blog-header">
            <h1><a href="/">${escapeHtml(settings.site_title || 'Photo Frame Maker')}</a></h1>
            <p>by <a href="https://www.instagram.com/dyno/" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:none;">DY</a></p>
            <nav>
                <a href="/">도구</a>
                <a href="/blog/" class="${extra.navActive === 'blog' ? 'active' : ''}">블로그</a>
                <a href="/about.html">소개</a>
            </nav>
        </div>
        <div class="blog-container">
            ${content}
        </div>
        <footer class="footer">
            <p>&copy; 2026 <a href="https://324.ing" target="_blank" rel="noopener noreferrer">324.ing</a> &middot; Built by photographer <a href="https://www.instagram.com/dyno/" target="_blank" rel="noopener noreferrer">DY</a></p>
        </footer>
    </div>
</body>
</html>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// Blog list page
app.get('/blog', (c) => c.redirect('/blog/'));
app.get('/blog/', async (c) => {
    const settings = await getSettings(c.env.DB);
    const page = parseInt(c.req.query('page') || '1');
    const category = c.req.query('category') || '';
    const tag = c.req.query('tag') || '';
    const perPage = parseInt(settings.posts_per_page || '10');
    const offset = (page - 1) * perPage;

    let query = "SELECT id, title, slug, excerpt, cover_image, category, tags, published_at, view_count FROM posts WHERE status = 'published'";
    let countQuery = "SELECT COUNT(*) as total FROM posts WHERE status = 'published'";
    const params = [];

    if (category) {
        query += ' AND category = ?';
        countQuery += ' AND category = ?';
        params.push(category);
    }
    if (tag) {
        query += ' AND tags LIKE ?';
        countQuery += ' AND tags LIKE ?';
        params.push(`%"${tag}"%`);
    }

    query += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
    const total = (await c.env.DB.prepare(countQuery).bind(...params).first()).total;
    const posts = (await c.env.DB.prepare(query).bind(...params, perPage, offset).all()).results;
    const totalPages = Math.ceil(total / perPage);

    let title = settings.blog_title || 'Blog';
    if (category) title = `${category} — ${title}`;
    if (tag) title = `#${tag} — ${title}`;

    let postsHtml = '';
    if (posts.length === 0) {
        postsHtml = '<div class="blog-empty"><p>아직 게시된 글이 없습니다.</p></div>';
    } else {
        for (const post of posts) {
            const tags = JSON.parse(post.tags || '[]');
            postsHtml += `
            <article class="blog-card">
                ${post.cover_image ? `<img class="cover" src="${escapeHtml(post.cover_image)}" alt="${escapeHtml(post.title)}">` : ''}
                <h2><a href="/blog/${escapeHtml(post.slug)}/">${escapeHtml(post.title)}</a></h2>
                <div class="meta">
                    <span>${formatDate(post.published_at)}</span>
                    ${post.category ? `<span><a href="/blog/?category=${encodeURIComponent(post.category)}" style="color:inherit;text-decoration:none;">${escapeHtml(post.category)}</a></span>` : ''}
                </div>
                ${post.excerpt ? `<p class="excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
            </article>`;
        }
    }

    // Pagination
    if (totalPages > 1) {
        postsHtml += '<div class="pagination">';
        const baseUrl = category ? `/blog/?category=${encodeURIComponent(category)}&` : tag ? `/blog/?tag=${encodeURIComponent(tag)}&` : '/blog/?';
        if (page > 1) postsHtml += `<a href="${baseUrl}page=${page - 1}">&laquo; 이전</a>`;
        for (let i = 1; i <= totalPages; i++) {
            if (i === page) postsHtml += `<span class="current">${i}</span>`;
            else postsHtml += `<a href="${baseUrl}page=${i}">${i}</a>`;
        }
        if (page < totalPages) postsHtml += `<a href="${baseUrl}page=${page + 1}">다음 &raquo;</a>`;
        postsHtml += '</div>';
    }

    const siteUrl = settings.site_url || 'https://f.324.ing';
    const html = renderLayout(title, settings.blog_description || '', postsHtml, settings, {
        canonical: `${siteUrl}/blog/`,
        ogType: 'blog',
        navActive: 'blog'
    });
    return c.html(html);
});

// Blog post detail page
app.get('/blog/:slug', (c) => c.redirect(`/blog/${c.req.param('slug')}/`));
app.get('/blog/:slug/', async (c) => {
    const slug = c.req.param('slug');

    const post = await c.env.DB.prepare(
        "SELECT * FROM posts WHERE slug = ? AND status = 'published'"
    ).bind(slug).first();

    if (!post) {
        const settings = await getSettings(c.env.DB);
        return c.html(renderLayout('Not Found', '', '<div class="blog-empty"><p>글을 찾을 수 없습니다.</p><a href="/blog/" class="blog-back">블로그로 돌아가기</a></div>', settings, { navActive: 'blog' }), 404);
    }

    // Increment view count
    await c.env.DB.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').bind(post.id).run();

    const settings = await getSettings(c.env.DB);
    const siteUrl = settings.site_url || 'https://f.324.ing';
    const title = post.meta_title || post.title;
    const description = post.meta_description || post.excerpt || '';
    const tags = JSON.parse(post.tags || '[]');

    let tagsHtml = '';
    if (tags.length > 0) {
        tagsHtml = '<div class="blog-tags">' + tags.map(t => `<a class="blog-tag" href="/blog/?tag=${encodeURIComponent(t)}">#${escapeHtml(t)}</a>`).join('') + '</div>';
    }

    const content = `
        <a href="/blog/" class="blog-back">&larr; 블로그 목록</a>
        <article>
            <h1 class="blog-post-title">${escapeHtml(post.title)}</h1>
            <div class="blog-post-meta">
                <span>${formatDate(post.published_at)}</span>
                ${post.category ? `<span>${escapeHtml(post.category)}</span>` : ''}
                <span>조회 ${post.view_count || 0}</span>
            </div>
            ${post.cover_image ? `<img src="${escapeHtml(post.cover_image)}" alt="${escapeHtml(post.title)}" style="width:100%;border-radius:var(--radius-lg);margin-bottom:2rem;">` : ''}
            <div class="blog-post-content">${post.content}</div>
            ${tagsHtml}
        </article>`;

    const jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title,
        "description": description,
        "image": post.og_image || post.cover_image || settings.og_default_image || '',
        "datePublished": post.published_at,
        "dateModified": post.updated_at,
        "author": { "@type": "Person", "name": settings.site_author || 'DY', "url": "https://www.instagram.com/dyno/" },
        "publisher": { "@type": "Organization", "name": "324.ing", "url": "https://324.ing" },
        "mainEntityOfPage": `${siteUrl}/blog/${post.slug}/`
    });

    return c.html(renderLayout(`${title} — ${settings.blog_title || 'Blog'}`, description, content, settings, {
        canonical: `${siteUrl}/blog/${post.slug}/`,
        ogType: 'article',
        ogImage: post.og_image || post.cover_image || '',
        navActive: 'blog',
        jsonLd
    }));
});

// --- RSS Feed ---

app.get('/feed.xml', async (c) => {
    const settings = await getSettings(c.env.DB);
    const siteUrl = settings.site_url || 'https://f.324.ing';
    const posts = (await c.env.DB.prepare(
        "SELECT title, slug, excerpt, content, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 20"
    ).all()).results;

    let items = '';
    for (const p of posts) {
        items += `
    <item>
        <title><![CDATA[${p.title}]]></title>
        <link>${siteUrl}/blog/${p.slug}/</link>
        <guid>${siteUrl}/blog/${p.slug}/</guid>
        <description><![CDATA[${p.excerpt || ''}]]></description>
        <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
    </item>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>${escapeHtml(settings.blog_title || 'Blog')}</title>
    <link>${siteUrl}/blog/</link>
    <description>${escapeHtml(settings.blog_description || '')}</description>
    <language>ko</language>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
</channel>
</rss>`;

    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
});

// --- Dynamic Sitemap ---

app.get('/sitemap.xml', async (c) => {
    const settings = await getSettings(c.env.DB);
    const siteUrl = settings.site_url || 'https://f.324.ing';
    const posts = (await c.env.DB.prepare(
        "SELECT slug, updated_at FROM posts WHERE status = 'published' ORDER BY published_at DESC"
    ).all()).results;

    let urls = `
    <url><loc>${siteUrl}/</loc><priority>1.0</priority></url>
    <url><loc>${siteUrl}/blog/</loc><priority>0.8</priority><changefreq>daily</changefreq></url>
    <url><loc>${siteUrl}/about/</loc><priority>0.5</priority></url>`;

    for (const p of posts) {
        urls += `
    <url><loc>${siteUrl}/blog/${p.slug}/</loc><lastmod>${p.updated_at}</lastmod><priority>0.7</priority></url>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
});

// --- Fallback: serve static assets ---

app.all('*', async (c) => {
    return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
