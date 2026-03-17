# Design: refactor-modules
> photoframemaker 소스 모듈화 및 페이지 분리 — 상세 설계

---

## 설계 원칙

1. **빌드 도구 없음** — Cloudflare Workers 정적 사이트, `<script type="module">` ES Modules 사용
2. **페이지별 독립 클래스** — 각 페이지는 `AppBase`를 상속하는 전용 클래스를 가짐
3. **공유 상태는 Base에** — 이미지, 캔버스, 업로드 등 공통 상태/메서드는 `AppBase`
4. **점진적 전환 가능** — Phase 1~3은 기존 `index.html` 동작 유지하면서 진행

---

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────┐
│  페이지별 진입점                                      │
│  frame.html  split.html  convert.html  exif.html     │
│      │           │            │            │          │
│  FrameApp   SplitApp   ConvertApp    ExifApp          │
│      └───────────┴────────────┴────────────┘          │
│                      extends                          │
│                    AppBase                            │
│              (공통 상태 + 공통 메서드)                 │
│                      │                               │
│          ┌───────────┼───────────┐                   │
│    utils/          utils/      utils/                │
│  canvas.js      exif-utils.js  download.js            │
└─────────────────────────────────────────────────────┘
```

---

## 파일 구조 (목표)

```
photoframemaker/
├── index.html              ← 랜딩 (frame.html 리다이렉트 또는 모드 선택)
├── frame.html              ← 프레임 모드 페이지
├── split.html              ← 분할 모드 페이지
├── convert.html            ← 변환 모드 페이지
├── exif.html               ← EXIF 프레임 모드 페이지
├── style.css               ← 전체 스타일 (유지)
│
└── js/
    ├── utils/
    │   ├── canvas.js       ← 캔버스 헬퍼 (_roundRect, 색상 변환)
    │   ├── exif-utils.js   ← EXIF 데이터 유틸
    │   └── download.js     ← 다운로드 함수들
    │
    ├── core/
    │   └── app-base.js     ← 공통 AppBase 클래스
    │
    ├── modes/
    │   ├── frame.js        ← FrameApp (extends AppBase)
    │   ├── split.js        ← SplitApp (extends AppBase)
    │   ├── convert.js      ← ConvertApp (extends AppBase)
    │   └── exif-mode.js    ← ExifApp (extends AppBase)
    │
    └── overlays/
        └── exif-overlays.js ← EXIF 스타일 드로잉 14개
```

---

## 모듈별 상세 설계

---

### 1. `js/utils/canvas.js`

**역할**: 캔버스 관련 순수 유틸 함수

```javascript
// Export 목록
export function roundRect(ctx, x, y, w, h, r) { ... }
export function rgbToHsl(r, g, b) { ... }
export function hslToRgb(h, s, l) { ... }
export function extractDominantColor(img) { ... }
```

**이동할 메서드** (현재 위치):
| 현재 메서드 | 현재 라인 | 비고 |
|------------|----------:|------|
| `_roundRect` (전역함수) | 1 | rename → `roundRect` |
| `extractDominantColor` | 2543 | `this` 없음, 순수 함수화 가능 |
| `rgbToHsl` | 2570 | 순수 함수 |
| `hslToRgb` | 2586 | 순수 함수 |

---

### 2. `js/utils/exif-utils.js`

**역할**: EXIF 데이터 파싱, 브랜드 감지, 폰트 계산

```javascript
// Export 목록
export function readExifFromBuffer(buffer) { ... }
export function parseTiff(view, tiffStart) { ... }
export function readIFD(view, tiffStart, ifdStart, get16, get32, result) { ... }
export function detectBrand(exifData) { ... }
export function getExifFontPx(canvasHeight) { ... }
export function resolveExifTextColor(ctx, canvasW, canvasH) { ... }
export function resolveExifBarColor(textColor) { ... }
```

**이동할 메서드** (현재 위치):
| 현재 메서드 | 현재 라인 |
|------------|----------:|
| `readExifFromBuffer` | 3710 |
| `parseTiff` | 3734 |
| `readIFD` | 3752 |
| `detectBrand` | 3894 |
| `getExifFontPx` | 3903 |
| `resolveExifTextColor` | 3907 |
| `resolveExifBarColor` | 3921 |

> `getActiveExifValues`는 `this.exifFields`, `this.currentImage` 등 인스턴스 상태를
> 참조하므로 AppBase 또는 ExifApp 내에 유지한다.

---

### 3. `js/utils/download.js`

**역할**: 다운로드 로직 (ZIP, 단일, 변환, EXIF)

```javascript
// Export 목록 — 모두 app 인스턴스를 인자로 받음
export async function downloadSingle(app) { ... }
export async function downloadConverted(app) { ... }
export async function downloadSplit(app) { ... }
export async function downloadExifFrame(app) { ... }
export async function downloadMultipleAsImages(app) { ... }
export async function downloadAsZip(app) { ... }
export function blobToBase64(blob) { ... }
```

**이동할 메서드** (현재 위치):
| 현재 메서드 | 현재 라인 |
|------------|----------:|
| `download` (dispatcher) | 4206 |
| `downloadConverted` | 4241 |
| `downloadMultipleAsImages` | 4322 |
| `downloadSplit` | 4365 |
| `downloadSingle` | 4432 |
| `downloadExifFrame` | 4479 |
| `downloadAsZip` | 4530 |
| `blobToBase64` | 4699 |

---

### 4. `js/overlays/exif-overlays.js`

**역할**: EXIF 프레임 스타일별 캔버스 드로잉 함수 14개

```javascript
// Import
import { roundRect } from '../utils/canvas.js';
import { detectBrand, getExifFontPx, resolveExifTextColor, resolveExifBarColor } from '../utils/exif-utils.js';

// Export 목록
export function drawFilmStripOverlay(ctx, overlay, values, app) { ... }
export function drawMinimalOverlay(ctx, overlay, values, app) { ... }
export function drawMagazineOverlay(ctx, overlay, values, app) { ... }
export function drawSignatureOverlay(ctx, overlay, values, app) { ... }
export function drawLetterboxOverlay(ctx, overlay, values, app) { ... }
export function drawPolaroidOverlay(ctx, overlay, values, app) { ... }
export function drawLeicaOverlay(ctx, overlay, values, app) { ... }
export function drawFujistyleOverlay(ctx, overlay, values, app) { ... }
export function drawFujirecipeOverlay(ctx, overlay, values, app) { ... }
export function drawGlassOverlay(ctx, overlay, values, app) { ... }
export function drawLeicaluxOverlay(ctx, overlay, values, app) { ... }
export function drawInstaxOverlay(ctx, overlay, values, app) { ... }
export function drawFilmstockOverlay(ctx, overlay, values, app) { ... }
export function drawShotonOverlay(ctx, overlay, values, app) { ... }
export function drawEditorialOverlay(ctx, overlay, values, app) { ... }
export function drawHudOverlay(ctx, overlay, values, app) { ... }
export function drawMinimalbarOverlay(ctx, overlay, values, app) { ... }
export function drawCardgridOverlay(ctx, overlay, values, app) { ... }
```

> `app` 인자: `this.currentImage?.exifData` 등 인스턴스 데이터 접근에만 사용.
> 이동할 메서드: `drawXxxOverlay` × 14개 (라인 1398~2371)

---

### 5. `js/core/app-base.js`

**역할**: 모든 모드가 공유하는 상태, 이미지 관리, UI 공통 로직

```javascript
export class AppBase {
    constructor() {
        // 공유 상태
        this.images = [];
        this.currentIndex = 0;
        this.canvas = document.getElementById('preview-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.previewContainer = document.getElementById('preview-container');
        this.isDragging = false;
        this.isDownloading = false;
        // ... 공통 상태 변수들
    }

    // 공통 메서드
    bindCommonElements() { ... }      // 공통 DOM 요소 바인딩
    setupCommonEvents() { ... }       // 업로드, 드래그앤드롭, 네비게이션
    loadImages(files) { ... }
    selectImage(index) { ... }
    navigatePrev() { ... }
    navigateNext() { ... }
    removeImage() { ... }
    removeImageAt(index) { ... }
    onImagesChanged() { ... }
    updateNavArrows() { ... }
    updateFeedDots() { ... }
    updateThumbnailStrip() { ... }
    updateThumbnailHighlight() { ... }
    updateUploadUI() { ... }
    updateDownloadButton() { ... }
    updateInfo() { ... }
    displayExif(data) { ... }
    updatePreviewContainerSize() { ... }
    setupBottomSheet() { ... }
    openTabPanel(tab) { ... }
    closeTabPanel() { ... }
    setDownloadLock(locked) { ... }
    showProgress(current, total, text) { ... }
    hideProgress() { ... }
    showToast(message, duration) { ... }
    showSaveOverlay(blob) { ... }
    blobToBase64(blob) { ... }        // 또는 utils/download.js에서 import
    getCanvasCoords(e) { ... }
    isInPhotoArea(coords) { ... }
    onDragStart(e) { ... }
    onDragMove(e) { ... }
    onDragEnd() { ... }
    clampOffset() { ... }
    updatePreviewMode() { ... }
    updateMockupImages() { ... }
    renderItemToDataUrl(item) { ... }
    invalidateProfileCache() { ... }
    updateProfileGrid() { ... }
    saveLastSettings() { ... }
    loadLastSettings() { ... }
    getFavorites() { ... }
    saveFavorite() { ... }
    removeFavorite(index) { ... }
    renderFavoritesUI() { ... }
    resetAllOffsets() { ... }
    checkWebPSupport() { ... }
    getMimeType() { ... }
    getExtension() { ... }
    getBlobArgs() { ... }
    getFrameWidth() { ... }           // 기본 구현 (frame 모드 기준)
    getCanvasDimensions() { ... }
    getPhotoArea() { ... }
    getDrawDimensions(img) { ... }
    syncFramePxInputs() { ... }
    updateCanvasSize() { ... }
    drawFrameBackground(ctx, img, w, h) { ... }
    drawBlurBackground(ctx, img, w, h) { ... }
    drawGradientBackground(ctx, img, w, h) { ... }
    drawPixelateBackground(ctx, img, w, h) { ... }
    drawMirrorBackground(ctx, img, w, h) { ... }
    drawImage() { ... }
    drawPlaceholder() { ... }
    syncAllUI() { ... }
}
```

**AppBase 포함 메서드 기준** (현재 라인):
| 범주 | 메서드들 |
|------|---------|
| 이미지 관리 | loadImages(2773), selectImage(2868), navigatePrev/Next(2895/2910), removeImage/At(2960/2965), onImagesChanged(2986) |
| 드래그/팬 | getCanvasCoords(3567), isInPhotoArea(3577), onDragStart(3583), onDragMove(3596), onDragEnd(3627), clampOffset(3635) |
| 썸네일 | updateThumbnailStrip(3373), updateThumbnailHighlight(3422), returnThumbnailStrip(4186) |
| UI 업데이트 | updateUploadUI(3503), updateDownloadButton(3532), updateInfo(3651), updateNavArrows(2925), updateFeedDots(2947) |
| 설정 | getCurrentPreset(3045), applyPreset(3061), syncAllUI(3086), saveLastSettings(3277), loadLastSettings(3283) |
| 즐겨찾기 | getFavorites(3292), saveFavorite(3298), removeFavorite(3310), renderFavoritesUI(3319) |
| 배경 드로잉 | drawFrameBackground(2447), drawBlurBackground(2474), drawGradientBackground(2508), drawPixelateBackground(2607), drawMirrorBackground(2635) |
| 캔버스 | getCanvasDimensions(717), getFrameWidth(725), getPhotoArea(736), updateCanvasSize(1035), updatePreviewContainerSize(1044) |
| 미리보기 모크업 | updatePreviewMode(2663), updateMockupImages(2672), renderItemToDataUrl(2684), updateProfileGrid(2714) |
| 유틸 | showProgress(4742), hideProgress(4763), showToast(4770), showSaveOverlay(4790), setDownloadLock(4194), blobToBase64(4699) |

---

### 6. `js/modes/frame.js`

**역할**: 프레임 모드 전용 렌더 + 패널 이벤트

```javascript
import { AppBase } from '../core/app-base.js';
import { downloadSingle } from '../utils/download.js';

export class FrameApp extends AppBase {
    constructor() {
        super();
        // 프레임 전용 상태
        this.canvasRatio = [1, 1];
        this.canvasSize = 1000;
        this.frameRatio = 5;
        this.frameColor = '#FFFFFF';
        this.blurIntensity = 50;
        this.pixelateIntensity = 50;
        this.previewMode = 'default';
        this.init();
    }

    init() {
        this.bindFrameElements();
        this.setupFrameEvents();    // 비율, 색상, 블러, 슬라이더 이벤트
        super.bindCommonElements();
        super.setupCommonEvents();
        // ...
        this.render();
    }

    bindFrameElements() { ... }     // 프레임 전용 DOM 요소
    setupFrameEvents() { ... }      // 비율/색상/블러 이벤트 리스너
    render(keepProfileCache) { ... } // 프레임 모드 렌더 (현재 라인 1142)
    updateStyleControlsVisibility() { ... } // (2438)
    syncRatioUI() { ... }
    download() { return downloadSingle(this); }
}
```

**이동할 메서드** (현재 위치):
| 메서드 | 현재 라인 |
|--------|----------:|
| `render` (frame 분기) | 1142 |
| `drawImage` | 2398 |
| `updateStyleControlsVisibility` | 2438 |
| `updateModeSlider` | 772 |
| 프레임 관련 이벤트 핸들러 | ~294–700 중 frame 부분 |

---

### 7. `js/modes/split.js`

**역할**: 분할 모드 전용

```javascript
import { AppBase } from '../core/app-base.js';
import { downloadSplit, downloadAsZip } from '../utils/download.js';

export class SplitApp extends AppBase {
    constructor() {
        super();
        this.splitCount = 2;
        this.splitDirection = 'horizontal';
        this.splitCurrentPanel = 0;
        this.init();
    }

    init() { ... }
    bindSplitElements() { ... }
    setupSplitEvents() { ... }
    setSplitCount(count) { ... }      // (891)
    setSplitDirection(direction) { ... } // (910)
    getSplitStripDimensions(img) { ... } // (937)
    getSplitSourceRect(img, i) { ... }   // (946)
    getSplitDrawDimensions(img) { ... }  // (965)
    drawSplitImage() { ... }             // (984)
    renderSplitPanelToBlob(item, dims, photoArea, i) { ... } // (1010)
    updateSplitThumbnails() { ... }      // (3438)
    updateSplitThumbnailHighlight() { ... } // (3493)
    render() { ... }   // split 분기만
    download() { return downloadSplit(this); }
}
```

**이동할 메서드** (현재 위치):
| 메서드 | 현재 라인 |
|--------|----------:|
| `setSplitCount` | 891 |
| `setSplitDirection` | 910 |
| `getSplitStripDimensions` | 937 |
| `getSplitSourceRect` | 946 |
| `getSplitDrawDimensions` | 965 |
| `drawSplitImage` | 984 |
| `renderSplitPanelToBlob` | 1010 |
| `updateSplitThumbnails` | 3438 |
| `updateSplitThumbnailHighlight` | 3493 |

---

### 8. `js/modes/convert.js`

**역할**: 변환 모드 전용

```javascript
import { AppBase } from '../core/app-base.js';
import { downloadConverted, downloadMultipleAsImages } from '../utils/download.js';

export class ConvertApp extends AppBase {
    constructor() {
        super();
        this.outputFormat = 'jpeg';
        this.outputQuality = 92;
        this.supportsWebP = false;
        this.init();
    }

    init() { ... }
    bindConvertElements() { ... }
    setupConvertEvents() { ... }
    renderConvertPreview() { ... }    // (1202)
    syncFormatUI() { ... }            // (3172)
    updateQualityControlState() { ... } // (3162)
    updateDownloadLabel() { ... }     // (3146)
    download() { return downloadConverted(this); }
}
```

**이동할 메서드** (현재 위치):
| 메서드 | 현재 라인 |
|--------|----------:|
| `renderConvertPreview` | 1202 |
| `syncFormatUI` | 3172 |
| `updateQualityControlState` | 3162 |
| `updateDownloadLabel` | 3146 |

---

### 9. `js/modes/exif-mode.js`

**역할**: EXIF 프레임 모드 전용

```javascript
import { AppBase } from '../core/app-base.js';
import * as overlays from '../overlays/exif-overlays.js';
import { getActiveExifValues, hasExifData, checkExifFieldAvailable } from '../utils/exif-utils.js';
import { downloadExifFrame } from '../utils/download.js';

export class ExifApp extends AppBase {
    constructor() {
        super();
        this.exifStyle = 'filmstrip';
        this.exifFields = { camera:false, lens:false, focalLength:true, aperture:true, shutter:true, iso:true, date:false };
        this.exifFontSize = 'medium';
        this.exifTextColor = 'white';
        this.exifSeparator = '│';
        this.exifBarColor = 'black';
        this.init();
    }

    init() { ... }
    bindExifElements() { ... }
    setupExifEvents() { ... }
    renderExifFrame() { ... }         // (1321)
    getExifOverlayDimensions(dims) { ... } // (1238)
    drawExifOverlay(ctx, w, h, overlay) { ... } // (1373) - dispatches to overlays/*
    drawNoExifMessage(ctx, w, h, overlay) { ... } // (2372)
    getActiveExifValues() { ... }     // (3855) - 인스턴스 상태 필요
    hasExifData() { ... }             // (3927)
    checkExifFieldAvailable(field) { ... } // (3931)
    syncExifUI() { ... }              // (3189)
    setupExifEventListeners() { ... } // (3237)
    updateMobilePhotoTab() { ... }    // (3946)
    download() { return downloadExifFrame(this); }
}
```

---

## HTML 페이지 구조

### 공통 레이아웃 패턴

각 HTML 파일은 동일한 레이아웃 골격을 가지고, 우측 패널(`#sidebar`)의 내용만 다르다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>PhotoFrameMaker — {모드명}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- 공통 헤더 네비게이션 -->
  <header id="app-header">
    <a href="frame.html" class="nav-mode-btn" data-mode="frame">프레임</a>
    <a href="split.html" class="nav-mode-btn" data-mode="split">분할</a>
    <a href="convert.html" class="nav-mode-btn" data-mode="convert">변환</a>
    <a href="exif.html" class="nav-mode-btn" data-mode="exif">EXIF 프레임</a>
  </header>

  <!-- 공통 업로드 + 캔버스 영역 -->
  <main id="app-main">
    <section id="upload-zone"> ... </section>
    <section id="preview-area">
      <canvas id="preview-canvas"></canvas>
    </section>

    <!-- 우측 사이드바 — 모드별로 다름 -->
    <aside id="sidebar">
      {모드별 컨트롤}
    </aside>
  </main>

  <!-- 공통 모바일 탭바 -->
  <nav id="mobile-tab-bar"> ... </nav>

  <script type="module" src="js/pages/{mode}-page.js"></script>
</body>
</html>
```

### 각 페이지 사이드바 구성

#### `frame.html` — 프레임 모드
```html
<aside id="sidebar">
  <section id="ratio-section">   <!-- 비율 선택 버튼 -->
  <section id="canvas-size-section"> <!-- 캔버스 크기 슬라이더 -->
  <section id="frame-ratio-section"> <!-- 테두리 두께 슬라이더 -->
  <section id="frame-color-section"> <!-- 배경 색상 + 블러/픽셀레이트 -->
  <section id="favorites-section">   <!-- 즐겨찾기 -->
  <section id="info-section">        <!-- 이미지 정보 -->
  <button id="download-btn">다운로드</button>
</aside>
```

#### `split.html` — 분할 모드
```html
<aside id="sidebar">
  <section id="split-section">        <!-- 분할 수 버튼 -->
  <section id="split-direction-section"> <!-- 방향 선택 -->
  <section id="frame-ratio-section">  <!-- 간격 두께 -->
  <section id="frame-color-section">  <!-- 배경색 -->
  <section id="info-section">
  <button id="download-btn">분할 다운로드</button>
</aside>
```

#### `convert.html` — 변환 모드
```html
<aside id="sidebar">
  <section id="format-section">       <!-- JPEG / WebP / PNG 선택 -->
  <section id="quality-section">      <!-- 품질 슬라이더 -->
  <section id="info-section">
  <button id="download-btn">변환 다운로드</button>
</aside>
```

#### `exif.html` — EXIF 프레임 모드
```html
<aside id="sidebar">
  <section id="exif-style-section">   <!-- 스타일 14종 버튼 그리드 -->
  <section id="exif-fields-section">  <!-- 표시 항목 토글 -->
  <section id="frame-ratio-section">  <!-- 테두리 두께 -->
  <section id="exif-color-section">   <!-- 텍스트/바 색상 -->
  <section id="info-section">
  <section id="exif-section">         <!-- 원본 EXIF 표시 -->
  <button id="download-btn">EXIF 프레임 다운로드</button>
</aside>
```

---

## 모듈 의존 관계 (Import Graph)

```
frame.html
  └─ js/pages/frame-page.js
       └─ js/modes/frame.js (FrameApp)
            ├─ js/core/app-base.js (AppBase)
            │    ├─ js/utils/canvas.js
            │    └─ js/utils/exif-utils.js (EXIF 파싱)
            └─ js/utils/download.js (downloadSingle)

split.html
  └─ js/pages/split-page.js
       └─ js/modes/split.js (SplitApp)
            ├─ js/core/app-base.js
            └─ js/utils/download.js (downloadSplit, downloadAsZip)

convert.html
  └─ js/pages/convert-page.js
       └─ js/modes/convert.js (ConvertApp)
            ├─ js/core/app-base.js
            └─ js/utils/download.js (downloadConverted)

exif.html
  └─ js/pages/exif-page.js
       └─ js/modes/exif-mode.js (ExifApp)
            ├─ js/core/app-base.js
            ├─ js/overlays/exif-overlays.js (draw × 14)
            │    ├─ js/utils/canvas.js
            │    └─ js/utils/exif-utils.js
            └─ js/utils/download.js (downloadExifFrame)
```

---

## 상태 분리 전략

### AppBase 공유 상태 (모든 모드 공통)
```javascript
this.images = []
this.currentIndex = 0
this._modeState = {}          // 삭제 — 각 페이지가 독립 인스턴스
this.isDragging = false
this.isDownloading = false
this.touchStartX/Y = 0
this.previewMode = 'default'
this.canvas, this.ctx, this.previewContainer
```

### FrameApp 전용 상태
```javascript
this.canvasRatio = [1, 1]
this.canvasSize = 1000
this.frameRatio = 5
this.frameColor = '#FFFFFF'
this.blurIntensity = 50
this.pixelateIntensity = 50
```

### SplitApp 전용 상태
```javascript
this.splitCount = 2
this.splitDirection = 'horizontal'
this.splitCurrentPanel = 0
this.savedRatioBeforeSplit = null
```

### ConvertApp 전용 상태
```javascript
this.outputFormat = 'jpeg'
this.outputQuality = 92
this.supportsWebP = false
```

### ExifApp 전용 상태
```javascript
this.exifStyle = 'filmstrip'
this.exifFields = { ... }
this.exifFontSize = 'medium'
this.exifTextColor = 'white'
this.exifSeparator = '│'
this.exifBarColor = 'black'
```

---

## 페이지 간 이미지 전달 (이슈 해결)

현재: 한 탭에서 다른 탭 전환 시 `_modeState`로 이미지 유지.
변경 후: 별개의 HTML 페이지이므로 이미지 상태가 유실됨.

**해결책: sessionStorage 직렬화**

```javascript
// 페이지 이탈 시 (beforeunload 또는 nav 클릭)
sessionStorage.setItem('pfm_images', JSON.stringify(
    app.images.map(item => ({ name: item.name, dataUrl: item.dataUrl }))
));

// 새 페이지 로드 시 (AppBase.init)
const saved = sessionStorage.getItem('pfm_images');
if (saved) this.restoreImages(JSON.parse(saved));
```

> 이미지가 클 경우 sessionStorage 5MB 제한 주의.
> 대안: `IndexedDB` 또는 `File` 객체 드롭 재요청.

---

## 구현 순서 (Do Phase 체크리스트)

### Step 1 — utils 분리 (리스크 ★☆☆)
- [ ] `js/utils/canvas.js` 생성, `_roundRect` + 색상 유틸 이동
- [ ] `js/utils/exif-utils.js` 생성, EXIF 파싱 + 브랜드 감지 이동
- [ ] `index.html` → `<script type="module">` 전환, import 확인
- [ ] `wrangler dev` 실행하여 동작 검증

### Step 2 — EXIF 오버레이 분리 (리스크 ★☆☆)
- [ ] `js/overlays/exif-overlays.js` 생성
- [ ] `drawXxxOverlay` 14개 함수화(클래스 메서드 → 순수 함수) 및 이동
- [ ] `app.js`에서 import 후 `this.drawXxxOverlay` → `drawXxxOverlay(ctx, overlay, values, this)` 호환 래퍼

### Step 3 — download 분리 (리스크 ★★☆)
- [ ] `js/utils/download.js` 생성
- [ ] download 메서드들 이동, `app` 인자 패턴 적용
- [ ] `app.js`에서 import + delegation

### Step 4 — AppBase 추출 (리스크 ★★★)
- [ ] `js/core/app-base.js` 생성
- [ ] 공통 상태 + 공통 메서드 이동
- [ ] `app.js` → `class PhotoFrameMaker extends AppBase` 로 전환하여 검증

### Step 5 — 모드 클래스 분리 (리스크 ★★☆)
- [ ] `js/modes/frame.js` (FrameApp) 생성
- [ ] `js/modes/split.js` (SplitApp) 생성
- [ ] `js/modes/convert.js` (ConvertApp) 생성
- [ ] `js/modes/exif-mode.js` (ExifApp) 생성

### Step 6 — HTML 페이지 분리 (리스크 ★★☆)
- [ ] `frame.html` 생성 (index.html에서 frame 패널만 추출)
- [ ] `split.html` 생성
- [ ] `convert.html` 생성
- [ ] `exif.html` 생성
- [ ] 공통 헤더 네비게이션 삽입 (JS 동적 생성)
- [ ] `index.html` → `frame.html` 리다이렉트
- [ ] sessionStorage 이미지 전달 구현
- [ ] `www/` 배포 폴더 동기화 확인

---

## 예상 파일별 라인 수 (모듈화 후)

| 파일 | 예상 라인 | 담당 |
|------|----------:|------|
| `js/utils/canvas.js` | ~40 | 캔버스 헬퍼 |
| `js/utils/exif-utils.js` | ~180 | EXIF 파싱 + 유틸 |
| `js/utils/download.js` | ~320 | 다운로드 함수 |
| `js/core/app-base.js` | ~900 | 공통 기반 |
| `js/modes/frame.js` | ~350 | 프레임 모드 |
| `js/modes/split.js` | ~300 | 분할 모드 |
| `js/modes/convert.js` | ~120 | 변환 모드 |
| `js/modes/exif-mode.js` | ~280 | EXIF 모드 |
| `js/overlays/exif-overlays.js` | ~1,050 | EXIF 드로잉 14종 |
| `js/pages/` × 4 | ~40 × 4 | 진입점 |
| `frame.html` | ~350 | 프레임 HTML |
| `split.html` | ~280 | 분할 HTML |
| `convert.html` | ~200 | 변환 HTML |
| `exif.html` | ~380 | EXIF HTML |
| **합계** | **~4,710** | (분산 후 최대 1,050줄) |

---

## 메타

- **Feature**: refactor-modules
- **Phase**: Design
- **작성일**: 2026-03-16
- **참조**: `docs/01-plan/features/refactor-modules.plan.md`
- **관련 파일**: `app.js`(4,836줄), `index.html`(1,025줄), `style.css`(2,370줄)
