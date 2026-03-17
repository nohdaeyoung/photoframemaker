# SEO 최적화 Plan — tools.html 및 전체 도구 페이지

> Feature: `tools-seo`
> Created: 2026-03-17
> Status: Draft

---

## 1. 현황 분석

### 1-1. 사이트 구조
| 페이지 | URL | 역할 |
|--------|-----|------|
| **tools.html** | `/` (Vercel 루트), `/tools.html` | 도구 허브 (4개 도구 카드) |
| frame.html | `/frame.html` | 사진 프레임 메이커 |
| split.html | `/split.html` | 사진 분할기 |
| convert.html | `/convert.html` | 이미지 변환기 |
| exif.html | `/exif.html`, `/exif` | EXIF 프레임 (v1) |
| newexif/ | `/newexif/` | EXIF 프레임 디자이너 (v2) |
| about.html | `/about.html` | 소개 페이지 |
| featured-new.html | `/featured-new.html` | 피처드 랜딩 |

### 1-2. 발견된 SEO 문제점

#### A. tools.html (허브 페이지 — 가장 심각)
| 항목 | 현재 상태 | 심각도 |
|------|-----------|--------|
| Google Analytics / GTM | **없음** | Critical |
| 네이버 사이트 인증 | **없음** | Critical |
| Open Graph 태그 | **없음** | High |
| Twitter Card 태그 | **없음** | High |
| JSON-LD 구조화 데이터 | **없음** | High |
| keywords 메타 | **없음** | Medium |
| author 메타 | **없음** | Medium |
| robots 메타 | **없음** | Medium |
| hreflang | **없음** | Low |
| title | `Tools — f.324.ing` (비최적화) | High |
| description | 있음 (양호) | OK |
| canonical | 있음 (`/tools.html`) — 루트와 중복 문제 | High |

#### B. 개별 도구 페이지 (frame / split / convert / exif)
| 항목 | 현재 상태 | 심각도 |
|------|-----------|--------|
| Google Analytics / GTM | **없음** | Critical |
| canonical URL | **없음** | High |
| Open Graph 태그 | **없음** | High |
| Twitter Card 태그 | **없음** | High |
| JSON-LD 구조화 데이터 | **없음** | High |
| keywords 메타 | **없음** | Medium |
| robots 메타 | **없음** | Medium |
| description | 지나치게 짧고 키워드 부족 | High |
| title | `Photo Frame Maker — XX 모드` (비최적화) | High |

#### C. newexif/index.html (EXIF 프레임 디자이너 v2)
| 항목 | 현재 상태 | 심각도 |
|------|-----------|--------|
| 모든 SEO 메타 태그 | **최소한만 있음** | Critical |
| canonical / OG / Twitter / JSON-LD | **모두 없음** | Critical |

#### D. sitemap.xml
| 항목 | 현재 상태 | 심각도 |
|------|-----------|--------|
| tools.html | **누락** | Critical |
| frame.html | **누락** | Critical |
| split.html | **누락** | Critical |
| convert.html | **누락** | Critical |
| exif.html | **누락** | Critical |
| newexif/ | **누락** | Critical |
| about.html | **누락** | High |
| featured-new.html | **누락** | High |

#### E. 기타 구조적 문제
- `canonical`이 `/tools.html`인데 Vercel에서 `/`로 라우팅 → 중복 URL 문제
- index.html(원래 홈)과 tools.html(현재 홈) 사이의 canonical 충돌
- 페이지 간 내부 링크 부족 (크롤러 탐색 경로 단절)
- Breadcrumb 내비게이션 없음
- FAQ Schema 없음 (검색 결과 풍부한 스니펫 기회 상실)

---

## 2. 목표

### 핵심 KPI
- 모든 도구 페이지에 완전한 SEO 메타 태그 적용 (OG, Twitter, canonical, robots, keywords, author)
- 모든 페이지에 JSON-LD 구조화 데이터 적용 (WebApplication + SoftwareApplication + BreadcrumbList + FAQ)
- sitemap.xml에 전체 페이지 등록
- Google/Naver 검색 색인 가능 상태 달성

### 비목표
- 블로그 페이지 SEO (Worker에서 관리)
- 페이지 디자인 변경
- 새로운 기능 추가

---

## 3. 구현 계획

### Phase 1: tools.html 완전 SEO 적용

**1-1. 메타 태그 추가**
```
- Google Tag Manager (GTM-5F5CWSJX)
- Google Analytics (G-ZE7EBPTLFG)
- 네이버 사이트 인증
- title 최적화: "무료 사진 편집 도구 — 프레임, 분할, 변환, EXIF 프레임 | Photo Frame Maker"
- description 유지 (이미 양호)
- keywords: "사진 프레임, 사진 분할, 이미지 변환, EXIF 프레임, 무료 사진 편집, 온라인 이미지 도구, photo frame maker, image converter, photo splitter, exif frame"
- author: "Noh Daeyoung (DY)"
- robots: "index, follow"
- canonical: "https://f.324.ing/" (루트로 통일)
- hreflang: ko
```

**1-2. Open Graph 태그**
```
og:title, og:description, og:url, og:type (website)
og:image (og-image.png), og:locale (ko_KR), og:site_name
```

**1-3. Twitter Card 태그**
```
twitter:card (summary_large_image), twitter:title, twitter:description, twitter:image
```

**1-4. JSON-LD 구조화 데이터**
```json
- WebSite schema (검색 결과 사이트 이름 표시)
- ItemList schema (4개 도구를 리스트로)
- BreadcrumbList schema
- FAQPage schema (자주 묻는 질문 — 풍부한 스니펫)
```

### Phase 2: 개별 도구 페이지 SEO 적용 (frame / split / convert / exif)

각 페이지에 동일한 패턴 적용:

**2-1. frame.html**
```
title: "사진 프레임 메이커 — 인스타그램 피드·프로필 프레임 무료 생성 | Photo Frame Maker"
description: "사진에 여백 프레임을 추가하고 Instagram 피드·프로필 스타일로 저장하세요. 7가지 캔버스 비율, 프레임 색상·두께 자유 조절, 무손실 PNG 다운로드. 무료, 서버 업로드 없음."
keywords: "사진 프레임, 인스타 프레임, 사진 테두리, 사진 여백, photo frame, instagram frame"
canonical: "https://f.324.ing/frame.html"
JSON-LD: WebApplication + BreadcrumbList
```

**2-2. split.html**
```
title: "사진 분할기 — 인스타그램 멀티 포스팅용 사진 분할 무료 도구 | Photo Frame Maker"
description: "한 장의 사진을 2·3·4분할로 나누어 인스타그램 멀티 포스팅용 이미지를 생성하세요. 가로·세로 방향 분할, ZIP 일괄 다운로드. 무료, 서버 업로드 없음."
keywords: "사진 분할, 인스타 분할, 이미지 분할, photo split, instagram grid"
canonical: "https://f.324.ing/split.html"
JSON-LD: WebApplication + BreadcrumbList
```

**2-3. convert.html**
```
title: "이미지 변환기 — JPG PNG WebP 무료 변환·리사이즈 | Photo Frame Maker"
description: "JPG, PNG, WebP 포맷 간 무료 변환과 이미지 리사이즈. 브라우저에서 즉시 처리, 품질·크기 직접 조절. 서버 업로드 없이 안전하게 변환하세요."
keywords: "이미지 변환, JPG 변환, PNG 변환, WebP 변환, 이미지 리사이즈, image converter"
canonical: "https://f.324.ing/convert.html"
JSON-LD: WebApplication + BreadcrumbList
```

**2-4. exif.html**
```
title: "EXIF 프레임 — 촬영 정보를 아름다운 프레임으로 | Photo Frame Maker"
description: "사진의 EXIF 촬영 정보(카메라, 렌즈, 조리개, ISO)를 아름다운 프레임으로 표현하세요. 10가지 디자인 스타일, 3배 고해상도 JPEG 다운로드. 무료, 서버 업로드 없음."
keywords: "EXIF 프레임, 촬영 정보 프레임, 카메라 정보 오버레이, exif frame, camera info overlay"
canonical: "https://f.324.ing/exif"
JSON-LD: WebApplication + BreadcrumbList
```

### Phase 3: newexif/index.html SEO 적용

```
title: "EXIF Frame Designer V2 — 차세대 EXIF 프레임 디자이너 | Photo Frame Maker"
description: (Phase 2 exif.html과 차별화된 V2 특화 설명)
전체 메타 태그 + OG + Twitter + JSON-LD
canonical: "https://f.324.ing/newexif/"
```

### Phase 4: sitemap.xml 업데이트

전체 URL 등록:
```xml
https://f.324.ing/              (priority: 1.0)
https://f.324.ing/frame.html    (priority: 0.9)
https://f.324.ing/split.html    (priority: 0.9)
https://f.324.ing/convert.html  (priority: 0.9)
https://f.324.ing/exif           (priority: 0.9)
https://f.324.ing/newexif/       (priority: 0.9)
https://f.324.ing/about.html     (priority: 0.5)
https://f.324.ing/featured-new.html (priority: 0.6)
https://f.324.ing/devnote.html   (priority: 0.5)
https://f.324.ing/prompt.html    (priority: 0.3)
```

### Phase 5: Canonical URL 정리

- tools.html의 canonical을 `https://f.324.ing/`로 변경 (Vercel 라우팅과 일치)
- index.html의 canonical은 `https://f.324.ing/`로 유지
- 검색엔진에게 `/`와 `/tools.html`이 같은 페이지임을 명확히 전달

---

## 4. 파일 변경 목록

| 파일 | 변경 내용 |
|------|-----------|
| `tools.html` | GTM, GA, 네이버 인증, OG, Twitter, JSON-LD, keywords, author, robots, hreflang, title 최적화, canonical 수정 |
| `frame.html` | GTM, GA, canonical, OG, Twitter, JSON-LD, title/description 최적화, keywords, robots |
| `split.html` | 동일 |
| `convert.html` | 동일 |
| `exif.html` | 동일 |
| `newexif/index.html` | 전체 SEO 메타 태그 추가 |
| `sitemap.xml` | 전체 페이지 URL 등록 |

---

## 5. JSON-LD 스키마 전략

### tools.html (허브 페이지)
```
WebSite — 사이트 이름, URL, 검색 액션
ItemList — 4개 도구 리스트 (검색 결과에서 리치 스니펫)
BreadcrumbList — 홈 > 도구
Organization — 제작자 정보
FAQPage — "서버에 업로드되나요?", "무료인가요?", "어떤 포맷을 지원하나요?" 등
```

### 개별 도구 페이지
```
WebApplication — 앱 이름, 설명, 카테고리, OS(브라우저), 가격(Free)
BreadcrumbList — 홈 > 도구 > [도구명]
```

---

## 6. 우선순위

| 순서 | 작업 | 영향도 |
|------|------|--------|
| 1 | tools.html 완전 SEO (Phase 1) | 최고 — 홈페이지 |
| 2 | sitemap.xml 업데이트 (Phase 4) | 최고 — 색인 기반 |
| 3 | canonical 정리 (Phase 5) | 높음 — 중복 해결 |
| 4 | 도구 페이지 SEO (Phase 2) | 높음 — 개별 키워드 |
| 5 | newexif SEO (Phase 3) | 중간 |

---

## 7. 참고: index.html SEO 현황 (비교 기준)

index.html은 이미 다음이 적용되어 있음:
- GTM + GA
- 네이버 사이트 인증
- OG + Twitter Card
- keywords, author, robots, canonical, hreflang
- JSON-LD는 없음

→ 이를 기준 패턴으로 삼아 다른 페이지에 일관되게 적용
