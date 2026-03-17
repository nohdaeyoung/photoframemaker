# Plan: upscaling

## 메타
- **Feature**: upscaling
- **목표**: Real-ESRGAN 기반 브라우저 AI 업스케일링 — `/upscale` 전용 페이지
- **우선순위**: Medium
- **작성일**: 2026-03-17

---

## 배경 및 목적

f.324.ing 의 EXIF Frame Designer가 저해상도 원본 사진을 업로드할 경우 다운로드 결과물도 저화질로 출력된다.
Real-ESRGAN 을 이용한 브라우저 사이드 AI 업스케일링으로 출력 품질을 개선한다.

**핵심 철학 유지**: 모든 처리는 브라우저에서 수행 — 서버 GPU 불필요, 이미지 업로드 없음.
WebGPU API 를 통해 사용자 디바이스의 GPU를 직접 사용한다.

---

## 요구사항

### FR-01 전용 페이지 `/upscale`
- 독립 페이지 `/upscale/index.html` 로 구현 (정적 Vite 앱)
- 사이트 공통 내비게이션 포함 (site-nav, nav.css, site.js)
- EXIF Frame Designer(`/newexif/`) 와 완전히 분리된 독립 앱

### FR-02 이미지 업로드
- 클릭 또는 드래그앤드롭으로 이미지 로드
- 브라우저 로컬 파일만 처리 — 서버 전송 없음
- 지원 포맷: JPG, PNG, WebP (최대 20MB)

### FR-03 Real-ESRGAN 추론
- 모델: `RealESRGAN-General-x4v3.onnx` (4.65MB, 4× 업스케일)
- 런타임: ONNX Runtime Web (ort-web)
- 추론 EP 우선순위: WebGPU → WebGL → WASM
- 타일 처리 필수 (입력 256–512px 타일, overlap ~12px)
- 모델 최초 다운로드 후 IndexedDB 캐싱

### FR-04 진행 상황 표시
- 모델 로딩 진행 바 (최초 4.65MB 다운로드 시)
- 타일 처리 진행 바 (N/total tiles)
- 예상 잔여 시간 표시

### FR-05 결과 미리보기 및 다운로드
- Before/After 슬라이더 비교 뷰
- 다운로드: JPEG 95% 또는 PNG 선택
- 파일명: `upscaled_4x_<원본명>.<ext>`
- 업스케일 배율 옵션: 2× (bicubic) / 4× (AI) 선택

### FR-06 EXIF Frame Designer 연동 (선택)
- `/upscale/` 에서 업스케일 완료 → "EXIF 프레임 만들기" 버튼
- 결과 이미지를 `/newexif/` 페이지로 전달 (localStorage 경유)

---

## 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| 런타임 | ONNX Runtime Web (`onnxruntime-web`) | WebGPU/WebGL/WASM 통합 지원 |
| 모델 | RealESRGAN-General-x4v3.onnx (4.65MB) | 속도/품질 균형 최적 |
| 빌드 | Vite + React + TypeScript | 기존 exif-designer 패턴 통일 |
| UI | Tailwind CSS (다크 테마, #050505 기반) | 기존 디자인 시스템 통일 |
| 상태 | useState + useReducer | 추론 상태 머신 관리 |
| 캐싱 | IndexedDB (idb-keyval) | 모델 재다운로드 방지 |

---

## 사용자 플로우

```
1. /upscale 접속
2. 이미지 드래그앤드롭 or 클릭 업로드
3. 모델 로드 (최초: 4.65MB 다운로드 + IndexedDB 저장 / 재방문: 즉시)
4. 배율 선택 (2× bicubic / 4× AI)
5. [업스케일 시작] 버튼 클릭
6. 타일 처리 진행 바 표시 (3–20초 WebGPU 기준)
7. Before/After 슬라이더로 비교
8. 다운로드 (JPEG 95% / PNG)
9. (선택) "EXIF 프레임으로" 버튼 → /newexif/ 이동
```

---

## 디렉토리 구조 (예상)

```
/Volumes/Dev/photoframemaker/
├── upscaler/                  # Vite 소스 (빌드 후 /upscale/ 로 배포)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── DropZone.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── CompareSlider.tsx
│   │   │   └── DownloadPanel.tsx
│   │   ├── hooks/
│   │   │   ├── useOrtSession.ts   # 모델 로딩 + 캐싱
│   │   │   └── useUpscaler.ts     # 타일 추론 로직
│   │   └── utils/
│   │       ├── tiling.ts          # 타일 분할/병합
│   │       └── modelCache.ts      # IndexedDB 캐싱
│   ├── public/
│   │   └── models/
│   │       └── RealESRGAN-General-x4v3.onnx
│   ├── index.html
│   └── vite.config.ts
└── upscale/                   # 빌드 출력 (배포용)
    └── index.html             # nav 추가 필수
```

---

## 비기능 요구사항

| 항목 | 목표 |
|------|------|
| 모델 로딩 (재방문) | < 100ms (IndexedDB 캐시) |
| 2MP 이미지 처리 | < 20s (WebGPU), < 5min (WASM) |
| UI 반응성 | 추론 중에도 UI 블로킹 없음 (Web Worker 고려) |
| 메모리 | 타일 처리로 피크 메모리 < 500MB |
| 모바일 대응 | iOS Safari (WebGL fallback), Android Chrome (WebGPU 지원) |

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| WebGPU 미지원 (구형 브라우저) | 성능 저하 | WebGL fallback 자동 전환, WASM 최종 fallback |
| 대형 이미지 OOM | 브라우저 크래시 | 타일 크기 동적 조정, 입력 해상도 상한 (4096px) |
| 모델 파일 CDN 비용 | 트래픽 과다 시 비용 | IndexedDB 캐싱 + Cache-Control: max-age=31536000 |
| iOS Safari WebGPU 미지원 | 느린 처리 | 명시적 안내 + WebGL fallback |

---

## 구현 범위 (MVP)

**In Scope (MVP)**:
- FR-01 전용 페이지, FR-02 업로드, FR-03 4× AI 추론, FR-04 진행 바, FR-05 다운로드
- WebGPU + WebGL + WASM 3단계 fallback

**Out of Scope (MVP 이후)**:
- FR-06 EXIF Frame Designer 연동
- 2× bicubic 옵션 (추후 추가)
- 배치 처리 (여러 장 동시)
- 커스텀 모델 선택 (Anime, Face 특화)

---

## 완료 기준

- [ ] `/upscale/` 페이지 접속 가능 (사이트 내비 포함)
- [ ] 이미지 업로드 → 4× 업스케일 → 다운로드 전체 플로우 동작
- [ ] 모델 IndexedDB 캐싱 (재방문 즉시 로드)
- [ ] Before/After 슬라이더 정상 동작
- [ ] WebGPU / WebGL / WASM fallback 모두 동작 확인
- [ ] 모바일(iPhone Safari) 에서 최소 WebGL fallback 동작
