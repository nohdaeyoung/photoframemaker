# Plan: refactor-modules
> photoframemaker 소스 모듈화 및 페이지 분리

---

## 배경 및 목표

### 핵심 목표 2가지
1. **소스 관리 용이성** — 단일 파일 `app.js`(4,836줄)가 너무 커서 원하는 코드를 찾고 수정하기 어렵다. 모듈 단위로 쪼개면 각 파일이 하나의 역할만 담당하여 수정·디버깅이 쉬워진다.
2. **속도 개선** — 현재는 어떤 모드를 쓰든 4,836줄 전체를 로드한다. 페이지를 분리하면 해당 모드에 필요한 코드만 로드해 **초기 파싱 시간과 실행 비용이 줄어든다**.

기능 모드 4개(프레임 / 분할 / 변환 / EXIF 프레임)를 **개별 페이지**로 분리하고,
`app.js`를 **ES 모듈** 단위로 쪼개 각 담당 영역이 명확한 구조로 만든다.

### 속도 개선 근거
| 현재 | 모듈화 후 |
|------|-----------|
| 모든 모드에서 `app.js` 4,836줄 파싱 | 각 페이지에서 필요한 모듈만 로드 |
| EXIF 오버레이 14개 드로잉 코드(~1,000줄)를 프레임 모드에서도 로드 | `exif-overlays.js`는 EXIF 페이지에서만 로드 |
| `style.css` 2,370줄 전체 로드 (선택적으로 CSS 분리 가능) | 모드별 CSS 분리 시 추가 절감 |

---

## 현재 상태 분석

### 파일별 규모
| 파일 | 라인 수 | 역할 |
|------|--------:|------|
| `app.js` | 4,836 | 앱 전체 (4개 모드 + 유틸리티 혼재) |
| `style.css` | 2,370 | 전체 스타일 |
| `index.html` | 1,025 | HTML 구조 + 모든 패널 마크업 |

### app.js 내부 구조 (추정 영역)
| 영역 | 대략 라인 | 내용 |
|------|----------:|------|
| 헬퍼 함수 | ~1–32 | `_roundRect` 등 전역 유틸 |
| 초기화 / 상태 | ~33–250 | 생성자, 상태 변수 |
| UI / 이벤트 바인딩 | ~250–700 | DOM 참조, 이벤트 리스너 |
| 캔버스 코어 | ~700–1,200 | 렌더 루프, 미리보기 컨테이너 |
| 프레임 모드 렌더 | ~1,200–1,240 | 테두리/배경 드로잉 |
| EXIF 오버레이 계산 | ~1,238–1,320 | `getExifOverlayDimensions()` |
| EXIF 프레임 렌더 | ~1,321–1,462 | `renderExifFrame()` |
| EXIF 개별 스타일 드로잉 | ~1,463–2,450 | `drawXxxOverlay()` × 14개 (~1,000줄) |
| 프레임 배경 유틸 | ~2,447–2,700 | 배경색, blur 등 |
| 분할 모드 로직 | ~2,700–3,100 | Split 패널 렌더링 |
| 다운로드 로직 | ~3,100–3,600 | download/zip/convert |
| EXIF 데이터 유틸 | ~3,855–3,980 | `getActiveExifValues`, `detectBrand` 등 |
| UI 이벤트 핸들러 | ~3,980–4,836 | 탭, 슬라이더, 토글 등 |

---

## 목표 구조

### 페이지 분리 (HTML)

```
/                 ← 랜딩 / 모드 선택 (기존 index.html 재활용 가능)
/frame.html       ← 프레임 모드 (테두리 스타일, 색상, 비율)
/split.html       ← 분할 모드
/convert.html     ← 변환 모드 (포맷, 품질)
/exif.html        ← EXIF 프레임 모드 (스타일 14종, EXIF 필드 선택)
```

각 페이지는 **공통 레이아웃**(헤더 + 업로드존 + 캔버스 미리보기 + 우측 패널)을 공유하고,
우측 패널에는 해당 모드에 필요한 컨트롤만 표시한다.

### JS 모듈 분리 (ES Modules)

```
js/
  utils/
    canvas.js          # _roundRect 등 캔버스 헬퍼
    exif-utils.js      # getActiveExifValues, detectBrand, getExifFontPx, resolveExifTextColor
    download.js        # download(), downloadSingle(), downloadSplit(), downloadConverted(), downloadExifFrame()

  core/
    app-base.js        # 공유 상태, 이미지 로드, 드래그&드롭, 미리보기 컨테이너 리사이즈

  modes/
    frame.js           # 프레임 모드 렌더 + 패널 이벤트
    split.js           # 분할 모드 렌더 + 패널 이벤트
    convert.js         # 변환 모드 렌더 + 패널 이벤트
    exif-mode.js       # EXIF 모드 렌더 + getExifOverlayDimensions + 패널 이벤트

  overlays/
    exif-overlays.js   # drawXxxOverlay() 14개 전체 (현재 ~1,000줄)

  pages/
    frame-page.js      # frame.html 진입점
    split-page.js      # split.html 진입점
    convert-page.js    # convert.html 진입점
    exif-page.js       # exif.html 진입점
```

### CSS 분리 (선택적)

```
css/
  base.css             # 리셋, 변수, 레이아웃
  components.css       # 공통 컴포넌트 (.card, .btn-primary, .input 등)
  panel.css            # 사이드 패널 공통
  modes/
    frame.css          # 프레임 모드 전용
    split.css          # 분할 모드 전용
    convert.css        # 변환 모드 전용
    exif.css           # EXIF 모드 전용
```
> CSS 분리는 우선순위 낮음. `style.css` 유지하며 JS 모듈화 먼저 진행 가능.

---

## 모드별 패널 구성 (우측 사이드바)

### 프레임 모드 (`frame.html`)
- 캔버스 비율 선택
- 캔버스 크기 슬라이더
- 테두리 두께 슬라이더
- 배경 색상 / 블러 스타일 선택
- 다운로드 버튼

### 분할 모드 (`split.html`)
- 분할 방향 (가로/세로)
- 분할 수 슬라이더
- 간격 두께
- 배경색
- 다운로드 버튼 (ZIP)

### 변환 모드 (`convert.html`)
- 출력 포맷 (JPEG / WebP / PNG)
- 품질 슬라이더
- 다운로드 버튼

### EXIF 프레임 모드 (`exif.html`)
- 스타일 선택 (14종 버튼 그리드)
- EXIF 표시 항목 토글 (카메라, 렌즈, 조리개, 셔터, ISO, 날짜)
- 테두리 두께 슬라이더
- 다운로드 버튼

---

## 공통 레이아웃 (각 HTML에서 공유)

```html
<!-- shared-layout.html 또는 각 페이지에 인라인 -->
<header>
  <nav> <!-- 모드 간 이동 링크 --> </nav>
</header>
<main>
  <section id="upload-zone"> ... </section>
  <section id="preview-area">
    <canvas id="canvas"></canvas>
  </section>
  <aside id="side-panel">
    <!-- 각 모드별 컨트롤 -->
  </aside>
</main>
```

> Cloudflare Workers 정적 사이트이므로 서버사이드 템플릿 없음.
> 공통 헤더/네비게이션은 JS로 동적 삽입하거나 각 HTML에 복사.

---

## 구현 단계 (Phase)

### Phase 1 — 유틸리티 모듈 분리 (리스크 낮음)
**목표**: 순수 함수 분리. 앱 동작 변경 없음.
1. `js/utils/canvas.js` → `_roundRect` 이동
2. `js/utils/exif-utils.js` → `getActiveExifValues`, `detectBrand`, `getExifFontPx`, `resolveExifTextColor` 이동
3. `js/utils/download.js` → download 관련 메서드 이동
4. `index.html`에서 `<script type="module">` 로 로드

### Phase 2 — EXIF 오버레이 분리
**목표**: 가장 큰 덩어리(~1,000줄) 분리.
1. `js/overlays/exif-overlays.js` → `drawXxxOverlay` 14개 이동
2. `exif-mode.js`에서 import

### Phase 3 — 모드별 렌더 로직 분리
**목표**: `renderFrame`, `renderSplit`, `renderConvertPreview`, `renderExifFrame` 각 모듈로 이동.
1. `js/modes/frame.js`
2. `js/modes/split.js`
3. `js/modes/convert.js`
4. `js/modes/exif-mode.js`

### Phase 4 — 페이지 분리
**목표**: 4개 HTML 파일로 분리, 공통 레이아웃 구성.
1. `frame.html` 생성 → `js/pages/frame-page.js` 연결
2. `split.html` 생성 → `js/pages/split-page.js` 연결
3. `convert.html` 생성 → `js/pages/convert-page.js` 연결
4. `exif.html` 생성 → `js/pages/exif-page.js` 연결
5. `index.html` → 랜딩/모드선택 페이지로 전환 또는 `frame.html` 리다이렉트

### Phase 5 — CSS 정리 (선택적)
모드별 CSS 분리, 미사용 스타일 제거.

---

## 리스크 및 고려사항

| 리스크 | 대응 |
|--------|------|
| ES Modules는 `file://` 프로토콜에서 CORS 차단 | 개발 시 항상 로컬 서버 사용 (`wrangler dev`) |
| 4개 페이지 각각에 공통 HTML 중복 | JS로 공통 헤더 삽입 또는 빌드 스텝 고려 (html-include) |
| `www/` 빌드 복사 절차 변경 필요 | 배포 스크립트 업데이트 |
| 모드 전환 시 이미지 상태 유실 | sessionStorage 또는 URL param으로 이미지 전달 방안 검토 |
| 기존 `index.html` 북마크/공유 링크 깨짐 | `index.html` → `frame.html` redirect 유지 |

---

## 우선순위 및 추천 순서

```
Phase 1 (유틸 분리)  →  Phase 2 (EXIF 오버레이 분리)  →  Phase 3 (모드 렌더 분리)
     ↓
Phase 4 (페이지 분리)  →  Phase 5 (CSS 정리, 선택)
```

Phase 1~3은 **동작 변경 없는 리팩토링**이므로 안전하게 진행 가능.
Phase 4는 UX 변경이 수반되므로 별도 확인 필요.

---

## 예상 결과물 (모듈화 후 파일별 규모 추정)

| 파일 | 예상 라인 |
|------|----------:|
| `js/utils/canvas.js` | ~30 |
| `js/utils/exif-utils.js` | ~80 |
| `js/utils/download.js` | ~250 |
| `js/core/app-base.js` | ~400 |
| `js/modes/frame.js` | ~350 |
| `js/modes/split.js` | ~300 |
| `js/modes/convert.js` | ~150 |
| `js/modes/exif-mode.js` | ~250 |
| `js/overlays/exif-overlays.js` | ~1,050 |
| 각 page.js × 4 | ~100 × 4 |
| **합계** | **~2,900** |

> 현재 4,836줄 → 분산 후 **최대 파일 1,050줄** 수준으로 축소.

---

## 메타

- **Feature**: refactor-modules
- **Phase**: Plan
- **작성일**: 2026-03-16
- **관련 파일**: `app.js`, `index.html`, `style.css`, `src/worker.js`
