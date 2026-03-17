# Design: upscaling

## 메타
- **Feature**: upscaling
- **Plan 참조**: `docs/01-plan/features/upscaling.plan.md`
- **작성일**: 2026-03-17
- **구현 대상**: `/Volumes/Dev/photoframemaker/upscaler/` (신규 Vite 앱)
- **배포 경로**: `/upscale/` (photoframemaker Cloudflare Pages)

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────┐
│  /upscale/ (정적 Vite React 앱)                          │
│                                                         │
│  App.tsx                                               │
│   ├── [idle]    DropZone                               │
│   ├── [loading] ModelLoader + ProgressBar              │
│   ├── [ready]   ImagePreview + UpscaleButton           │
│   ├── [running] TileProgress + ProgressBar             │
│   └── [done]    CompareSlider + DownloadPanel          │
│                                                         │
│  Hooks                                                  │
│   ├── useOrtSession   — 모델 로딩 + IndexedDB 캐싱      │
│   └── useUpscaler     — 타일 추론 오케스트레이션         │
│                                                         │
│  Utils                                                  │
│   ├── tiling.ts       — 이미지 분할/병합                │
│   └── modelCache.ts   — IndexedDB r/w                  │
└─────────────────────────────────────────────────────────┘
        │ WebGPU / WebGL / WASM
        ▼
   사용자 GPU (ONNX Runtime Web)
        │
        ▼
   모델: RealESRGAN-General-x4v3.onnx (4.65MB)
```

---

## 2. 상태 머신

```
idle
 │  (파일 선택)
 ▼
model_loading          // 최초 방문 — 모델 4.65MB 다운로드
 │  (모델 준비 완료)
 ▼
ready                  // 재방문 또는 로딩 완료 — 추론 대기
 │  (업스케일 시작 버튼)
 ▼
running                // 타일 추론 진행 중
 │  (전체 타일 완료)
 ▼
done                   // 결과 준비 — 슬라이더/다운로드 활성화
 │  (새 이미지 선택)
 ▼
ready (재진입)
```

```typescript
// types.ts
type AppPhase =
  | { status: 'idle' }
  | { status: 'model_loading'; progress: number }  // 0–100
  | { status: 'ready'; imageSrc: string; imageSize: [number, number] }
  | { status: 'running'; tilesDone: number; tilesTotal: number; etaMs: number }
  | { status: 'done'; originalSrc: string; upscaledSrc: string; scale: number };
```

---

## 3. 컴포넌트 설계

### 3.1 App.tsx

```typescript
// 전체 레이아웃 + 상태 머신 컨트롤러
export default function App() {
  const [phase, dispatch] = useReducer(phaseReducer, { status: 'idle' });
  const { session, ep } = useOrtSession({ onProgress });
  const { run: runUpscale, cancel } = useUpscaler(session);

  return (
    <div className="min-h-[calc(100dvh-49px)] bg-[#050505] text-[#e0e0e0] flex flex-col">
      {/* 상단 헤더 */}
      <Header ep={ep} />
      {/* 메인 콘텐츠 — phase별 분기 */}
      <main className="flex-1 flex items-center justify-center p-6">
        {phase.status === 'idle' && <DropZone onFile={handleFile} />}
        {phase.status === 'model_loading' && <ModelLoader progress={phase.progress} />}
        {phase.status === 'ready' && (
          <ReadyView image={phase.imageSrc} size={phase.imageSize} onStart={handleStart} />
        )}
        {phase.status === 'running' && (
          <RunningView done={phase.tilesDone} total={phase.tilesTotal} eta={phase.etaMs} onCancel={cancel} />
        )}
        {phase.status === 'done' && (
          <DoneView original={phase.originalSrc} upscaled={phase.upscaledSrc} scale={phase.scale} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}
```

### 3.2 DropZone.tsx

```
- 전체 화면 드래그 감지 (document 이벤트)
- 중앙 점선 박스 (클릭 업로드)
- 지원 포맷/최대 크기 안내
- 파일 검증: 포맷 체크, 20MB 상한, 최대 해상도 4096px 경고
```

**Props**:
```typescript
interface DropZoneProps {
  onFile: (file: File) => void;
}
```

### 3.3 ModelLoader.tsx

```
- 원형 또는 선형 진행 바
- "AI 모델 로딩 중... 4.65MB (최초 1회)" 메시지
- 재방문 시 < 100ms → 이 컴포넌트 표시되지 않음
```

### 3.4 ReadyView.tsx

```
- 업로드된 이미지 썸네일 (max 400px)
- 원본 해상도 / 업스케일 후 예상 해상도 표시
  예: 1200×800 → 4× → 4800×3200
- [업스케일 시작] 버튼 (accent #ff6b35)
- "다른 사진" 버튼
```

### 3.5 RunningView.tsx

```
- 타일 진행 바: "타일 12 / 48"
- ETA 카운트다운: "약 8초 남음"
- GPU 정보: "WebGPU 사용 중" / "WebGL fallback" / "CPU(WASM)"
- [취소] 버튼
```

### 3.6 CompareSlider.tsx

```
- 좌우 드래그 가능 슬라이더
- 왼쪽: 원본 (BEFORE 레이블)
- 오른쪽: 업스케일 결과 (AFTER 레이블)
- 중앙 구분선 + 손잡이 아이콘
- 모바일 터치 지원
```

**Props**:
```typescript
interface CompareSliderProps {
  before: string;  // dataURL or objectURL
  after: string;
  width: number;
  height: number;
}
```

구현 방식: CSS `clip-path` 또는 두 `<img>` 를 absolute로 겹쳐 wrapper width를 클리핑.

### 3.7 DownloadPanel.tsx

```
- 해상도 정보: "4800 × 3200 (4× AI)"
- [JPEG 95% 다운로드] 버튼 (주 버튼)
- [PNG 다운로드] 버튼 (보조 버튼)
- [새 사진 업스케일] 버튼
- [EXIF 프레임 만들기 →] 링크 (MVP 이후)
```

### 3.8 Header.tsx

```
- f.324.ing 브랜드명 + "AI UPSCALER" 서브타이틀
- EP 배지: 🟢 WebGPU / 🟡 WebGL / 🔴 CPU (WASM)
- 우측: GitHub 링크 (선택)
```

---

## 4. Hooks 설계

### 4.1 useOrtSession

```typescript
interface UseOrtSessionResult {
  session: ort.InferenceSession | null;
  ep: 'webgpu' | 'webgl' | 'wasm';
  isLoading: boolean;
  loadProgress: number;  // 0–100
  error: Error | null;
}

function useOrtSession(opts: { onProgress?: (p: number) => void }): UseOrtSessionResult
```

**내부 로직**:
1. `modelCache.get()` → IndexedDB 에서 ArrayBuffer 조회
2. 캐시 없음: `fetch('/models/RealESRGAN-General-x4v3.onnx')` + ReadableStream progress 추적 → `modelCache.set()`
3. `ort.InferenceSession.create(buffer, { executionProviders: ['webgpu', 'webgl', 'wasm'] })`
4. 실제 사용된 EP를 세션 생성 후 감지하여 반환

### 4.2 useUpscaler

```typescript
interface UpscalerOptions {
  tileSize?: number;   // 기본 256
  overlap?: number;    // 기본 12
}

interface UseUpscalerResult {
  run: (src: ImageData, opts?: UpscalerOptions) => Promise<ImageData>;
  cancel: () => void;
  tilesDone: number;
  tilesTotal: number;
}

function useUpscaler(session: ort.InferenceSession | null): UseUpscalerResult
```

**내부 로직**:
```
1. ImageData → tiling.splitTiles(src, tileSize, overlap)
2. 각 타일: Float32Array 변환 → ort.Tensor → session.run()
3. 결과 Tensor → Float32Array → tiling.mergeTiles(results, originalSize, overlap)
4. cancel 호출 시 루프 탈출 + AbortController
```

---

## 5. 타일링 알고리즘 (`utils/tiling.ts`)

### 5.1 분할 (splitTiles)

```typescript
interface Tile {
  x: number; y: number;  // 원본 이미지 내 위치
  w: number; h: number;  // 타일 크기 (패딩 포함)
  data: Float32Array;    // [1, 3, h, w] NCHW, 0–1 정규화
}

function splitTiles(
  imageData: ImageData,
  tileSize: number = 256,
  overlap: number = 12
): Tile[]
```

분할 방식:
```
stride = tileSize - overlap * 2
tiles_x = ceil(width / stride)
tiles_y = ceil(height / stride)

각 타일:
  x_start = i * stride - overlap (clamp to 0)
  x_end   = x_start + tileSize   (clamp to width)
  → 가장자리 타일은 tileSize 미만 → 패딩 없이 그대로 사용
```

**정규화**: RGB [0, 255] → [0.0, 1.0], NCHW 배열로 변환.

### 5.2 병합 (mergeTiles)

```typescript
function mergeTiles(
  tiles: Array<{ tile: Tile; output: Float32Array }>,
  originalSize: [number, number],  // [w, h]
  overlap: number,
  scale: number = 4
): ImageData
```

병합 방식:
- 출력 캔버스: `[originalW * scale, originalH * scale]`
- 각 타일 결과: overlap 영역 제거 (내부 영역만 사용)
- `output_x = tile.x * scale + overlap * scale` 위치에 복사
- 가장자리 타일: overlap 제거 없이 전체 사용

---

## 6. 모델 캐싱 (`utils/modelCache.ts`)

```typescript
const DB_NAME = 'f324-upscaler';
const STORE_NAME = 'models';
const MODEL_KEY = 'realesrgan-x4v3';

async function get(): Promise<ArrayBuffer | undefined>
async function set(buffer: ArrayBuffer): Promise<void>
```

구현: `idb-keyval` 라이브러리 (1.3KB gzip) 사용.
키: `realesrgan-x4v3` — 모델 버전 변경 시 키 변경으로 자동 갱신.

---

## 7. 파일 구조 (최종)

```
upscaler/
├── src/
│   ├── App.tsx
│   ├── types.ts                    # AppPhase, Tile 타입
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── DropZone.tsx
│   │   ├── ModelLoader.tsx
│   │   ├── ReadyView.tsx
│   │   ├── RunningView.tsx
│   │   ├── CompareSlider.tsx
│   │   └── DownloadPanel.tsx
│   ├── hooks/
│   │   ├── useOrtSession.ts
│   │   └── useUpscaler.ts
│   └── utils/
│       ├── tiling.ts
│       └── modelCache.ts
├── public/
│   └── models/
│       └── RealESRGAN-General-x4v3.onnx   # 4.65MB
├── index.html                              # Vite 빌드 전 템플릿
└── vite.config.ts
```

**vite.config.ts 핵심 설정**:
```typescript
export default defineConfig({
  base: '/upscale/',        // Cloudflare Pages 경로
  build: { outDir: '../upscale' },  // photoframemaker/upscale/ 로 출력
  optimizeDeps: {
    exclude: ['onnxruntime-web'],   // WASM 번들링 제외 필수
  },
  server: { headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',    // WebGPU/SharedArrayBuffer 필수
    'Cross-Origin-Embedder-Policy': 'require-corp',
  }},
});
```

**배포 후 index.html 수동 패치** (빌드마다 필요):
```html
<!-- head에 추가 -->
<script>(function(){var t=localStorage.getItem('pfm-theme');if(t)document.documentElement.setAttribute('data-theme',t)})();</script>
<link rel="stylesheet" href="/nav.css">

<!-- body 시작에 추가 -->
<div id="site-nav"></div>

<!-- body 끝에 추가 -->
<script src="/site.js"></script>

<!-- #root 높이 조정 -->
<style>#root { height: calc(100dvh - 49px); }</style>
```

---

## 8. 의존성

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "onnxruntime-web": "^1.20.0",
    "idb-keyval": "^6.2.1"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5",
    "tailwindcss": "^3",
    "autoprefixer": "^10",
    "postcss": "^8"
  }
}
```

**ONNX Runtime Web WASM 파일 처리**:
`onnxruntime-web` 은 `node_modules/onnxruntime-web/dist/*.wasm` 을 public/ 에 복사하거나 CDN에서 로드해야 함.
```typescript
// App.tsx 또는 useOrtSession.ts 최상단
import * as ort from 'onnxruntime-web';
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/';
```

---

## 9. CORS 헤더 (Cloudflare Pages `_headers`)

`photoframemaker/_headers` 에 추가:

```
/upscale/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

WebGPU 및 SharedArrayBuffer 사용 시 COEP/COOP 헤더 필수.

---

## 10. 구현 순서

1. **프로젝트 셋업** — `upscaler/` Vite+React+TS+Tailwind 초기화
2. **모델 캐싱** — `modelCache.ts` + `useOrtSession` 구현 및 로딩 검증
3. **타일링** — `tiling.ts` splitTiles/mergeTiles 구현 + 단위 테스트
4. **useUpscaler** — 타일 루프 + 진행 상태 + 취소
5. **UI 컴포넌트** — DropZone → ReadyView → RunningView → CompareSlider → DownloadPanel
6. **App.tsx 조립** — 상태 머신 + 컴포넌트 연결
7. **빌드 + 배포** — `npm run build` → `upscale/index.html` 수동 패치 → `wrangler pages deploy`

---

## 11. 완료 기준 (Plan 연계)

| 기준 | 구현 항목 |
|------|----------|
| `/upscale/` 접속 가능 | vite.config `base: '/upscale/'`, 빌드 출력 경로 |
| 업로드 → 추론 → 다운로드 | DropZone → useUpscaler → DownloadPanel |
| IndexedDB 캐싱 | modelCache.ts + useOrtSession |
| Before/After 슬라이더 | CompareSlider.tsx |
| WebGPU/WebGL/WASM fallback | `executionProviders: ['webgpu', 'webgl', 'wasm']` |
| 모바일 WebGL fallback | COOP/COEP 헤더, isMobile 감지 안내 |
