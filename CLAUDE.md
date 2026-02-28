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
