# CLAUDE.md

## 프로젝트 개요

**Photo Frame Maker** — 사진에 프레임을 추가하고 고화질로 저장하는 웹/모바일 앱.
by DY (https://www.instagram.com/dyno/)

## 기술 스택

- **프론트엔드**: HTML5, CSS3, Vanilla JavaScript (ES6+, 클래스 기반)
- **렌더링**: Canvas 2D API
- **모바일 앱**: Capacitor 8.1.0 (Android)
- **배포**: Cloudflare Workers (wrangler)
- **외부 라이브러리**: JSZip 3.10.1 (CDN, ZIP 다운로드용)
- **프레임워크 없음** — 순수 JS로 유지할 것

## 파일 구조

```
├── index.html              # 메인 HTML
├── app.js                  # 앱 전체 로직 (PhotoFrameMaker 클래스, ~1,500줄)
├── style.css               # 전체 스타일 (CSS 변수, 반응형)
├── capacitor.config.ts     # Capacitor 설정 (appId: com.dy.photoframemaker)
├── package.json            # 빌드 스크립트, Capacitor 의존성
├── wrangler.jsonc           # Cloudflare Workers 배포 설정
├── android/                # Capacitor Android 네이티브 프로젝트
├── www/                    # 빌드 출력 (gitignore, cap:sync 시 생성)
├── devnote.html / .md      # 개발 노트
├── prompt.html / .md       # 프롬프트 로그
├── PLAN.md                 # 기능 기획 문서
└── DEV.md / README.md      # 문서
```

## 주요 기능

- 최대 10장 이미지 업로드, 동일 프레임 설정 일괄 적용
- 캔버스 비율: 1:1, 4:5, 3:4, 9:16, 4:3, 3:2, 2:3
- 프레임 두께 (0~25%), 색상 (8 프리셋 + 커스텀 컬러피커)
- 캔버스 크기 조절 (100~10,000px)
- 드래그로 이미지 위치 조정 (offset clamping)
- 프리뷰 모드: 기본, 인스타그램 피드, 인스타그램 프로필
- EXIF 데이터 표시 (카메라, 렌즈, 조리개 등)
- 다운로드: 단일 PNG / 다중 ZIP / 모바일 Web Share API
- 모바일 스와이프 네비게이션
- 썸네일 스트립 (다중 이미지)

## CSS 규칙

### 변수 (`:root`)
```css
--bg: #f5f6f8          --surface: #ffffff
--text: #1a1a2e        --text-secondary: #6b7280
--border: #e2e5ea      --accent: #4361ee
--accent-hover: #3a56d4
--radius: 8px          --radius-lg: 12px
```

### 반응형 브레이크포인트
- `@media (max-width: 900px)`: 모바일 레이아웃 (탭 바, 그리드 정렬)
- `@media (max-width: 480px)`: 컴팩트 모바일
- 모바일 `.preview-area`는 **CSS Grid** 사용 (`justify-items: center`, `align-content: start`)
- `100dvh` 사용 (dynamic viewport height)

### 네이밍
- CSS 클래스: kebab-case (`.preview-container`, `.thumbnail-item`)
- data 속성: kebab-case (`data-mode`, `data-index`, `data-ratio`)
- ID: kebab-case (`preview-canvas`, `mobile-tab-bar`)

## JS 아키텍처

### 클래스 구조
단일 `PhotoFrameMaker` 클래스. 프레임워크 없이 유지.

### 핵심 상태
```javascript
images[]           // 이미지 배열 (max 10)
currentIndex       // 현재 선택 인덱스
canvasRatio [w,h]  // 캔버스 비율
canvasSize         // 긴 변 기준 px
frameRatio         // 프레임 두께 (0~0.25)
frameColor         // 프레임 색상
previewMode        // 'default' | 'feed' | 'profile'
```

### 이미지 아이템 구조
```javascript
{ image, imageUrl, fileName, fileSize, imageOffset: {x, y}, exifData }
```

### 주요 메서드 그룹
- **계산**: `getCanvasDimensions()`, `getFrameWidth()`, `getPhotoArea()`, `getDrawDimensions()`
- **렌더링**: `render()`, `drawImage()`, `updatePreviewMode()`, `updateMockupImages()`
- **이미지 관리**: `loadImages()`, `selectImage()`, `removeImage()`, `onImagesChanged()`
- **UI 업데이트**: `updateThumbnailStrip()`, `updatePreviewContainerSize()`, `updateInfo()`
- **다운로드**: `download()`, `downloadSingle()`, `downloadAsZip()`, `renderItemToBlob()`
- **EXIF**: `parseExifForItem()`, `readExifFromBuffer()` (자체 파서, 외부 라이브러리 없음)

### 핵심 패턴
- `onImagesChanged()`: 이미지 변경 후 모든 UI 갱신을 중앙 관리
- offset clamping: 이미지가 포토 영역 밖으로 드래그 방지
- 스와이프: <300ms, >50px 수평이동, 수평>수직 → 네비게이션
- Web Share API: 유저 제스처 컨텍스트 보존 필요 (async IIFE로 감싸지 말 것)
- `URL.revokeObjectURL()`: 이미지 제거 시 반드시 호출 (메모리 누수 방지)

## 빌드 & 배포

### 스크립트
```bash
npm run build              # 웹 파일 → www/ 복사
npm run cap:sync           # build + Capacitor 동기화
npm run cap:open:android   # Android Studio 열기
npm run cap:run:android    # 빌드 + Android 실행
```

### Cloudflare 배포
- `wrangler` CLI로 배포
- 루트 디렉토리의 정적 파일 서빙

### 캐시 무효화
- `index.html`에서 `?v=Date.now()` 타임스탬프로 CSS/JS 캐시 버스팅

## 개발 주의사항

1. **순수 JS 유지** — 프레임워크 도입하지 않기
2. **모바일 필수 테스트** — 데스크톱(900px+)과 모바일(<900px) 양쪽 확인
3. **CSS 변수 사용** — 하드코딩 색상 대신 항상 변수 사용
4. **safe-area-inset** — 노치 대응 시 `env(safe-area-inset-*)` 사용
5. **이벤트 위임** — 동적 썸네일 등에는 부모 컨테이너에 이벤트 바인딩
6. **Blob URL 해제** — 이미지 제거 시 `URL.revokeObjectURL()` 호출
7. **EXIF 파서** — 자체 구현, 태그 오프셋과 엔디안 주의
8. **UI 이중 구조** — 데스크톱 사이드바 + 모바일 탭바, 기능 동등성 유지

---

## EXIF 프레임 모드 (`/exif.html`)

### 아키텍처

```
exif.html                        EXIF 프레임 전용 페이지
app.js (ExifApp 초기화)          ExifApp 인스턴스 생성 및 마운트
js/modes/exif-mode.js            ExifApp 클래스 (AppBase 상속)
js/overlays/exif-overlays.js     18개 오버레이 드로잉 함수
```

### ExifApp 핵심 특징

- `getFrameWidth()` 오버라이드 → 항상 `0` (프레임 없음)
- `renderMode()`: 원본 이미지 치수 기준으로 스타일별 자연 캔버스 크기 계산, 별도 패딩 없음
- `getExifOverlayDimensions()`: 스타일별 `canvasWidth/Height`, `imageX/Y/W/H`, `barX/Y/W/H` 반환
- `_drawExifOverlay()`: `exifStyle` 값으로 해당 오버레이 함수 디스패치

### 18개 EXIF 스타일

| 스타일 | 캔버스 확장 방향 | 전용 옵션 |
|--------|----------------|-----------|
| filmstrip | 상하 (stripH×2) | 필름 브랜드 |
| minimal | 없음 (이미지 위 오버레이) | — |
| magazine | 좌측 (barW) | — |
| signature | 하단 (barH) | — |
| letterbox | 상하 (barH×2) | — |
| polaroid | 상하 (topH+botH) | 폰트 |
| leica | 하단 (barH) | — |
| fujistyle | 상하 (topH+botH) | — |
| fujirecipe | 상하 (topM+barH) | — |
| glass | 없음 (이미지 위 오버레이) | 테마, 위치 |
| leicalux | 하단 (barH) | — |
| instax | 사방 (sideM×2 + botH) | 폰트 |
| filmstock | 상하 (stripH×2) | 필름 브랜드 |
| shoton | 하단 (barH) | — |
| editorial | 사방 (margin×2 + barH) | — |
| hud | 상하 (topH+botH) | 액센트 색상 |
| minimalbar | 하단 (barH) | — |
| cardgrid | 하단 (barH) | 카드 레이아웃 (1~6) |

### 다운로드

`js/utils/download.js` → `downloadExifFrame()`:
- `app.getExifOverlayDimensions(원본 해상도)`로 오프스크린 캔버스 크기 결정
- `app._drawExifOverlay()` 호출로 오버레이 합성 후 PNG 다운로드

### UI 주의사항

- 프레임 비율/색상 섹션: `display:none` (EXIF 모드 불필요)
- AppBase stub 엘리먼트 div: `display:none` (다운로드 버튼 위 불필요한 인풋 방지)
- 데스크톱/모바일 이중 구조 동일하게 유지

---

## Featured 랜딩 페이지 (`/featured/`)

### 기술 스택
- React 19 + Vite + TypeScript + Tailwind CSS v4 + Framer Motion
- 빌드: `cd featured-landing && npm run build`
- 소스: `/Volumes/Dev/daeyoung-openclaw-main/featured-landing/`

### 컴포넌트 구조
```
featured-landing/src/
  components/
    layout/   Navbar.tsx, Footer.tsx
    sections/ HeroSection, ModesSection, StepSection, ColorsSection,
              ExifSection, PreviewSection, FAQSection, CTASection
    ui/       FrameMockup.tsx (히어로 이미지 + EXIF 바)
  App.tsx     메인 레이아웃
  main.tsx    엔트리포인트
```

### 배포 방법
```bash
# 1. 빌드
cd /Volumes/Dev/daeyoung-openclaw-main/featured-landing && npm run build

# 2. 양쪽에 복사
cp -r dist/* /Volumes/Dev/photoframemaker/www/featured/
mkdir -p /Volumes/Dev/daeyoung-openclaw-main/featured && cp -r dist/* /Volumes/Dev/daeyoung-openclaw-main/featured/

# 3. Cloudflare Workers 배포
cd /Volumes/Dev/photoframemaker && npm run build && npx wrangler deploy

# 4. Vercel 배포
cd /Volumes/Dev/daeyoung-openclaw-main && npx vercel --prod --yes
```

### 주의사항
- Vite `base: '/featured/'` 필수 (서브디렉토리 배포)
- 히어로 이미지: `public/hero-photo.jpg` (FUJIFILM GFX100RF, 35mm f/4.0 1/2500s ISO 400)
- 네비게이션 순서: Featured → Tools → Blog → Dev Note → About (site.js, worker.js와 동기화)

---

## 블로그 시스템 (Blog + Admin)

### 호스팅 아키텍처 (중요!)

```
f.324.ing  →  Vercel (정적 파일 서빙, outputDirectory: ".")
               ↓ 프록시 (vercel.json rewrites)
/blog/*    →  Cloudflare Workers (photoframemaker.dynoworld.workers.dev)
/api/*     →  Cloudflare Workers
/admin/*   →  Cloudflare Workers
/uploads/* →  Cloudflare Workers
/feed.xml  →  Cloudflare Workers
/sitemap.xml → Cloudflare Workers
```

**핵심**: 정적 파일(favicon, og-image 등)은 **프로젝트 루트**에 있어야 Vercel에서 서빙됨. `www/`는 Cloudflare Workers용.

### 배포 방법

```bash
# Vercel 배포 (f.324.ing 정적 파일 반영)
cd /Users/dyno/photoframemaker && vercel --prod --yes

# Cloudflare Workers 배포 (blog/api/admin 반영)
cd /Users/dyno/photoframemaker && npx wrangler deploy
```

### Cloudflare 리소스

- **Workers**: `photoframemaker.dynoworld.workers.dev` (`src/worker.js`, Hono 프레임워크)
- **D1 DB**: `photoframemaker-blog` (id: `1516098c-cc66-4781-bd4b-425ea5057ca8`)
- **R2 Bucket**: `photoframemaker-uploads` (업로드 파일 저장)

### D1 테이블 구조

```sql
posts       -- id, title, slug, content(Markdown), excerpt, cover_image, og_image,
            --  status('draft'|'published'), published_at, created_at, updated_at
settings    -- key, value (KV 형태)
sessions    -- token, expires_at (쿠키 기반 인증)
users       -- id, password_hash (SHA-256, Web Crypto API)
rate_limits -- ip, endpoint, count, window_start
```

### 설정 키 (settings 테이블)

```
site_title, site_description, site_keywords, site_author, site_url
blog_title, blog_description, posts_per_page
og_default_image, favicon_url   ← R2 URL 또는 정적 경로
ga_id, gtm_id
```

### 어드민

- **URL**: `https://f.324.ing/admin/login.html`
- **비밀번호 저장 위치**: Cloudflare Workers 시크릿 `ADMIN_PASSWORD_HASH` (D1 users 테이블 아님!)
- **비밀번호 변경 방법** (zsh에서 `!` 포함 비밀번호 주의):
  ```bash
  # 1. 해시 생성 (shasum 대신 node 사용 — zsh에서 ! 문자 확장 문제 방지)
  node -e "require('crypto').createHash('sha256').update('NEW_PASSWORD').digest('hex')"

  # 2. Cloudflare Workers 시크릿 업데이트
  npx wrangler secret put ADMIN_PASSWORD_HASH
  # 프롬프트에 해시값 붙여넣기
  ```

### worker.js 주요 라우트 (src/worker.js)

```
POST /api/auth/login          로그인 (쿠키 세션)
POST /api/auth/logout         로그아웃
GET  /api/auth/check          인증 상태 확인

GET  /api/posts               공개 글 목록
GET  /api/posts/:slug         공개 글 상세
GET  /api/settings/public     공개 설정 (사이트 정보)

GET  /api/admin/posts         관리자 글 목록
POST /api/admin/posts         글 생성
PUT  /api/admin/posts/:id     글 수정
DEL  /api/admin/posts/:id     글 삭제
GET  /api/admin/settings      설정 조회
PUT  /api/admin/settings      설정 저장
POST /api/admin/upload        R2 업로드 (이미지/파일)
GET  /api/admin/stats         통계

GET  /favicon.ico             settings.favicon_url(R2) 또는 정적 fallback
GET  /blog/                   SSR 블로그 목록
GET  /blog/:slug/             SSR 블로그 글 상세
GET  /feed.xml                RSS
GET  /sitemap.xml             사이트맵
```

### 파일 구조 (블로그 관련)

```
src/worker.js           Hono 기반 Workers 엔트리
admin/
  login.html            로그인 페이지
  dashboard.html        대시보드
  posts.html            글 목록 관리
  editor.html           글 작성/수정 (Markdown)
  settings.html         사이트 설정 (favicon, og image 업로드 포함)
  admin.css             어드민 전용 스타일
migrations/             D1 마이그레이션 SQL
schema.sql              전체 스키마
vercel.json             Vercel 설정 (rewrites, headers)
wrangler.jsonc          Cloudflare Workers 설정
favicon.ico             ← 루트에 있어야 Vercel 서빙됨
og-image.png            ← 루트에 있어야 Vercel 서빙됨
favicon_*.png           ← 루트에 있어야 Vercel 서빙됨
images/                 원본 이미지 소스 (favicon, og-image)
www/                    Cloudflare Workers 정적 파일 (빌드 출력)
```

### 알려진 이슈 & 해결책

1. **파비콘/이미지 Vercel 미반영**: 파일이 루트에 없으면 HTML 반환. `images/`에서 루트로 복사 후 `vercel --prod --yes`
2. **비밀번호 해시 오류**: zsh에서 `!` 포함 비밀번호는 `shasum` 대신 `node` 사용
3. **블로그 nav `/about/` 깨짐**: worker.js SSR에서 `/about.html`로 링크해야 함 (Vercel 정적 파일)
4. **블로그 헤더 하드코딩 주의**: worker.js `renderLayout()`의 settings 변수 사용 확인
