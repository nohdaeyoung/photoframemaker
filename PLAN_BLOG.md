# Photo Frame Maker — 블로그 & 어드민 시스템 기획서

## 1. 시스템 아키텍처

### 현재 구조
- **프론트엔드**: 정적 HTML/CSS/JS (프레임워크 없음)
- **배포**: Cloudflare Workers (정적 에셋 서빙)
- **데이터베이스**: 없음

### 제안 아키텍처

```
┌─────────────────────────────────────────────┐
│              Cloudflare Edge                │
│                                             │
│  ┌─────────────┐    ┌────────────────────┐  │
│  │   Workers    │    │   Static Assets    │  │
│  │   (API)      │    │   (./www)          │  │
│  │             │    │                    │  │
│  │  /api/*     │    │  /*.html           │  │
│  │             │    │  /blog/*.html      │  │
│  │             │    │  /admin/*.html     │  │
│  └──────┬──────┘    └────────────────────┘  │
│         │                                   │
│  ┌──────┴──────┐    ┌────────────────────┐  │
│  │  Cloudflare │    │   Cloudflare R2    │  │
│  │  D1 (SQLite)│    │   (이미지 저장)     │  │
│  └─────────────┘    └────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 기술 선택 근거

| 구성요소 | 선택 | 이유 |
|---------|------|------|
| **백엔드** | Cloudflare Workers | 이미 사용 중, 추가 서버 불필요 |
| **데이터베이스** | Cloudflare D1 (SQLite) | Workers와 네이티브 통합, SQL 지원, 무료 티어 충분 |
| **이미지 저장소** | Cloudflare R2 | S3 호환, egress 무료, Workers와 바인딩 |
| **인증** | JWT + bcrypt (Workers 내장) | 단일 관리자, 별도 OAuth 불필요 |
| **프론트엔드** | Vanilla JS (기존 유지) | 프로젝트 철학 준수 |
| **WYSIWYG** | Toast UI Editor | 한국어 지원, 마크다운+위지윅 듀얼 모드, 경량 |

---

## 2. 필요한 페이지 목록

### 공개 페이지 (Public)
| 페이지 | URL | 설명 |
|--------|-----|------|
| 블로그 목록 | `/blog/` | 게시글 목록, 페이지네이션, 카테고리 필터 |
| 블로그 상세 | `/blog/{slug}/` | 개별 게시글, SEO 메타 태그 |
| 카테고리별 목록 | `/blog/category/{name}/` | 카테고리 필터링된 목록 |
| RSS 피드 | `/blog/rss.xml` | RSS 2.0 피드 |

### 어드민 페이지 (Admin)
| 페이지 | URL | 설명 |
|--------|-----|------|
| 로그인 | `/admin/login.html` | 관리자 로그인 |
| 대시보드 | `/admin/` | 통계 요약, 최근 글 |
| 글 관리 | `/admin/posts.html` | 게시글 목록, 검색, 삭제 |
| 글 작성/수정 | `/admin/editor.html` | WYSIWYG 에디터 |
| 미디어 관리 | `/admin/media.html` | 미디어 라이브러리 |
| 사이트 설정 | `/admin/settings.html` | 사이트 타이틀, 메타 태그 관리 |

---

## 3. 데이터 모델

### 블로그 게시글 (posts)
```sql
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,           -- HTML 콘텐츠
    excerpt TEXT,                    -- 요약 (목록/메타용)
    cover_image TEXT,                -- R2 이미지 URL
    category TEXT DEFAULT 'general',
    tags TEXT,                       -- JSON 배열 문자열
    status TEXT DEFAULT 'draft',     -- 'draft' | 'published'
    meta_title TEXT,                 -- SEO 제목 (없으면 title 사용)
    meta_description TEXT,           -- SEO 설명 (없으면 excerpt 사용)
    og_image TEXT,                   -- Open Graph 이미지
    view_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    published_at TEXT                -- 발행 시각
);

CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_category ON posts(category);
CREATE INDEX idx_posts_published_at ON posts(published_at DESC);
```

### 사이트 설정 (settings)
```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 초기 데이터
INSERT INTO settings (key, value) VALUES
    ('site_title', 'Photo Frame Maker — Instagram Feed & Profile Frame Generator | 324.ing'),
    ('site_description', 'Free online photo frame maker with Instagram feed and profile frame modes.'),
    ('site_keywords', 'photo frame maker, instagram frame generator, 사진 프레임 만들기'),
    ('site_author', 'Noh Daeyoung (DY)'),
    ('og_default_image', ''),
    ('analytics_id', 'G-ZE7EBPTLFG'),
    ('gtm_id', 'GTM-5F5CWSJX'),
    ('posts_per_page', '10'),
    ('blog_title', 'Blog — Photo Frame Maker'),
    ('blog_description', 'Photography tips, framing guides, and Instagram optimization');
```

### 관리자 계정 (admins)
```sql
CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### 미디어 (media)
```sql
CREATE TABLE media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    alt_text TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 4. API 설계

### 인증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 로그인 → JWT 발급 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 인증 상태 확인 |

### 게시글
| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/posts` | 게시글 목록 (공개: published만) | × |
| GET | `/api/posts/:slug` | 게시글 상세 | × |
| POST | `/api/posts` | 게시글 생성 | ✓ |
| PUT | `/api/posts/:id` | 게시글 수정 | ✓ |
| DELETE | `/api/posts/:id` | 게시글 삭제 | ✓ |

### 미디어
| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/media/upload` | 이미지 업로드 (R2) | ✓ |
| GET | `/api/media` | 미디어 목록 | ✓ |
| DELETE | `/api/media/:id` | 미디어 삭제 | ✓ |

### 설정
| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/settings` | 설정 조회 | △ (공개 키만) |
| PUT | `/api/settings` | 설정 일괄 수정 | ✓ |

### 기타
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/sitemap` | 동적 사이트맵 생성 |
| GET | `/blog/rss.xml` | RSS 피드 |

---

## 5. 프론트엔드 구조

### 디렉토리 구조 (추가분)
```
├── blog/
│   ├── index.html          # 블로그 목록 페이지
│   └── post.html           # 블로그 상세 페이지 (SPA-like, slug로 로딩)
├── admin/
│   ├── index.html          # 어드민 대시보드
│   ├── login.html          # 로그인 페이지
│   ├── posts.html          # 글 관리
│   ├── editor.html         # 글 작성/수정 (WYSIWYG)
│   ├── media.html          # 미디어 라이브러리
│   ├── settings.html       # 사이트 설정
│   ├── admin.js            # 어드민 공통 로직
│   └── admin.css           # 어드민 스타일
├── blog.js                 # 블로그 프론트 로직
├── blog.css                # 블로그 스타일
└── src/                    # Workers 소스 (API)
    └── worker.js           # Cloudflare Worker 엔트리
```

### 블로그 목록 페이지 구현 방식
- 정적 HTML 셸 + API로 게시글 동적 로딩
- 페이지네이션: `?page=2` 쿼리 파라미터
- 카테고리 필터: `?category=tutorial`
- 초기 로딩 시 스켈레톤 UI 표시

### 블로그 상세 페이지 구현 방식
- URL: `/blog/{slug}/` → SPA 폴백으로 `post.html` 로딩
- JavaScript로 URL에서 slug 추출 → API 호출 → 콘텐츠 렌더링
- SSR 불가하므로 SEO를 위해 Workers에서 메타 태그 주입 필요 (아래 SEO 섹션 참조)

---

## 6. WYSIWYG 에디터 선정

### 비교 분석

| 에디터 | 크기 | 한국어 | 마크다운 | 이미지 업로드 | 라이선스 |
|--------|------|--------|----------|-------------|---------|
| **Toast UI Editor** | ~300KB | ✓ 네이티브 | ✓ 듀얼모드 | ✓ 플러그인 | MIT |
| Quill | ~40KB | △ i18n 없음 | △ 제한적 | △ 커스텀 필요 | BSD |
| TinyMCE | ~500KB | ✓ | × | ✓ | LGPL/상용 |
| CKEditor 5 | ~400KB | ✓ | △ | ✓ | GPL/상용 |

### 추천: Toast UI Editor
- **한국어 네이티브 지원** (NHN 개발)
- 마크다운 ↔ WYSIWYG 듀얼 모드
- 이미지 업로드 훅 내장
- MIT 라이선스
- CDN 사용 가능

```html
<!-- CDN -->
<link rel="stylesheet" href="https://uicdn.toast.com/editor/latest/toastui-editor.min.css">
<script src="https://uicdn.toast.com/editor/latest/toastui-editor-all.min.js"></script>
```

---

## 7. SEO 최적화 전략

### 핵심 과제: SPA의 SEO 한계 극복

Vanilla JS SPA에서 블로그 상세 페이지의 메타 태그를 동적으로 설정해야 함.
검색 엔진 크롤러는 JavaScript를 제한적으로 실행하므로 Workers에서 HTML을 전처리해야 함.

### Workers 메타 태그 주입 방식

```javascript
// Worker에서 /blog/{slug}/ 요청 시:
// 1. D1에서 게시글 메타 정보 조회
// 2. post.html 템플릿의 <head>에 메타 태그 주입
// 3. 수정된 HTML 반환

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        const blogMatch = url.pathname.match(/^\/blog\/([a-z0-9-]+)\/?$/);
        if (blogMatch) {
            const slug = blogMatch[1];
            const post = await env.DB.prepare(
                'SELECT title, meta_description, og_image FROM posts WHERE slug = ? AND status = ?'
            ).bind(slug, 'published').first();

            if (post) {
                let html = await env.ASSETS.fetch(new URL('/blog/post.html', url)).then(r => r.text());
                html = html.replace('<!--META_INJECT-->', `
                    <title>${post.title} — Blog | 324.ing</title>
                    <meta name="description" content="${post.meta_description}">
                    <meta property="og:title" content="${post.title}">
                    <meta property="og:description" content="${post.meta_description}">
                    <meta property="og:image" content="${post.og_image || ''}">
                    <meta property="og:type" content="article">
                `);
                return new Response(html, { headers: { 'Content-Type': 'text/html' } });
            }
        }

        return env.ASSETS.fetch(request);
    }
};
```

### 추가 SEO 요소
- **동적 sitemap.xml**: Workers API에서 생성 (모든 게시글 URL 포함)
- **Open Graph / Twitter Card**: 각 게시글별 자동 생성
- **구조화된 데이터 (JSON-LD)**: Article 스키마 자동 삽입
- **canonical URL**: 각 게시글에 자동 설정
- **RSS 피드**: `/blog/rss.xml`

---

## 8. 보안

### 인증 흐름
```
[로그인 폼] → POST /api/auth/login → [Workers: bcrypt 검증]
                                         ↓
                                    JWT 발급 (httpOnly cookie)
                                         ↓
                                    [Admin 페이지 접근]
                                         ↓
                                    각 API 요청 시 JWT 검증
```

### 보안 체크리스트
| 항목 | 구현 방법 |
|------|----------|
| **비밀번호 해싱** | bcrypt (Workers crypto API) |
| **JWT 토큰** | httpOnly, Secure, SameSite=Strict 쿠키 |
| **CSRF 방지** | SameSite 쿠키 + Origin 헤더 검증 |
| **입력 검증** | 서버 측 HTML 새니타이징 (DOMPurify) |
| **XSS 방지** | CSP 헤더, 출력 이스케이핑 |
| **이미지 업로드** | MIME 타입 검증, 파일 크기 제한 (5MB) |
| **Rate Limiting** | Cloudflare 기본 제공 + 로그인 시도 제한 |
| **관리자 접근** | IP 화이트리스트 (선택적) |

---

## 9. 추가 권장 기능

### 필수 (Phase 1과 함께)
| 기능 | 설명 | 우선순위 |
|------|------|---------|
| **이미지 업로드** | R2 저장, 에디터 내 드래그&드롭 | 높음 |
| **드래프트/발행** | status 필드로 관리 | 높음 |
| **URL 슬러그 자동 생성** | 제목에서 자동 생성, 수동 편집 가능 | 높음 |
| **동적 사이트맵** | Workers에서 자동 생성 | 높음 |

### 권장 (Phase 2)
| 기능 | 설명 | 우선순위 |
|------|------|---------|
| **카테고리** | 게시글 분류, 카테고리별 목록 | 중간 |
| **태그** | 다중 태그 지원 | 중간 |
| **RSS 피드** | RSS 2.0 자동 생성 | 중간 |
| **미디어 라이브러리** | 업로드된 이미지 관리 | 중간 |
| **조회수 카운터** | D1에서 카운트 | 중간 |
| **관련 글 추천** | 같은 카테고리의 다른 글 표시 | 중간 |

### 향후 (Phase 3)
| 기능 | 설명 | 우선순위 |
|------|------|---------|
| **소셜 공유 버튼** | 카카오톡, 트위터, 페이스북 | 낮음 |
| **검색 기능** | D1 FTS5 또는 클라이언트 검색 | 낮음 |
| **댓글 시스템** | Giscus (GitHub Discussions) 연동 | 낮음 |
| **다국어 지원** | 한국어/영어 게시글 | 낮음 |
| **이미지 자동 최적화** | R2 업로드 시 리사이즈/WebP 변환 | 낮음 |
| **예약 발행** | 지정 시간에 자동 발행 | 낮음 |

---

## 10. 구현 우선순위 및 로드맵

### Phase 1: 핵심 블로그 시스템 (MVP)
1. Cloudflare D1 데이터베이스 스키마 생성
2. Workers API 구현 (인증, CRUD)
3. 어드민 로그인 페이지
4. 어드민 글 작성/수정 (Toast UI Editor)
5. 어드민 글 관리 (목록, 삭제)
6. 블로그 목록 페이지
7. 블로그 상세 페이지 (Workers 메타 태그 주입)
8. 동적 사이트맵 생성

### Phase 2: 관리 기능 강화
1. 사이트 설정 관리 (어드민)
2. 미디어 라이브러리 (R2)
3. 카테고리/태그 시스템
4. RSS 피드
5. 어드민 대시보드 (통계)

### Phase 3: 고급 기능
1. 소셜 공유
2. 관련 글 추천
3. 검색 기능
4. 이미지 자동 최적화
5. 예약 발행

---

## 11. 비용 예측 (Cloudflare 무료 티어 기준)

| 서비스 | 무료 한도 | 예상 사용량 | 비용 |
|--------|----------|------------|------|
| Workers | 100,000 요청/일 | ~1,000/일 | 무료 |
| D1 | 5M 읽기/일, 100K 쓰기/일 | ~500 읽기/일 | 무료 |
| R2 | 10GB 저장, 1M Class B/월 | ~1GB | 무료 |
| **총 비용** | | | **무료** |

---

## 12. wrangler.jsonc 설정 변경 예시

```jsonc
{
    "name": "photoframemaker",
    "compatibility_date": "2025-09-27",
    "main": "src/worker.js",
    "assets": {
        "directory": "./www",
        "binding": "ASSETS",
        "html_handling": "force-trailing-slash",
        "not_found_handling": "single-page-application"
    },
    "d1_databases": [{
        "binding": "DB",
        "database_name": "photoframemaker-blog",
        "database_id": "<생성 후 ID>"
    }],
    "r2_buckets": [{
        "binding": "MEDIA",
        "bucket_name": "photoframemaker-media"
    }],
    "compatibility_flags": ["nodejs_compat"]
}
```
