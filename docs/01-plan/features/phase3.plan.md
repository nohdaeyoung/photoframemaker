# Phase 3 Plan: EXIF 프레임 (EXIF 기반 자동 스타일링)

## 개요

Photo Frame Maker에 네 번째 앱 모드 "EXIF 프레임"을 추가한다. 사진의 EXIF 메타데이터(카메라, 렌즈, 조리개, 셔터속도, ISO 등)를 자동으로 읽어 캔버스 위에 촬영 정보를 시각적으로 배치하는 기능이다. 기존 `app-mode-btn` 토글에 "EXIF 프레임" 버튼을 추가하여 프레임/분할/변환과 동일한 레벨로 진입한다.

## 목표

| 목표 | 측정 지표 | 기대 효과 |
|------|----------|----------|
| 사진가 워크플로우 통합 | EXIF 프레임 사용률 | 촬영 정보 공유 시 별도 앱 불필요 |
| 카메라 브랜드 차별화 | 자동 테마 적용률 | 브랜드별 아이덴티티 반영, SNS 공유 최적화 |
| 커스터마이징 자유도 | 필드/스타일 커스텀 비율 | 표시 정보, 폰트, 색상, 배치를 사용자가 제어 |

---

## 기능 1: 앱 모드 추가 — "EXIF 프레임"

### 배경

현재 `appMode`는 `'frame' | 'split' | 'convert'` 3가지. EXIF 프레임은 기존 frame 모드와 유사하되, 프레임 영역에 EXIF 정보를 텍스트/아이콘으로 오버레이한다. 기존 EXIF 파싱 코드(`readExifFromBuffer()`, `parseTiff()`, `readIFD()`, `displayExif()`)를 재활용한다.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| EF-1 | `app-mode-btn`에 "EXIF 프레임" 버튼 추가 (4번째) | P1 |
| EF-2 | `appMode = 'exif'` 상태 추가 | P1 |
| EF-3 | EXIF 모드 진입 시 전용 사이드바/모바일 패널 표시 | P1 |
| EF-4 | EXIF 데이터 없는 이미지 시 안내 메시지 표시 | P1 |
| EF-5 | 기존 frame 모드의 캔버스 비율/크기 설정 공유 | P2 |

### 기술 설계

```
앱 모드 확장:
  this.appMode = 'frame' | 'split' | 'convert' | 'exif'

HTML:
  <button class="app-mode-btn" data-mode="exif">EXIF 프레임</button>

switchAppMode() 확장:
  case 'exif':
    - 프레임 관련 UI 숨김 (프레임 색상, 프레임 비율)
    - EXIF 전용 패널 표시 (스타일 선택, 필드 토글, 텍스트 설정)
    - render() 호출 → drawExifFrame() 분기

render() 분기:
  if (this.appMode === 'exif') {
    this.renderExifFrame();
    return;
  }
```

---

## 기능 2: EXIF 프레임 스타일 (4종)

### 배경

EXIF 정보를 다양한 레이아웃으로 표현하여 사진가의 취향과 SNS 용도에 맞춘다.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| ES-1 | Film Strip 스타일: 하단 바에 카메라 + 세팅 한 줄 | P1 |
| ES-2 | Minimal 스타일: 우하단 코너에 작은 텍스트 | P1 |
| ES-3 | Magazine 스타일: 좌측 세로 바에 촬영 정보 나열 | P2 |
| ES-4 | Signature 스타일: 하단에 카메라 로고 + 세팅 | P2 |
| ES-5 | 스타일 실시간 프리뷰 | P1 |

### 기술 설계

```
상태:
  this.exifStyle = 'filmstrip'   // 'filmstrip' | 'minimal' | 'magazine' | 'signature'

스타일별 레이아웃:

1. Film Strip (기본)
   ┌─────────────────────────┐
   │                         │
   │         사진             │
   │                         │
   ├─────────────────────────┤
   │ Canon EOS R5 │ 50mm │ f/1.8 │ 1/250s │ ISO 400 │
   └─────────────────────────┘
   - 하단 바 높이: 캔버스 높이의 6~8%
   - 배경: 검정 또는 화이트
   - 텍스트: 가운데 정렬, 구분자로 연결

2. Minimal
   ┌─────────────────────────┐
   │                         │
   │         사진             │
   │                         │
   │              50mm f/1.8 │
   │              ISO 400    │
   └─────────────────────────┘
   - 사진 위에 반투명 오버레이 텍스트
   - 우하단 정렬, 작은 폰트
   - 텍스트 그림자로 가독성 확보

3. Magazine
   ┌───┬─────────────────────┐
   │ C │                     │
   │ a │                     │
   │ n │       사진            │
   │ o │                     │
   │ n │                     │
   │   │                     │
   │50 │                     │
   │mm │                     │
   ├───┴─────────────────────┘
   - 좌측 세로 바 (캔버스 너비의 8~10%)
   - 카메라명 세로 쓰기, 세팅 값 아래로 나열

4. Signature
   ┌─────────────────────────┐
   │                         │
   │         사진             │
   │                         │
   ├─────────────────────────┤
   │ [카메라 로고]            │
   │ 50mm  f/1.8  1/250s  400│
   └─────────────────────────┘
   - 하단 바에 카메라 브랜드 로고 (텍스트 대체) + 세팅
   - 로고는 Canvas 텍스트로 브랜드명 렌더링 (이미지 불필요)

렌더링:
  renderExifFrame() {
    // 1. 캔버스 크기 설정 (스타일에 따라 여백 계산)
    // 2. 이미지 그리기 (frame 모드의 drawImage() 재활용)
    // 3. drawExifOverlay(style) 호출
  }

  drawExifOverlay(style) {
    switch(style) {
      case 'filmstrip': this.drawFilmStripOverlay(); break;
      case 'minimal':   this.drawMinimalOverlay(); break;
      case 'magazine':  this.drawMagazineOverlay(); break;
      case 'signature': this.drawSignatureOverlay(); break;
    }
  }
```

---

## 기능 3: EXIF 필드 선택

### 배경

모든 EXIF 정보를 항상 표시하면 복잡해진다. 사용자가 표시할 필드를 토글할 수 있어야 한다.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| EX-1 | 토글 가능 필드: 카메라, 렌즈, 초점거리, 조리개, 셔터속도, ISO, 촬영일 | P1 |
| EX-2 | 기본 ON: 초점거리, 조리개, 셔터속도, ISO | P1 |
| EX-3 | 기본 OFF: 카메라, 렌즈, 촬영일 | P1 |
| EX-4 | EXIF에 해당 값이 없는 필드는 자동 비활성화 | P1 |
| EX-5 | 데스크톱 + 모바일 UI 동기화 | P1 |

### 기술 설계

```
상태:
  this.exifFields = {
    camera: false,      // 카메라 (기본 OFF)
    lens: false,        // 렌즈 (기본 OFF)
    focalLength: true,  // 초점거리 (기본 ON)
    aperture: true,     // 조리개 (기본 ON)
    shutter: true,      // 셔터속도 (기본 ON)
    iso: true,          // ISO (기본 ON)
    date: false         // 촬영일 (기본 OFF)
  }

EXIF 태그 매핑 (기존 코드 재활용):
  camera     → 0x010F (Make) + 0x0110 (Model)
  lens       → 0xA434 (LensModel)
  focalLength → 0x920A (FocalLength)
  aperture   → 0x829D (FNumber)
  shutter    → 0x829A (ExposureTime)
  iso        → 0x8827 (ISOSpeedRatings)
  date       → 0x9003 (DateTimeOriginal)

getActiveExifValues() {
  // exifFields에서 true인 필드만 추출
  // 현재 이미지의 EXIF 데이터에서 해당 값 포맷팅
  // 값이 없는 필드는 건너뜀
  return [{ key, label, value }]
}
```

---

## 기능 4: 텍스트 스타일링

### 배경

EXIF 텍스트의 시각적 표현을 사용자가 제어할 수 있어야 한다.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| TS-1 | 폰트 크기 조절 (Small / Medium / Large) | P1 |
| TS-2 | 텍스트 색상 선택 (화이트/블랙/자동) | P1 |
| TS-3 | 구분자 선택 (│, ·, -, 공백) | P2 |
| TS-4 | 배경 바 색상 (검정/화이트/자동/투명) | P1 |

### 기술 설계

```
상태:
  this.exifFontSize = 'medium'       // 'small' | 'medium' | 'large'
  this.exifTextColor = 'white'       // 'white' | 'black' | 'auto'
  this.exifSeparator = '│'           // '│' | '·' | '-' | ' '
  this.exifBarColor = 'black'        // 'black' | 'white' | 'auto' | 'transparent'

폰트 크기 매핑 (캔버스 높이 기준):
  small:  캔버스 높이의 1.5%
  medium: 캔버스 높이의 2.0%
  large:  캔버스 높이의 2.8%

텍스트 색상 'auto':
  이미지 하단 영역의 평균 밝기 분석 → 밝으면 검정, 어두우면 흰색

배경 바 색상 'auto':
  텍스트 색상의 반대 (텍스트 흰색 → 바 검정)
```

---

## 기능 5: 카메라 브랜드 자동 테마

### 배경

카메라 브랜드별 고유 색상/스타일을 자동 적용하여 브랜드 아이덴티티를 살린다.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| BT-1 | EXIF Make 태그로 브랜드 자동 감지 | P2 |
| BT-2 | 브랜드별 테마 색상 자동 적용 (수동 오버라이드 가능) | P2 |
| BT-3 | 지원 브랜드: Sony, Fujifilm, Canon, Nikon, Apple, Leica, Ricoh | P2 |

### 기술 설계

```
브랜드 테마 매핑:
  BRAND_THEMES = {
    'sony':     { primary: '#000000', accent: '#F58220', name: 'SONY' },
    'fujifilm': { primary: '#1A1A1A', accent: '#86B817', name: 'FUJIFILM' },
    'canon':    { primary: '#FFFFFF', accent: '#CC0000', name: 'Canon' },
    'nikon':    { primary: '#000000', accent: '#FFD700', name: 'Nikon' },
    'apple':    { primary: '#1D1D1F', accent: '#FFFFFF', name: 'Apple' },
    'leica':    { primary: '#FFFFFF', accent: '#E2001A', name: 'Leica' },
    'ricoh':    { primary: '#1A1A1A', accent: '#DA291C', name: 'RICOH' },
  }

감지 로직:
  detectBrand(exifData) {
    const make = (exifData[0x010F] || '').toLowerCase();
    for (const [key, theme] of Object.entries(BRAND_THEMES)) {
      if (make.includes(key)) return { key, ...theme };
    }
    return null; // 미감지 시 기본 테마
  }

적용:
  - Signature 스타일에서 브랜드 로고 텍스트에 accent 색상 적용
  - Film Strip 스타일 바 배경에 primary 색상 적용
  - 사용자가 수동 색상 지정 시 자동 테마 무시
```

---

## 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `app.js` | `appMode = 'exif'` 추가, EXIF 프레임 상태 변수(`exifStyle`, `exifFields`, `exifFontSize`, `exifTextColor`, `exifSeparator`, `exifBarColor`), `renderExifFrame()`, `drawExifOverlay()` + 4개 스타일 렌더러, `getActiveExifValues()`, `detectBrand()`, `switchAppMode()` 확장, `getCurrentPreset()` / `applyPreset()` 확장, EXIF 패널 이벤트 바인딩 |
| `index.html` | "EXIF 프레임" `app-mode-btn` 추가, EXIF 전용 사이드바 패널 (스타일 선택 + 필드 토글 + 텍스트 설정), 모바일 EXIF 탭 패널 |
| `style.css` | `.exif-panel`, `.exif-style-selector`, `.exif-field-toggles`, `.exif-text-controls` 스타일 |

## 구현 순서

```
Step 1: 상태 변수 + 헬퍼 메서드
  ├── exifStyle, exifFields, exifFontSize, exifTextColor, exifSeparator, exifBarColor
  ├── getActiveExifValues() — EXIF 데이터에서 활성 필드 추출/포맷팅
  ├── detectBrand() — Make 태그 기반 브랜드 감지
  └── BRAND_THEMES 상수

Step 2: switchAppMode() 확장
  ├── appMode = 'exif' 분기 추가
  ├── EXIF 전용 패널 표시/숨김 로직
  └── render() 내 exif 모드 분기

Step 3: renderExifFrame() + drawExifOverlay()
  ├── 캔버스 크기 계산 (스타일별 여백)
  ├── 이미지 그리기 (drawImage() 재활용)
  ├── drawFilmStripOverlay()
  ├── drawMinimalOverlay()
  ├── drawMagazineOverlay()
  └── drawSignatureOverlay()

Step 4: HTML UI 추가
  ├── app-mode-btn "EXIF 프레임" 버튼
  ├── 데스크톱: EXIF 사이드바 패널 (스타일 선택, 필드 토글, 텍스트 설정)
  └── 모바일: EXIF 탭 패널

Step 5: CSS 스타일
  ├── EXIF 패널 레이아웃
  ├── 스타일 선택 버튼 (미니 프리뷰)
  └── 필드 토글 체크박스, 텍스트 컨트롤

Step 6: JS 이벤트 바인딩
  ├── 스타일 버튼 클릭 → exifStyle 변경
  ├── 필드 토글 → exifFields 변경
  ├── 텍스트 설정 변경 → 실시간 프리뷰
  └── 데스크톱 ↔ 모바일 동기화

Step 7: getCurrentPreset() / applyPreset() 확장
  └── exifStyle, exifFields, exifFontSize, exifTextColor, exifSeparator, exifBarColor를 preset에 포함

Step 8: 다운로드 지원
  ├── downloadSingle() — EXIF 모드 분기 (renderExifFrame → toBlob)
  └── 파일명에 EXIF 스타일 반영 (선택사항)

Step 9: 통합 테스트 + 빌드
```

## 리스크 & 대응

| 리스크 | 가능성 | 대응 |
|--------|--------|------|
| EXIF 데이터 없는 이미지 (스크린샷, SNS 저장 등) | 높 | "EXIF 정보가 없습니다" 안내 + 수동 입력 모드 (P3, 범위 외) |
| Canvas 텍스트 렌더링 품질 | 중 | 고해상도 캔버스(2x) + imageSmoothingQuality: 'high' |
| 긴 카메라/렌즈명 텍스트 오버플로우 | 중 | maxWidth 제한 + 텍스트 축소/말줄임 처리 |
| 폰트 로딩 타이밍 (커스텀 폰트 시) | 낮 | 기존 Google Fonts 사용, document.fonts.ready 대기 |
| 브랜드 감지 실패 (OEM/마이너 브랜드) | 중 | 기본 테마 fallback, 수동 색상 오버라이드 가능 |
| preset 데이터 호환성 | 낮 | EXIF 관련 필드 미정의 시 기본값 사용 |

## 범위 외 (Not in scope)

- EXIF 수동 입력 (데이터 없을 때 사용자가 직접 입력)
- GPS 위치 정보 표시
- 카메라 브랜드 로고 이미지 (저작권 문제, 텍스트로 대체)
- EXIF 프레임 + 분할 모드 조합
- 커스텀 폰트 업로드
- AVIF/HEIF EXIF 파싱 (현재 JPEG만 지원)
