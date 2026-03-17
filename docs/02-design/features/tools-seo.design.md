# SEO 최적화 Design — tools.html 및 전체 도구 페이지

> Feature: `tools-seo`
> Created: 2026-03-17
> Plan: `docs/01-plan/features/tools-seo.plan.md`
> Status: Draft

---

## 1. 구현 순서

```
1. tools.html — 완전 SEO 적용 (허브 페이지, 최우선)
2. frame.html — SEO 적용
3. split.html — SEO 적용
4. convert.html — SEO 적용
5. exif.html — SEO 적용
6. newexif/index.html — SEO 적용
7. sitemap.xml — 전체 URL 등록
```

---

## 2. 공통 SEO 헤드 블록 (모든 페이지에 적용)

### 2-1. 트래킹 코드 (GTM + GA + Naver)

`<head>` 최상단, `<meta charset>` 바로 뒤에 삽입:

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5F5CWSJX');</script>
<!-- End Google Tag Manager -->
<meta name="naver-site-verification" content="b4f3d846c16519dab27310ad2d3e28e56f1085ed" />
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-ZE7EBPTLFG"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-ZE7EBPTLFG');
</script>
```

### 2-2. 공통 메타 태그 패턴

```html
<meta name="author" content="Noh Daeyoung (DY)">
<meta name="robots" content="index, follow">
<link rel="canonical" href="{페이지별 canonical URL}">
<link rel="alternate" hreflang="ko" href="{페이지별 canonical URL}">
```

### 2-3. Open Graph 패턴

```html
<meta property="og:title" content="{페이지별 OG title}">
<meta property="og:description" content="{페이지별 OG description}">
<meta property="og:url" content="{페이지별 canonical URL}">
<meta property="og:type" content="website">
<meta property="og:image" content="https://f.324.ing/og-image.png">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="Photo Frame Maker by DY">
```

### 2-4. Twitter Card 패턴

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{페이지별 title}">
<meta name="twitter:description" content="{페이지별 description}">
<meta name="twitter:image" content="https://f.324.ing/og-image.png">
```

---

## 3. 페이지별 상세 명세

### 3-1. tools.html

**변경 위치**: `<head>` 전체 교체

| 항목 | 값 |
|------|-----|
| title | `무료 사진 편집 도구 — 프레임, 분할, 변환, EXIF | Photo Frame Maker by DY` |
| description | `사진작가 DY의 무료 사진 편집 도구 모음. 프레임, 분할, 변환, EXIF 프레임 디자이너. 모든 처리는 브라우저에서 — 서버 업로드 없음.` (유지) |
| keywords | `무료 사진 편집, 사진 프레임, 사진 분할, 이미지 변환, EXIF 프레임, 온라인 이미지 도구, photo frame maker, image converter, photo splitter, exif frame designer` |
| canonical | `https://f.324.ing/` |
| og:title | `무료 사진 편집 도구 — 프레임, 분할, 변환, EXIF | Photo Frame Maker` |
| og:description | `프레임 추가, 분할, 포맷 변환, EXIF 프레임까지. 모든 작업이 브라우저에서 무료로. 서버 업로드 없음.` |
| og:url | `https://f.324.ing/` |

**JSON-LD (tools.html 전용)** — `</head>` 직전에 삽입:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "name": "Photo Frame Maker by DY",
      "url": "https://f.324.ing/",
      "description": "사진작가 DY의 무료 사진 편집 도구 모음",
      "inLanguage": "ko"
    },
    {
      "@type": "ItemList",
      "name": "무료 사진 편집 도구",
      "description": "프레임, 분할, 변환, EXIF 프레임 디자이너",
      "numberOfItems": 4,
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "EXIF 프레임 디자이너",
          "description": "사진의 촬영 정보를 아름다운 프레임으로. 10가지 스타일 EXIF 오버레이.",
          "url": "https://f.324.ing/newexif/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "프레임 메이커",
          "description": "사진에 여백 프레임을 추가하고 Instagram 피드·프로필 스타일로 저장.",
          "url": "https://f.324.ing/frame.html"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "사진 분할기",
          "description": "한 장의 사진을 여러 칸으로 분할. 인스타그램 멀티 포스팅용.",
          "url": "https://f.324.ing/split.html"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": "이미지 변환기",
          "description": "JPG·PNG·WebP 포맷 간 변환과 리사이즈를 브라우저에서 즉시.",
          "url": "https://f.324.ing/convert.html"
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "홈", "item": "https://f.324.ing/" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "사진이 서버에 업로드되나요?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "아니요. 모든 이미지 처리는 브라우저 내에서 이루어지며, 사진이 서버에 업로드되지 않습니다."
          }
        },
        {
          "@type": "Question",
          "name": "완전 무료인가요?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "네. 모든 도구는 완전 무료이며 회원가입도 필요하지 않습니다."
          }
        },
        {
          "@type": "Question",
          "name": "어떤 이미지 포맷을 지원하나요?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "JPG, PNG, WebP, GIF, BMP, AVIF 포맷을 입력으로 지원합니다. 출력 포맷은 도구에 따라 JPEG, PNG, WebP를 지원합니다."
          }
        }
      ]
    }
  ]
}
</script>
```

---

### 3-2. frame.html

**변경 위치**: `<head>` 내 기존 메타 태그 영역 확장

| 항목 | 값 |
|------|-----|
| title | `사진 프레임 메이커 — 인스타 피드·프로필 프레임 무료 생성 | Photo Frame Maker` |
| description | `사진에 여백 프레임을 추가하고 Instagram 피드·프로필 스타일로 저장하세요. 7가지 캔버스 비율, 프레임 색상·두께 자유 조절, 무손실 PNG 다운로드. 무료, 서버 업로드 없음.` |
| keywords | `사진 프레임, 인스타 프레임, 사진 테두리, 사진 여백, 인스타그램 프레임, photo frame, instagram frame generator` |
| canonical | `https://f.324.ing/frame.html` |

**JSON-LD**:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "name": "프레임 메이커",
      "url": "https://f.324.ing/frame.html",
      "description": "사진에 여백 프레임을 추가하고 Instagram 피드·프로필 스타일로 저장하세요.",
      "applicationCategory": "MultimediaApplication",
      "operatingSystem": "Web Browser",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "KRW" },
      "author": { "@type": "Person", "name": "Noh Daeyoung (DY)" }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "홈", "item": "https://f.324.ing/" },
        { "@type": "ListItem", "position": 2, "name": "프레임 메이커", "item": "https://f.324.ing/frame.html" }
      ]
    }
  ]
}
</script>
```

---

### 3-3. split.html

| 항목 | 값 |
|------|-----|
| title | `사진 분할기 — 인스타그램 멀티 포스팅용 무료 분할 도구 | Photo Frame Maker` |
| description | `한 장의 사진을 2·3·4분할로 나누어 인스타그램 멀티 포스팅용 이미지를 생성하세요. 가로·세로 방향 분할, ZIP 일괄 다운로드. 무료, 서버 업로드 없음.` |
| keywords | `사진 분할, 인스타 분할, 이미지 분할, 인스타그램 그리드, photo split, instagram grid splitter` |
| canonical | `https://f.324.ing/split.html` |

**JSON-LD**: frame.html과 동일 패턴 (WebApplication name="사진 분할기", url=split.html)

---

### 3-4. convert.html

| 항목 | 값 |
|------|-----|
| title | `이미지 변환기 — JPG PNG WebP 무료 변환·리사이즈 | Photo Frame Maker` |
| description | `JPG, PNG, WebP 포맷 간 무료 변환과 이미지 리사이즈. 브라우저에서 즉시 처리, 품질·크기 직접 조절. 서버 업로드 없이 안전하게 변환하세요.` |
| keywords | `이미지 변환, JPG 변환, PNG 변환, WebP 변환, 이미지 리사이즈, image converter, format converter` |
| canonical | `https://f.324.ing/convert.html` |

**JSON-LD**: 동일 패턴 (WebApplication name="이미지 변환기", url=convert.html)

---

### 3-5. exif.html

| 항목 | 값 |
|------|-----|
| title | `EXIF 프레임 — 촬영 정보를 아름다운 프레임으로 | Photo Frame Maker` |
| description | `사진의 EXIF 촬영 정보(카메라, 렌즈, 조리개, ISO)를 아름다운 프레임으로 표현하세요. 다양한 디자인 스타일, 고화질 JPEG 다운로드. 무료, 서버 업로드 없음.` |
| keywords | `EXIF 프레임, 촬영 정보 프레임, 카메라 정보 오버레이, exif frame, camera info overlay, photo metadata` |
| canonical | `https://f.324.ing/exif` |

**JSON-LD**: 동일 패턴 (WebApplication name="EXIF 프레임", url=/exif)

---

### 3-6. newexif/index.html

| 항목 | 값 |
|------|-----|
| title | `EXIF Frame Designer — 차세대 EXIF 프레임 디자이너 | Photo Frame Maker` |
| description | `사진의 EXIF 데이터를 10가지 아름다운 디자인 스타일로 표현하는 차세대 프레임 디자이너. Fujifilm, Leica, Polaroid, Film Strip 등. 3배 고해상도 JPEG 다운로드. 무료.` |
| keywords | `EXIF 프레임 디자이너, EXIF frame designer, Fujifilm 프레임, Leica 프레임, 사진 프레임, camera frame overlay` |
| canonical | `https://f.324.ing/newexif/` |

**JSON-LD**: 동일 패턴 (WebApplication name="EXIF Frame Designer", url=/newexif/)

---

## 4. sitemap.xml 최종 형태

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://f.324.ing/</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://f.324.ing/frame.html</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://f.324.ing/split.html</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://f.324.ing/convert.html</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://f.324.ing/exif</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://f.324.ing/newexif/</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://f.324.ing/about.html</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://f.324.ing/featured-new.html</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://f.324.ing/devnote.html</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://f.324.ing/prompt.html</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
```

---

## 5. 구현 체크리스트

### Phase 1: tools.html
- [ ] GTM 스크립트 삽입 (`<head>` 최상단)
- [ ] GA (gtag) 스크립트 삽입
- [ ] 네이버 사이트 인증 메타 삽입
- [ ] title 최적화
- [ ] keywords 메타 추가
- [ ] author 메타 추가
- [ ] robots 메타 추가
- [ ] canonical → `https://f.324.ing/` 수정
- [ ] hreflang 추가
- [ ] Open Graph 7개 태그 추가
- [ ] Twitter Card 4개 태그 추가
- [ ] JSON-LD (@graph: WebSite + ItemList + BreadcrumbList + FAQPage) 삽입

### Phase 2: frame.html
- [ ] GTM + GA + Naver 인증 삽입
- [ ] title 최적화
- [ ] description 최적화
- [ ] keywords, author, robots 추가
- [ ] canonical 추가
- [ ] hreflang 추가
- [ ] OG + Twitter 태그 추가
- [ ] JSON-LD (WebApplication + BreadcrumbList) 삽입

### Phase 3: split.html
- [ ] (frame.html과 동일 패턴)

### Phase 4: convert.html
- [ ] (frame.html과 동일 패턴)

### Phase 5: exif.html
- [ ] (frame.html과 동일 패턴)

### Phase 6: newexif/index.html
- [ ] (frame.html과 동일 패턴)

### Phase 7: sitemap.xml
- [ ] 전체 10개 URL 등록
- [ ] lastmod 날짜 업데이트

---

## 6. 검증 기준

| 항목 | 기준 |
|------|------|
| 모든 페이지 GTM/GA | 6개 페이지 모두 적용 |
| 모든 페이지 OG 태그 | og:title, og:description, og:url, og:type, og:image, og:locale, og:site_name |
| 모든 페이지 Twitter 태그 | twitter:card, twitter:title, twitter:description, twitter:image |
| 모든 페이지 JSON-LD | tools.html: 4개 스키마 / 나머지: 2개 스키마 |
| sitemap.xml | 10개 URL 등록 |
| canonical 충돌 | tools.html canonical = `https://f.324.ing/` |
| Google Rich Results Test | JSON-LD 유효성 통과 |
