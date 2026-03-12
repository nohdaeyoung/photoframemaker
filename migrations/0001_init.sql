-- Blog posts
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    excerpt TEXT DEFAULT '',
    cover_image TEXT DEFAULT '',
    category TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
    meta_title TEXT DEFAULT '',
    meta_description TEXT DEFAULT '',
    og_image TEXT DEFAULT '',
    view_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);

-- Site settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

-- Initial settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('site_title', 'Photo Frame Maker by DY | 324.ing'),
    ('site_description', 'Free online photo frame maker with Instagram feed and profile frame modes.'),
    ('site_keywords', 'photo frame maker, instagram frame generator, 사진 프레임 만들기'),
    ('site_author', 'DY'),
    ('site_url', 'https://f.324.ing'),
    ('og_default_image', 'https://f.324.ing/og-image.png'),
    ('blog_title', 'Blog — Photo Frame Maker'),
    ('blog_description', 'Photography tips, framing guides, and updates'),
    ('posts_per_page', '10'),
    ('ga_id', 'G-ZE7EBPTLFG'),
    ('gtm_id', 'GTM-5F5CWSJX');
