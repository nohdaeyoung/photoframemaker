# Phase 1 Design: 색상 자동 추출 + 즐겨찾기

> Plan 참조: `docs/01-plan/features/phase1.plan.md`

---

## 1. 아키텍처 개요

```
PhotoFrameMaker (단일 클래스)
  │
  ├── 기존 상태
  │   ├── canvasRatio [w, h]
  │   ├── canvasSize (number)
  │   ├── frameRatio (number)
  │   ├── frameColor (string)  ← 'auto' 값 추가
  │   ├── blurIntensity (number)
  │   └── pixelateIntensity (number)
  │
  ├── 신규 상태
  │   ├── _autoDominantColor (string|null)  ← 캐시
  │   └── _saveSettingsTimer (number|null)   ← debounce ID
  │
  ├── 신규 메서드 (공용)
  │   ├── applyPreset(preset)         ← Step 1
  │   ├── getCurrentPreset()          ← 현재 상태 → 프리셋 객체
  │   └── syncAllUI()                 ← 데스크톱+모바일 UI 일괄 동기화
  │
  ├── 신규 메서드 (Auto Color)
  │   ├── extractDominantColor(img)   ← Step 2
  │   └── (drawFrameBackground 수정)
  │
  └── 신규 메서드 (즐겨찾기)
      ├── saveLastSettings()          ← Step 3
      ├── loadLastSettings()
      ├── saveFavorite(name?)         ← Step 4
      ├── removeFavorite(index)
      └── renderFavoritesUI()
```

---

## 2. 데이터 구조

### 2.1 Preset 객체

```javascript
// 모든 프리셋/즐겨찾기/마지막설정이 공유하는 구조
const PresetSchema = {
    name: '',                  // 즐겨찾기 이름 (선택)
    canvasRatio: [1, 1],       // [w, h]
    frameRatio: 5,             // 0~25 (%)
    frameColor: '#FFFFFF',     // hex | 'blur' | 'gradient' | 'pixelate' | 'mirror' | 'auto'
    blurIntensity: 50,         // 0~100
    pixelateIntensity: 50      // 0~100
};
```

### 2.2 localStorage 스키마

```javascript
// 키: 'pfm-last-settings'
// 값: JSON.stringify(PresetSchema)  — name 필드 생략
{
    "canvasRatio": [1, 1],
    "frameRatio": 5,
    "frameColor": "#FFFFFF",
    "blurIntensity": 50,
    "pixelateIntensity": 50
}

// 키: 'pfm-favorites'
// 값: JSON.stringify(PresetSchema[])  — 최대 5개
[
    { "name": "미니멀 화이트", "canvasRatio": [1,1], "frameRatio": 5, "frameColor": "#FFFFFF", "blurIntensity": 50, "pixelateIntensity": 50 },
    { "name": "다크 시네마", "canvasRatio": [3,2], "frameRatio": 8, "frameColor": "#000000", "blurIntensity": 50, "pixelateIntensity": 50 }
]
```

---

## 3. Step 1: applyPreset() 상세 설계

### 3.1 메서드 시그니처

```javascript
applyPreset(preset, options = {}) {
    // 1. 상태 업데이트
    if (preset.canvasRatio) this.canvasRatio = [...preset.canvasRatio];
    if (preset.frameRatio !== undefined) this.frameRatio = preset.frameRatio;
    if (preset.frameColor !== undefined) this.frameColor = preset.frameColor;
    if (preset.blurIntensity !== undefined) this.blurIntensity = preset.blurIntensity;
    if (preset.pixelateIntensity !== undefined) this.pixelateIntensity = preset.pixelateIntensity;

    // 2. auto 색상 캐시 무효화
    if (this.frameColor === 'auto') this._autoDominantColor = null;

    // 3. UI 동기화
    this.syncAllUI();

    // 4. 렌더링
    if (!options.skipRender) {
        this.resetAllOffsets();
        this.updateCanvasSize();
        this.render();
        this.updateInfo();
    }
}
```

### 3.2 syncAllUI() 메서드

```javascript
syncAllUI() {
    // 비율 버튼 active
    const ratioStr = this.canvasRatio[0] + ':' + this.canvasRatio[1];
    this.ratioButtons.querySelectorAll('.ratio-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.ratio === ratioStr));
    this.mobileRatioButtons.querySelectorAll('.ratio-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.ratio === ratioStr));

    // 프레임 비율
    this.frameRatioSlider.value = this.frameRatio;
    this.frameRatioInput.value = this.frameRatio;
    this.mobileFrameRatioSlider.value = this.frameRatio;
    this.mobileFrameRatioInput.value = this.frameRatio;
    this.syncFramePxInputs();

    // 프레임 색상
    const color = this.frameColor;
    this.colorPresets.querySelectorAll('.color-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.color === color));
    this.mobileColorPresets.querySelectorAll('.color-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.color === color));
    if (!this.isStyleFrame && color !== 'auto') {
        this.customColorInput.value = color;
        this.mobileCustomColorInput.value = color;
    }

    // 블러/픽셀 슬라이더
    this.blurSlider.value = this.blurIntensity;
    this.mobileBlurSlider.value = this.blurIntensity;
    this.blurValueLabel.textContent = this.blurIntensity;
    this.mobileBlurValueLabel.textContent = this.blurIntensity;
    this.pixelateSlider.value = this.pixelateIntensity;
    this.mobilePixelateSlider.value = this.pixelateIntensity;
    this.pixelateValueLabel.textContent = this.pixelateIntensity;
    this.mobilePixelateValueLabel.textContent = this.pixelateIntensity;

    this.updateStyleControlsVisibility();
}
```

### 3.3 getCurrentPreset()

```javascript
getCurrentPreset() {
    return {
        canvasRatio: [...this.canvasRatio],
        frameRatio: this.frameRatio,
        frameColor: this.frameColor,
        blurIntensity: this.blurIntensity,
        pixelateIntensity: this.pixelateIntensity
    };
}
```

---

## 4. Step 2: Auto Color 상세 설계

### 4.1 extractDominantColor(img)

```javascript
extractDominantColor(img) {
    // _colorSampleCanvas는 drawGradientBackground()와 공유
    if (!this._colorSampleCanvas) {
        this._colorSampleCanvas = document.createElement('canvas');
    }
    const sc = this._colorSampleCanvas;
    const sz = 32;
    sc.width = sz;
    sc.height = sz;
    const sctx = sc.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, sz, sz);
    const data = sctx.getImageData(0, 0, sz, sz).data;

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
    }
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    // HSL 보정: 프레임으로 적합하도록 채도 낮추고 밝기 올림
    const [h, s, l] = this.rgbToHsl(r, g, b);
    const adjS = Math.min(s, 0.35);    // 채도 상한 35%
    const adjL = Math.max(l, 0.75);    // 밝기 하한 75%
    const [ar, ag, ab] = this.hslToRgb(h, adjS, adjL);

    return '#' + [ar, ag, ab].map(v => v.toString(16).padStart(2, '0')).join('');
}
```

### 4.2 HSL 변환 유틸리티

```javascript
rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return [h, s, l];
}

hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
```

### 4.3 drawFrameBackground() 수정

```javascript
drawFrameBackground(ctx, img, canvasW, canvasH) {
    if (this.frameColor === 'auto' && img) {
        if (!this._autoDominantColor) {
            this._autoDominantColor = this.extractDominantColor(img);
        }
        ctx.fillStyle = this._autoDominantColor;
        ctx.fillRect(0, 0, canvasW, canvasH);
    } else if (this.frameColor === 'auto') {
        // 이미지 없는 경우 fallback
        ctx.fillStyle = '#E8E8E8';
        ctx.fillRect(0, 0, canvasW, canvasH);
    } else if (this.isStyleFrame && img) {
        // ... 기존 코드 유지 (blur, gradient, pixelate, mirror)
    } else {
        ctx.fillStyle = this.isStyleFrame ? '#222' : this.frameColor;
        ctx.fillRect(0, 0, canvasW, canvasH);
    }
}
```

### 4.4 캐시 무효화 지점

| 위치 | 코드 |
|------|------|
| `selectImage()` | `this._autoDominantColor = null;` |
| `onImagesChanged()` | `this._autoDominantColor = null;` |
| `loadImages()` 완료 시 | `this._autoDominantColor = null;` |

### 4.5 HTML — Auto 스와치 (데스크톱 + 모바일)

스타일 프레임 그룹 맨 앞에 추가:

```html
<button class="color-swatch color-swatch-style color-swatch-auto"
        data-color="auto" title="자동 색상" aria-label="자동 색상 프레임">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" opacity="0.3"/>
    </svg>
</button>
```

### 4.6 CSS

```css
.color-swatch-auto {
    background: conic-gradient(
        from 0deg,
        #ff6b6b, #ffd93d, #6bcb77, #4d96ff, #9b59b6, #ff6b6b
    );
}
```

---

## 5. Step 3: 마지막 설정 저장/복원

### 5.1 saveLastSettings()

```javascript
saveLastSettings() {
    try {
        localStorage.setItem('pfm-last-settings', JSON.stringify(this.getCurrentPreset()));
    } catch (e) { /* 시크릿 모드 등 무시 */ }
}
```

### 5.2 loadLastSettings()

```javascript
loadLastSettings() {
    try {
        const saved = localStorage.getItem('pfm-last-settings');
        if (saved) this.applyPreset(JSON.parse(saved), { skipRender: true });
    } catch (e) { /* 파싱 오류 무시 */ }
}
```

### 5.3 호출 타이밍

```
저장: render() 끝에 debounce 500ms
  clearTimeout(this._saveSettingsTimer);
  this._saveSettingsTimer = setTimeout(() => this.saveLastSettings(), 500);

복원: init()에서 loadLastSettings() 호출
  → setupEventListeners() 이후, updateCanvasSize() 이전
```

---

## 6. Step 4: 즐겨찾기 UI

### 6.1 데스크톱 HTML (사이드바, 다운로드 버튼 위)

```html
<section class="control-section favorites-section" id="favorites-section">
    <h2>즐겨찾기
        <button class="favorite-save-btn" id="favorite-save-btn" title="현재 설정 저장">+</button>
    </h2>
    <div class="favorites-list" id="favorites-list"></div>
    <div class="favorites-empty" id="favorites-empty">저장된 즐겨찾기가 없습니다</div>
</section>
```

### 6.2 모바일 HTML (frame 탭 하단)

```html
<div class="mobile-favorites-section" id="mobile-favorites-section">
    <div class="mobile-favorites-header">
        <span>즐겨찾기</span>
        <button class="favorite-save-btn" id="mobile-favorite-save-btn">+</button>
    </div>
    <div class="favorites-list" id="mobile-favorites-list"></div>
</div>
```

### 6.3 renderFavoritesUI()

즐겨찾기 목록을 DOM API로 안전하게 렌더링:

```javascript
renderFavoritesUI() {
    const favorites = this.getFavorites();
    const buildList = (container) => {
        container.textContent = '';  // 안전한 초기화
        favorites.forEach((fav, i) => {
            const item = document.createElement('div');
            item.className = 'favorite-item';
            item.dataset.index = i;

            const preview = document.createElement('div');
            preview.className = 'favorite-preview';
            if (fav.frameColor === 'auto') {
                preview.style.background = 'conic-gradient(from 0deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#9b59b6,#ff6b6b)';
            } else if (fav.frameColor.startsWith('#')) {
                preview.style.background = fav.frameColor;
            }
            preview.style.aspectRatio = fav.canvasRatio[0] + '/' + fav.canvasRatio[1];
            const inner = document.createElement('div');
            inner.className = 'favorite-preview-inner';
            preview.appendChild(inner);

            const name = document.createElement('span');
            name.className = 'favorite-name';
            name.textContent = fav.name || (fav.canvasRatio[0] + ':' + fav.canvasRatio[1] + ' ' + fav.frameRatio + '%');

            const removeBtn = document.createElement('button');
            removeBtn.className = 'favorite-remove';
            removeBtn.dataset.index = i;
            removeBtn.textContent = '\u00d7';
            removeBtn.title = '삭제';

            item.append(preview, name, removeBtn);
            container.appendChild(item);
        });
    };
    buildList(this.favoritesList);
    buildList(this.mobileFavoritesList);

    this.favoritesEmpty.style.display = favorites.length === 0 ? '' : 'none';
    const full = favorites.length >= 5;
    this.favoriteSaveBtn.disabled = full;
    this.mobileFavoriteSaveBtn.disabled = full;
}
```

### 6.4 이벤트 (이벤트 위임)

```javascript
// 저장
this.favoriteSaveBtn.addEventListener('click', () => this.saveFavorite());
this.mobileFavoriteSaveBtn.addEventListener('click', () => this.saveFavorite());

// 목록 클릭 (이벤트 위임)
const handleFavClick = (e) => {
    const removeBtn = e.target.closest('.favorite-remove');
    if (removeBtn) { this.removeFavorite(parseInt(removeBtn.dataset.index)); return; }
    const item = e.target.closest('.favorite-item');
    if (item) { this.applyPreset(this.getFavorites()[parseInt(item.dataset.index)]); }
};
this.favoritesList.addEventListener('click', handleFavClick);
this.mobileFavoritesList.addEventListener('click', handleFavClick);
```

### 6.5 CSS

```css
.favorites-section h2 { display: flex; justify-content: space-between; align-items: center; }
.favorite-save-btn {
    background: none; border: 1px solid var(--border); border-radius: var(--radius);
    padding: 2px 8px; cursor: pointer; color: var(--text-secondary); font-size: 1rem;
}
.favorite-save-btn:hover { border-color: var(--accent); color: var(--accent); }
.favorite-save-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.favorites-list { display: flex; flex-direction: column; gap: 6px; }
.favorite-item {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--radius);
    cursor: pointer; transition: border-color 0.2s;
}
.favorite-item:hover { border-color: var(--accent); }
.favorite-preview {
    width: 28px; min-width: 28px; max-height: 28px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.favorite-preview-inner { width: 60%; height: 60%; background: var(--surface); border-radius: 2px; }
.favorite-name { flex: 1; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.favorite-remove {
    background: none; border: none; color: var(--text-secondary);
    cursor: pointer; font-size: 1.1rem; padding: 0 4px; opacity: 0; transition: opacity 0.2s;
}
.favorite-item:hover .favorite-remove { opacity: 1; }
.favorites-empty { font-size: 0.75rem; color: var(--text-secondary); text-align: center; padding: 8px 0; }
```

---

## 7. 구현 순서

```
Step 1: applyPreset() + getCurrentPreset() + syncAllUI()
  │     파일: app.js만
  │
  ├──→ Step 2: extractDominantColor() + auto 프레임
  │     파일: app.js, index.html, style.css
  │
  └──→ Step 3: saveLastSettings() + loadLastSettings()
        파일: app.js
        │
        └──→ Step 4: 즐겨찾기 UI + CRUD
              파일: app.js, index.html, style.css

Step 5: 빌드 + 배포
```

---

## 8. 엣지 케이스

| 케이스 | 처리 |
|--------|------|
| 이미지 없이 auto 선택 | fallback '#E8E8E8' |
| localStorage 비활성화 | try-catch 무시 |
| JSON 파싱 실패 | catch → 기본값 |
| 즐겨찾기 5개 초과 | 버튼 disabled + return |
| preset에 일부 필드만 존재 | undefined 체크 → 해당 필드만 적용 |

---

## 9. 테스트 체크리스트

### Auto Color
- [ ] 이미지 업로드 → auto → 이미지 색상 기반 프레임
- [ ] 다중 이미지 selectImage → auto 색상 변경
- [ ] 이미지 없이 auto → fallback 색상
- [ ] 데스크톱/모바일 auto 스와치 동기화

### 마지막 설정
- [ ] 설정 변경 → 새로고침 → 복원 확인
- [ ] frameColor='auto' 복원
- [ ] localStorage 비활성화 → 오류 없음

### 즐겨찾기
- [ ] 저장 → 목록 표시
- [ ] 클릭 → 설정 적용
- [ ] 삭제 → 목록 제거
- [ ] 5개 → 저장 버튼 비활성화
- [ ] 데스크톱/모바일 목록 동기화
- [ ] 새로고침 후 유지
