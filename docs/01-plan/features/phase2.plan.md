# Phase 2 Plan: 이미지 압축/최적화 + 포맷 변환

## 개요

Photo Frame Maker의 다운로드 기능을 확장하여 출력 포맷(PNG/JPG/WebP) 선택과 품질 조절을 지원한다. 현재 PNG 고정 출력만 가능한 것을 사용자가 용도에 맞게 포맷과 품질을 선택할 수 있도록 개선한다.

## 목표

| 목표 | 측정 지표 | 기대 효과 |
|------|----------|----------|
| 실용성 | JPG/WebP 다운로드 비율 | 파일 크기 50~80% 절감, SNS 업로드 최적화 |
| 차별화 | 포맷 변환 사용률 | 별도 변환 도구 불필요, 올인원 제공 |
| UX 개선 | 품질 조절 사용률 | 용도별 최적 출력 (인쇄용 고품질 vs SNS용 경량) |

---

## 기능 1: 출력 포맷 선택

### 배경

현재 모든 다운로드가 `canvas.toBlob(callback, 'image/png')`로 PNG 고정. `toBlob()`의 두 번째 인자만 변경하면 JPG/WebP 출력이 가능하다. 브라우저 Canvas API가 기본 지원하므로 외부 라이브러리 불필요.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FT-1 | 출력 포맷 선택 UI: PNG / JPG / WebP | P1 |
| FT-2 | 포맷에 따라 파일 확장자 자동 변경 | P1 |
| FT-3 | WebP 미지원 브라우저 시 해당 옵션 비활성화 | P1 |
| FT-4 | 데스크톱 + 모바일 UI 동기화 | P1 |

### 기술 설계

```
상태:
  this.outputFormat = 'png'   // 'png' | 'jpeg' | 'webp'

MIME 매핑:
  'png'  → 'image/png'   (확장자 .png)
  'jpeg' → 'image/jpeg'  (확장자 .jpg)
  'webp' → 'image/webp'  (확장자 .webp)

변경 위치 (toBlob 호출 4곳):
  1. downloadSingle()      — app.js:2704
  2. renderItemToBlob()    — app.js:2919
  3. renderSplitPanelToBlob() — app.js:861
  4. downloadSplit() 내부   — (renderSplitPanelToBlob 호출)

공통 헬퍼:
  getMimeType()    → this.outputFormat에 따른 MIME 반환
  getExtension()   → this.outputFormat에 따른 확장자 반환
  getQuality()     → JPG/WebP 시 quality 값 반환 (PNG는 무시)

WebP 지원 감지:
  init() 시 테스트 canvas로 toBlob('image/webp') 가능 여부 체크
  this.supportsWebP = true/false
```

---

## 기능 2: 품질(압축률) 조절

### 배경

`canvas.toBlob(callback, mimeType, quality)`의 세 번째 인자로 0.0~1.0 품질 지정 가능. PNG는 무손실이라 quality 무시, JPG/WebP에서만 유효.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| QC-1 | 품질 슬라이더 (1~100, 기본 92) | P1 |
| QC-2 | PNG 선택 시 슬라이더 비활성화 + "무손실" 표시 | P1 |
| QC-3 | 예상 파일 크기 표시 (선택 사항) | P3 |
| QC-4 | 데스크톱 + 모바일 UI 동기화 | P1 |

### 기술 설계

```
상태:
  this.outputQuality = 92   // 1~100

toBlob 호출 시:
  const quality = this.outputFormat === 'png' ? undefined : this.outputQuality / 100;
  canvas.toBlob(callback, this.getMimeType(), quality);

UI:
  PNG 선택 시 → 슬라이더 disabled, "무손실" 라벨
  JPG/WebP 선택 시 → 슬라이더 활성화, 값 표시
```

---

## 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `app.js` | `outputFormat`, `outputQuality` 상태 추가, `getMimeType()`, `getExtension()`, `getQuality()` 헬퍼, `toBlob()` 호출 4곳 수정, WebP 지원 감지, 포맷/품질 UI 이벤트 |
| `index.html` | 포맷 선택 버튼 그룹 + 품질 슬라이더 (데스크톱 다운로드 섹션 + 모바일 다운로드 탭) |
| `style.css` | `.format-buttons`, `.quality-control` 스타일 |

## 구현 순서

```
Step 1: 상태 + 헬퍼 메서드 추가
  ├── outputFormat, outputQuality 초기값
  ├── getMimeType(), getExtension(), getQuality()
  └── WebP 지원 감지

Step 2: toBlob() 호출 수정 (4곳)
  ├── downloadSingle()
  ├── renderItemToBlob()
  ├── renderSplitPanelToBlob()
  └── 파일명 확장자 동적 변경

Step 3: HTML UI 추가
  ├── 데스크톱: 다운로드 버튼 위에 포맷 + 품질 컨트롤
  └── 모바일: 다운로드 탭 내 포맷 + 품질 컨트롤

Step 4: CSS 스타일

Step 5: JS 이벤트 바인딩
  ├── 포맷 버튼 클릭 → outputFormat 변경
  ├── 품질 슬라이더 → outputQuality 변경
  ├── PNG 시 슬라이더 비활성화
  └── 데스크톱 ↔ 모바일 동기화

Step 6: getCurrentPreset() / applyPreset() 확장
  └── outputFormat, outputQuality를 preset에 포함 (즐겨찾기에 저장됨)

Step 7: 통합 테스트 + 빌드
```

## 리스크 & 대응

| 리스크 | 가능성 | 대응 |
|--------|--------|------|
| WebP 미지원 브라우저 | 낮 (IE만) | 지원 감지 후 옵션 숨김, PNG/JPG fallback |
| JPG 투명 배경 손실 | 중 | 프레임이 항상 배경을 채우므로 투명 영역 없음, 문제 없음 |
| 품질 낮출 때 시각적 열화 | 중 | 슬라이더 기본값 92 (고품질), 프리뷰에는 영향 없음 (다운로드만) |
| preset 데이터 호환성 | 낮 | outputFormat/Quality 미정의 시 기존 기본값 사용 |

## 범위 외 (Not in scope)

- 이미지 리사이징 (별도 기능)
- 배치 포맷 변환 (프레임 없이 포맷만 변환)
- AVIF 포맷 (브라우저 지원 미흡)
- 서버 사이드 압축
