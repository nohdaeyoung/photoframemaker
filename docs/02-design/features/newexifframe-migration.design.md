# Design: newexifframe-migration

## 아키텍처

```
exif-designer/
  src/
    App.tsx                  루트 컴포넌트, AppState 관리, 레이아웃
    components/
      FrameCanvas.tsx        10개 스타일 CSS 기반 프레임 렌더러
      Sidebar.tsx            좌측 패널 (스타일 선택, 업로드, EXIF 편집, 다운로드)
    hooks/
      useExifParser.ts       exifr로 업로드 이미지 EXIF 자동 파싱
    utils/
      download.ts            html2canvas 기반 다운로드 유틸
    types.ts                 AppState, ExifData 타입 정의
    main.tsx                 엔트리포인트
  index.html                 Google Fonts 링크 포함
  vite.config.ts             base: '/newexif/', outDir: '../newexif'
  tailwind.config.js
  package.json
```

## 컴포넌트 상세

### App.tsx
- `AppState`: `{ styleId, theme, imageSrc, exif, orientation }`
- `STYLES` 배열: 10개 스타일 정의
- 키보드 이벤트: ArrowLeft/Right → 스타일 전환
- `handleImageUpload`: 파일 → DataURL + EXIF 파싱 트리거

### FrameCanvas.tsx
```
Props: { state: AppState; imageRatio: number }
ref: forwardRef<HTMLDivElement>  (html2canvas 캡처용)
```
스타일별 분기 (if-else 체인):
| styleId | 이름 | 확장 방향 |
|---------|------|---------|
| fujifilm | Fuji Recipe | 하단 바 |
| glassmorphism | Glassmorphism | 이미지 위 오버레이 |
| leica | Leica Lux | 하단 바 |
| polaroid | Polaroid | 상하 여백+바 |
| negative | Film Strip | 상하 필름 스트립 |
| shoton | Shot On | 하단 카드 영역 |
| magazine | Editorial | 하단 텍스트 블록 |
| dashboard | HUD | 상하 데이터 패널 |
| minimal | Minimal Line | 하단 한 줄 |
| grid | Card Grid | 하단 카드 그리드 |

### Sidebar.tsx
섹션 구성:
1. 헤더 (데스크톱만)
2. Frame Style 드롭다운
3. Image 업로드 존
4. Camera Preset 버튼 (6개)
5. EXIF Metadata (토글 가능, 실제 파싱 데이터 표시)
6. 액션 바 (Download 버튼)

### useExifParser.ts
```typescript
async function parseExifFromFile(file: File): Promise<Partial<ExifData>>
// exifr.parse()로 Make, Model, LensModel, FNumber, ExposureTime, ISO, DateTimeOriginal 추출
```

### download.ts
```typescript
async function downloadFrame(frameRef: HTMLDivElement, styleId: string): Promise<void>
// html2canvas scale:3 → JPEG 0.95
// glassmorphism인 경우 toast 안내
```

## UI/UX 상세

### 레이아웃
```
Mobile  (< 1024px): 세로 분할 — 상단 preview (55dvh) / 하단 sidebar (45dvh)
Desktop (≥ 1024px): 가로 분할 — 좌측 sidebar (360px) / 우측 preview (flex-1)
```

### 컬러 시스템 (다크 전용)
```
bg-app:     #050505  페이지 배경
bg-sidebar: #0a0a0a  사이드바
bg-card:    #1a1a1a  카드/섹션
accent:     #ff6b35  오렌지 액센트
text:       #e0e0e0  기본 텍스트
muted:      #666666  보조 텍스트
border:     rgba(255,255,255,0.08)  구분선
```

### 폰트
- **UI**: Inter (sans-serif)
- **데이터**: JetBrains Mono (monospace)
- **세리프**: Playfair Display (magazine 스타일)
- **핸드라이팅**: Caveat (polaroid 스타일)

## 빌드 설정

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  base: '/newexif/',
  build: {
    outDir: '../newexif',
    emptyOutDir: true,
  }
})
```

## 배포 플로우

```
cd exif-designer && npm run build
  → ../newexif/ 에 빌드 결과물 생성
  → Vercel outputDirectory "." 에 포함되어 자동 서빙
cd .. && vercel --prod --yes
  → f.324.ing/newexif/ 접근 가능
```

## 구현 체크리스트

- [ ] Vite 프로젝트 생성 (react-ts 템플릿)
- [ ] Tailwind CSS v3 설정
- [ ] Google Fonts 링크 (index.html)
- [ ] types.ts — AppState, ExifData
- [ ] useExifParser.ts — exifr 기반
- [ ] download.ts — html2canvas 기반
- [ ] FrameCanvas.tsx — 10개 스타일 (프로토타입에서 이식)
- [ ] Sidebar.tsx — EXIF 파싱 연동
- [ ] App.tsx — 키보드 이벤트 + 레이아웃
- [ ] vite.config.ts — base/outDir 설정
- [ ] 빌드 테스트
- [ ] Vercel 배포
