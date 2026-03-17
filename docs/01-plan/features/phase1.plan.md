# Phase 1 Plan: 색상 자동 추출 + 즐겨찾기

## 개요

Photo Frame Maker의 사용자 증가, 리텐션, 차별화를 위한 Phase 1 기능 구현.
두 기능 모두 기존 코드 재활용도가 높고, 공통 메서드(`applyPreset()`)를 공유한다.

## 목표

| 목표 | 측정 지표 | 기대 효과 |
|------|----------|----------|
| 차별화 | "Auto" 색상 사용률 | 경쟁 도구 대비 독자적 기능 |
| 리텐션 | 재방문률, 즐겨찾기 저장 수 | 설정 재사용으로 반복 방문 유도 |
| UX 개선 | 설정 시간 단축 | 원클릭으로 최적 프레임 적용 |

---

## 기능 1: 색상 자동 추출 프레임

### 배경

현재 `drawGradientBackground()` (app.js:1070~1103)에 이미지에서 dominant color를 추출하는 로직이 존재하지만, gradient 배경 전용으로만 사용 중. 이 로직을 공용 메서드로 분리하여 단색 프레임에도 적용한다.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| AC-1 | color preset에 "Auto" 스와치 추가 | P1 |
| AC-2 | 이미지의 dominant color를 추출하여 프레임 색상으로 자동 적용 | P1 |
| AC-3 | 이미지 변경(selectImage) 시 auto 색상 자동 업데이트 | P1 |
| AC-4 | complementary color 옵션 (dominant의 보색) | P2 |
| AC-5 | 데스크톱 + 모바일 양쪽 UI 동기화 | P1 |

### 기술 설계

```
기존 코드 재활용:
drawGradientBackground() → extractDominantColor(img) 메서드 분리

색상 추출 알고리즘:
  img → 32x32 축소 → getImageData() → 전체 픽셀 평균 → dominant color
  (기존 gradient는 사분면별 추출, auto는 전체 평균 1색)

상태 관리:
  frameColor = 'auto'  → render() 시 extractDominantColor() 호출
  this._autoDominantColor 캐시 (이미지 변경 시 무효화)

렌더링 흐름:
  render() → drawFrameBackground()
    if frameColor === 'auto':
      color = this._autoDominantColor || extractDominantColor(img)
      ctx.fillStyle = color
      ctx.fillRect(0, 0, canvasW, canvasH)
```

### 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `app.js` | `extractDominantColor()` 메서드 추가, `drawFrameBackground()` auto 분기 추가, `selectImage()` 캐시 무효화 |
| `index.html` | color-presets에 auto 스와치 추가 (데스크톱 + 모바일) |
| `style.css` | `.color-swatch-auto` 스타일 (무지개/그라데이션 배경) |

---

## 기능 2: 프레임 히스토리 & 즐겨찾기

### 배경

현재 새로고침 시 모든 설정이 초기화됨. 반복 사용자가 매번 동일 설정을 재조정해야 하는 불편. localStorage 기반으로 회원가입 없이 설정 저장/복원 기능 제공.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FV-1 | 마지막 사용 설정 자동 저장/복원 (앱 시작 시) | P1 |
| FV-2 | 즐겨찾기 슬롯 최대 5개, 저장/삭제/적용 | P1 |
| FV-3 | 즐겨찾기에 이름 지정 가능 | P2 |
| FV-4 | 즐겨찾기 UI: 사이드바 하단 섹션 (데스크톱) + 탭 패널 (모바일) | P1 |
| FV-5 | applyPreset(preset) 공용 메서드 (기능 1, 2 공유) | P1 |

### 기술 설계

```
프리셋 데이터 구조:
{
  name: "My Style",          // FV-3
  canvasRatio: [1, 1],
  frameRatio: 5,
  frameColor: '#FFFFFF',     // 'auto' 포함 가능
  blurIntensity: 50,
  pixelateIntensity: 50
}

localStorage 키:
  'pfm-last-settings'  → 마지막 설정 (자동)
  'pfm-favorites'      → 즐겨찾기 배열 (최대 5)

applyPreset(preset) 메서드:
  1. 상태값 업데이트 (canvasRatio, frameRatio, frameColor, ...)
  2. 데스크톱 UI 동기화 (슬라이더, 입력, 스와치 active)
  3. 모바일 UI 동기화
  4. resetAllOffsets()
  5. render()
  6. updateInfo()

자동 저장 타이밍:
  - render() 호출 시 debounce (500ms) → saveLastSettings()
  - 또는 beforeunload 이벤트
```

### 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `app.js` | `applyPreset()`, `saveLastSettings()`, `loadLastSettings()`, `saveFavorite()`, `removeFavorite()`, `renderFavoritesUI()` 메서드 추가 |
| `index.html` | 즐겨찾기 섹션 HTML (데스크톱 사이드바 + 모바일 탭) |
| `style.css` | `.favorites-section`, `.favorite-item`, `.favorite-save-btn` 스타일 |

---

## 공통 의존성

```
applyPreset(preset) — 공유 메서드
  ├── 기능 1: auto 색상 적용 시 내부적으로 사용
  ├── 기능 2: 즐겨찾기 적용 시 사용
  └── 향후 Phase 2 프리셋 템플릿에서도 재사용
```

## 구현 순서

```
Step 1: applyPreset() 공용 메서드 구현
  └── 모든 상태값 + UI 동기화 로직

Step 2: extractDominantColor() 분리 + auto 프레임
  ├── drawGradientBackground()에서 색상 추출 로직 분리
  ├── drawFrameBackground()에 'auto' 분기 추가
  ├── HTML에 auto 스와치 추가
  └── CSS 스타일

Step 3: localStorage 기반 마지막 설정 저장/복원
  ├── saveLastSettings() + debounce
  ├── loadLastSettings() in constructor
  └── 테스트

Step 4: 즐겨찾기 UI + 저장/삭제/적용
  ├── HTML 즐겨찾기 섹션
  ├── saveFavorite() / removeFavorite()
  ├── renderFavoritesUI()
  └── 모바일 동기화

Step 5: 통합 테스트 + 빌드 + 배포
```

## 리스크 & 대응

| 리스크 | 가능성 | 대응 |
|--------|--------|------|
| auto 색상이 미적으로 불만족 | 중 | 채도/밝기 보정 알고리즘 적용 (HSL 변환 후 조정) |
| 다중 이미지에서 이미지별 다른 auto 색상 | 중 | 선택된 이미지 기준으로 적용, 사용자에게 자연스러움 |
| localStorage 용량 제한 | 낮 | 프리셋 데이터 < 1KB, 문제 없음 |
| UI 이중 구조 동기화 누락 | 중 | applyPreset()에서 중앙 관리, 체크리스트 검증 |

## 범위 외 (Not in scope)

- 프리미엄/유료 프리셋 (Phase 2)
- 워터마크 기능 (Phase 3)
- EXIF 기반 자동 스타일링 (Phase 4)
- 서버 사이드 프리셋 저장 (회원가입 필요)
- 프리셋 공유/내보내기
