# Phase 2 Design: 이미지 압축/최적화 + 포맷 변환

> Plan 문서: `docs/01-plan/features/phase2.plan.md`
> UI 위치: `app-mode-toggle` 버튼 그룹에 세 번째 모드 "변환" 추가

---

## 1. 앱 모드 확장

### 1.1 기존 구조

```
현재 app-mode-toggle:
  [프레임] [분할]

appMode = 'frame' | 'split'
```

### 1.2 변경 후 구조

```
변경 후 app-mode-toggle:
  [프레임] [분할] [변환]

appMode = 'frame' | 'split' | 'convert'
```

### 1.3 변환 모드 동작

변환 모드 진입 시:
- 사이드바를 변환 전용 컨트롤로 전환 (포맷 선택 + 품질 슬라이더)
- 프레임/비율/색상 컨트롤 숨김 (split 모드와 동일 패턴)
- 다운로드 버튼 라벨 동적 변경 ("JPG 다운로드 (92%)" 등)
- 프리뷰는 원본 이미지 그대로 표시 (프레임 없음, 비율 변환 없음)

---

## 2. 상태 설계

```javascript
// constructor에 추가
this.outputFormat = 'jpeg';      // 'png' | 'jpeg' | 'webp'
this.outputQuality = 92;         // 1~100 (PNG 시 무시)
this.supportsWebP = false;       // init()에서 감지
```

---

## 3. 헬퍼 메서드

```javascript
getMimeType() {
    return { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[this.outputFormat];
}

getExtension() {
    return { png: '.png', jpeg: '.jpg', webp: '.webp' }[this.outputFormat];
}

getBlobArgs() {
    // PNG는 무손실이므로 quality 인자 불필요
    const mime = this.getMimeType();
    const quality = this.outputFormat === 'png' ? undefined : this.outputQuality / 100;
    return [mime, quality];
}

checkWebPSupport() {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    return c.toDataURL('image/webp').startsWith('data:image/webp');
}
```

---

## 4. UI 설계

### 4.1 HTML — app-mode-toggle 버튼 추가

```html
<div class="app-mode-toggle" id="app-mode-toggle">
    <button class="app-mode-btn active" data-mode="frame">프레임</button>
    <button class="app-mode-btn" data-mode="split">분할</button>
    <button class="app-mode-btn" data-mode="convert">변환</button>
</div>
```

### 4.2 HTML — 데스크톱 변환 컨트롤 섹션

사이드바 내부, 기존 섹션들과 동급 위치. 변환 모드일 때만 표시.

```html
<section class="control-section convert-section" id="convert-section" style="display:none">
    <h2>출력 포맷</h2>
    <div class="format-buttons" id="format-buttons">
        <button class="format-btn active" data-format="jpeg">JPG</button>
        <button class="format-btn" data-format="png">PNG</button>
        <button class="format-btn" data-format="webp">WebP</button>
    </div>

    <div class="quality-control" id="quality-control">
        <div class="quality-header">
            <span>품질</span>
            <span class="quality-value" id="quality-value">92%</span>
        </div>
        <input type="range" id="quality-slider" min="1" max="100" value="92">
    </div>
</section>
```

### 4.3 HTML — 모바일 변환 탭 패널

모바일 탭바에 변환 탭 추가:

```html
<!-- 모바일 탭 버튼 (tab-bar 내부) -->
<button class="tab-btn" data-tab="convert" id="mobile-tab-btn-convert" style="display:none">
    <svg ...>변환 아이콘</svg>
    <span>변환</span>
</button>

<!-- 모바일 탭 패널 -->
<div class="tab-panel" id="tab-panel-convert" data-tab="convert">
    <div class="tab-panel-content">
        <div class="tab-panel-header">출력 포맷</div>
        <div class="format-buttons" id="mobile-format-buttons">
            <button class="format-btn active" data-format="jpeg">JPG</button>
            <button class="format-btn" data-format="png">PNG</button>
            <button class="format-btn" data-format="webp">WebP</button>
        </div>
        <div class="quality-control" id="mobile-quality-control">
            <div class="quality-header">
                <span>품질</span>
                <span class="quality-value" id="mobile-quality-value">92%</span>
            </div>
            <input type="range" id="mobile-quality-slider" min="1" max="100" value="92">
        </div>
    </div>
</div>
```

---

## 5. switchAppMode() 확장

```
switchAppMode(mode):
  기존 'frame'/'split' 분기 유지

  + 'convert' 분기 추가:
    1. 프레임/비율/색상/분할 컨트롤 숨김
    2. convert-section 표시
    3. 모바일: 프레임/색상 탭 숨김, 변환 탭 표시
    4. 다운로드 버튼 라벨 업데이트

  + 'convert'에서 나올 때:
    1. convert-section 숨김
    2. 모바일 변환 탭 숨김
    3. 기존 UI 복원 (frame/split 분기로)
```

---

## 6. 변환 모드 렌더링

변환 모드에서는 프레임 없이 원본 이미지를 캔버스에 그대로 표시:

```
render():
  if (appMode === 'convert'):
    캔버스 크기 = 원본 이미지 비율 유지
    프레임 배경 없이 이미지만 그리기
    return

  // 기존 프레임/분할 렌더링 로직
```

---

## 7. 다운로드 흐름 수정

### 7.1 변환 모드 다운로드

```
download():
  if (appMode === 'convert'):
    await downloadConverted()
    return
  // 기존 로직

downloadConverted():
  각 이미지를 원본 크기로 캔버스에 그린 후
  toBlob(...getBlobArgs()) 로 변환
  확장자: getExtension()
```

### 7.2 프레임 모드 다운로드 (기존)

프레임/분할 모드에서는 기존대로 PNG 고정 유지.
변환 모드 전용으로 포맷/품질 적용 → 기존 코드 변경 최소화.

---

## 8. 다운로드 버튼 라벨 동적 변경

```
updateDownloadLabel():
  if (appMode === 'convert'):
    if (outputFormat === 'png'):
      라벨 = 'PNG 다운로드 (무손실)'
    else:
      라벨 = '{FORMAT} 다운로드 ({quality}%)'
  else:
    라벨 = 'PNG 다운로드 (무손실)'   ← 기존 고정
```

---

## 9. CSS 설계

```css
/* 포맷 선택 버튼 */
.format-buttons {
    display: flex;
    gap: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 3px;
}
.format-btn {
    flex: 1;
    padding: 6px 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s;
}
.format-btn.active {
    background: var(--accent);
    color: #fff;
}
.format-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

/* 품질 슬라이더 */
.quality-control {
    margin-top: 16px;
}
.quality-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 8px;
}
.quality-value {
    font-weight: 600;
    color: var(--text);
}
.quality-control.disabled {
    opacity: 0.4;
    pointer-events: none;
}
```

---

## 10. 이벤트 바인딩

```
setupEventListeners() 내부:

// 포맷 버튼 (이벤트 위임)
formatButtons.addEventListener('click', e => {
    const btn = e.target.closest('.format-btn');
    if (!btn || btn.disabled) return;
    this.outputFormat = btn.dataset.format;
    // 데스크톱 + 모바일 active 동기화
    // PNG 시 품질 슬라이더 비활성화
    this.updateQualityControlState();
    this.updateDownloadLabel();
});
// 모바일도 동일

// 품질 슬라이더
qualitySlider.addEventListener('input', () => {
    this.outputQuality = parseInt(qualitySlider.value);
    // 데스크톱 + 모바일 동기화
    this.updateDownloadLabel();
});
// 모바일도 동일
```

---

## 11. bindElements() 추가

```javascript
this.convertSection = document.getElementById('convert-section');
this.formatButtons = document.getElementById('format-buttons');
this.qualitySlider = document.getElementById('quality-slider');
this.qualityValue = document.getElementById('quality-value');
this.qualityControl = document.getElementById('quality-control');
this.mobileFormatButtons = document.getElementById('mobile-format-buttons');
this.mobileQualitySlider = document.getElementById('mobile-quality-slider');
this.mobileQualityValue = document.getElementById('mobile-quality-value');
this.mobileQualityControl = document.getElementById('mobile-quality-control');
this.mobileTabBtnConvert = document.getElementById('mobile-tab-btn-convert');
this.tabPanelConvert = document.getElementById('tab-panel-convert');
```

---

## 12. 구현 순서

```
Step 1: 상태 + 헬퍼 메서드                    [app.js]
  ├── outputFormat, outputQuality, supportsWebP
  ├── getMimeType(), getExtension(), getBlobArgs()
  └── checkWebPSupport() in init()

Step 2: HTML 변환 모드 버튼 + 컨트롤            [index.html]
  ├── app-mode-toggle에 "변환" 버튼 추가
  ├── 데스크톱 convert-section
  └── 모바일 변환 탭 버튼 + 패널

Step 3: CSS 스타일                             [style.css]
  ├── .format-buttons, .format-btn
  └── .quality-control, .quality-header

Step 4: switchAppMode() 확장                   [app.js]
  ├── 'convert' 분기 추가
  ├── UI 토글 로직
  └── 모바일 탭 토글

Step 5: 변환 모드 렌더링                        [app.js]
  └── render() 내 convert 분기

Step 6: downloadConverted() 구현               [app.js]
  ├── 원본 크기 캔버스 + toBlob(getBlobArgs())
  ├── 파일명 확장자 동적 변경
  └── 다중 이미지: Web Share / ZIP

Step 7: 이벤트 바인딩 + bindElements()          [app.js]
  ├── 포맷 버튼 클릭
  ├── 품질 슬라이더
  ├── 다운로드 라벨 업데이트
  └── 데스크톱 ↔ 모바일 동기화

Step 8: 통합 테스트 + 빌드
```

---

## 13. 기존 코드 변경 최소화

| 메서드/영역 | 변경 |
|------------|------|
| `constructor` | `outputFormat`, `outputQuality`, `supportsWebP` 추가 |
| `init()` | `checkWebPSupport()` 호출 |
| `bindElements()` | 변환 UI 요소 바인딩 추가 |
| `setupEventListeners()` | 포맷/품질 이벤트 추가 |
| `switchAppMode()` | `'convert'` 분기 추가 |
| `render()` | `convert` 모드 분기 추가 (기존 로직 변경 없음) |
| `download()` | `convert` 모드 분기 추가 (기존 로직 변경 없음) |
| `downloadSingle()` | 변경 없음 (프레임 모드 PNG 유지) |
| `renderItemToBlob()` | 변경 없음 |

**새로 추가되는 메서드:**
- `getMimeType()`, `getExtension()`, `getBlobArgs()`
- `checkWebPSupport()`
- `downloadConverted()` — 변환 모드 전용 다운로드
- `updateDownloadLabel()` — 다운로드 버튼 라벨 동적 변경
- `updateQualityControlState()` — PNG 시 슬라이더 비활성화
