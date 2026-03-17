# Phase 3 Design: EXIF 프레임 (EXIF 기반 자동 스타일링)

> Plan 문서: `docs/01-plan/features/phase3.plan.md`
> UI 위치: `app-mode-toggle` 버튼 그룹에 네 번째 모드 "EXIF 프레임" 추가

---

## 1. 앱 모드 확장

### 1.1 기존 구조

```
현재 app-mode-toggle:
  [프레임] [분할] [변환]

appMode = 'frame' | 'split' | 'convert'
```

### 1.2 변경 후 구조

```
변경 후 app-mode-toggle:
  [프레임] [분할] [변환] [EXIF 프레임]

appMode = 'frame' | 'split' | 'convert' | 'exif'
```

### 1.3 EXIF 프레임 모드 동작

EXIF 모드 진입 시:
- 프레임 색상/비율 컨트롤 숨김 (convert 모드와 동일 패턴)
- 캔버스 비율/크기 컨트롤은 표시 (frame 모드와 공유)
- EXIF 전용 패널 표시 (스타일 선택 + 필드 토글 + 텍스트 설정)
- 프리뷰 모드 토글 표시 (기본/피드/프로필 프리뷰 가능)
- 이미지에 EXIF 데이터 없으면 안내 메시지 표시
- 다운로드 버튼 라벨: "EXIF 프레임 다운로드"

---

## 2. 상태 설계

```javascript
// constructor에 추가

// EXIF 프레임 모드
this.exifStyle = 'filmstrip';     // 'filmstrip' | 'minimal' | 'magazine' | 'signature'
this.exifFields = {
    camera: false,       // 카메라 (Make + Model)
    lens: false,         // 렌즈 (LensModel)
    focalLength: true,   // 초점거리
    aperture: true,      // 조리개
    shutter: true,       // 셔터속도
    iso: true,           // ISO
    date: false          // 촬영일
};
this.exifFontSize = 'medium';     // 'small' | 'medium' | 'large'
this.exifTextColor = 'white';     // 'white' | 'black' | 'auto'
this.exifSeparator = '│';         // '│' | '·' | '-' | ' '
this.exifBarColor = 'black';      // 'black' | 'white' | 'auto' | 'transparent'
```

---

## 3. 상수

```javascript
// 클래스 외부 또는 상단에 정의
const BRAND_THEMES = {
    'sony':     { primary: '#000000', accent: '#F58220', name: 'SONY' },
    'fujifilm': { primary: '#1A1A1A', accent: '#86B817', name: 'FUJIFILM' },
    'canon':    { primary: '#FFFFFF', accent: '#CC0000', name: 'Canon' },
    'nikon':    { primary: '#000000', accent: '#FFD700', name: 'Nikon' },
    'apple':    { primary: '#1D1D1F', accent: '#FFFFFF', name: 'Apple' },
    'leica':    { primary: '#FFFFFF', accent: '#E2001A', name: 'Leica' },
    'ricoh':    { primary: '#1A1A1A', accent: '#DA291C', name: 'RICOH' },
};

const EXIF_FIELD_MAP = {
    camera:      { tags: [0x010F, 0x0110], label: '카메라' },
    lens:        { tags: [0xA434],         label: '렌즈' },
    focalLength: { tags: [0x920A],         label: '초점거리' },
    aperture:    { tags: [0x829D],         label: '조리개' },
    shutter:     { tags: [0x829A],         label: '셔터속도' },
    iso:         { tags: [0x8827],         label: 'ISO' },
    date:        { tags: [0x9003, 0x0132], label: '촬영일' },
};

const EXIF_FONT_SIZES = {
    small:  0.015,   // 캔버스 높이의 1.5%
    medium: 0.020,   // 캔버스 높이의 2.0%
    large:  0.028,   // 캔버스 높이의 2.8%
};
```

---

## 4. 헬퍼 메서드

```javascript
// 현재 이미지의 EXIF 데이터에서 활성 필드만 추출, 포맷팅하여 반환
getActiveExifValues() {
    const cur = this.currentImage;
    if (!cur || !cur.exifData) return [];

    const data = cur.exifData;
    const result = [];

    for (const [key, enabled] of Object.entries(this.exifFields)) {
        if (!enabled) continue;

        let value = null;
        switch (key) {
            case 'camera': {
                const make = data[0x010F] || '';
                const model = data[0x0110] || '';
                if (model) {
                    value = model.startsWith(make) ? model : (make ? `${make} ${model}` : model);
                }
                break;
            }
            case 'lens':
                value = data[0xA434] || null;
                break;
            case 'focalLength':
                if (data[0x920A]) value = `${Math.round(data[0x920A].value)}mm`;
                break;
            case 'aperture':
                if (data[0x829D]) {
                    const f = data[0x829D].value;
                    value = `f/${f % 1 === 0 ? f.toFixed(0) : f.toFixed(1)}`;
                }
                break;
            case 'shutter':
                if (data[0x829A]) {
                    const { num, den } = data[0x829A];
                    if (num && den) {
                        const ss = num / den;
                        value = ss >= 1 ? `${ss}s` : `1/${Math.round(den / num)}s`;
                    }
                }
                break;
            case 'iso':
                if (data[0x8827]) value = `ISO ${data[0x8827]}`;
                break;
            case 'date':
                const dateStr = data[0x9003] || data[0x0132];
                if (dateStr) value = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1.$2.$3');
                break;
        }
        if (value) result.push({ key, value });
    }
    return result;
}

// EXIF Make 태그에서 카메라 브랜드 감지
detectBrand(exifData) {
    if (!exifData) return null;
    const make = (exifData[0x010F] || '').toLowerCase();
    for (const [key, theme] of Object.entries(BRAND_THEMES)) {
        if (make.includes(key)) return { key, ...theme };
    }
    return null;
}

// EXIF 텍스트의 폰트 크기 (px) 계산
getExifFontPx(canvasHeight) {
    return Math.round(canvasHeight * (EXIF_FONT_SIZES[this.exifFontSize] || 0.02));
}

// EXIF 텍스트 색상 결정 (auto 시 이미지 하단 밝기 분석)
resolveExifTextColor(ctx, canvasW, canvasH) {
    if (this.exifTextColor !== 'auto') return this.exifTextColor === 'white' ? '#FFFFFF' : '#000000';
    // 하단 10% 영역의 평균 밝기 분석
    const sampleH = Math.max(1, Math.round(canvasH * 0.1));
    const imageData = ctx.getImageData(0, canvasH - sampleH, canvasW, sampleH);
    let brightness = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        brightness += (imageData.data[i] * 0.299 + imageData.data[i+1] * 0.587 + imageData.data[i+2] * 0.114);
    }
    brightness /= (imageData.data.length / 4);
    return brightness > 128 ? '#000000' : '#FFFFFF';
}

// EXIF 바 배경색 결정
resolveExifBarColor(textColor) {
    if (this.exifBarColor === 'transparent') return 'transparent';
    if (this.exifBarColor === 'auto') return textColor === '#FFFFFF' ? '#000000' : '#FFFFFF';
    return this.exifBarColor === 'white' ? '#FFFFFF' : '#000000';
}

// 현재 이미지에 EXIF 데이터가 있는지 확인
hasExifData() {
    return !!(this.currentImage && this.currentImage.exifData);
}
```

---

## 5. 렌더링 파이프라인

### 5.1 render() 분기

```javascript
// render() 메서드 상단에 추가 (convert 분기 바로 아래)
render(keepProfileCache) {
    if (!keepProfileCache) this.invalidateProfileCache();

    if (this.appMode === 'convert') {
        this.renderConvertPreview();
        this.updateMockupImages();
        return;
    }

    // EXIF 모드
    if (this.appMode === 'exif') {
        this.renderExifFrame();
        this.updateMockupImages();
        clearTimeout(this._saveSettingsTimer);
        this._saveSettingsTimer = setTimeout(() => this.saveLastSettings(), 500);
        return;
    }

    // ... 기존 frame/split 렌더링 ...
}
```

### 5.2 renderExifFrame()

```javascript
renderExifFrame() {
    const cur = this.currentImage;
    const dims = this.getCanvasDimensions();

    if (!cur) {
        this.canvas.width = dims.width;
        this.canvas.height = dims.height;
        this.canvas.style.aspectRatio = `${dims.width} / ${dims.height}`;
        this.ctx.clearRect(0, 0, dims.width, dims.height);
        this.drawPlaceholder();
        return;
    }

    // 스타일별 캔버스 크기 계산 (오버레이 영역 포함)
    const overlay = this.getExifOverlayDimensions(dims);
    const totalW = overlay.canvasWidth;
    const totalH = overlay.canvasHeight;

    this.canvas.width = totalW;
    this.canvas.height = totalH;
    this.canvas.style.aspectRatio = `${totalW} / ${totalH}`;

    this.ctx.clearRect(0, 0, totalW, totalH);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // 1. 이미지 영역 배경 + 이미지 그리기
    //    frame 모드의 drawFrameBackground() 를 imageArea 영역에 그린다
    //    (EXIF 모드에서는 프레임 = 0, 이미지가 imageArea 전체를 채움)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(overlay.imageX, overlay.imageY, overlay.imageW, overlay.imageH);
    this.ctx.clip();

    // 이미지 그리기 (cover 방식)
    const imgRatio = cur.image.naturalWidth / cur.image.naturalHeight;
    const areaRatio = overlay.imageW / overlay.imageH;
    let drawW, drawH;
    if (imgRatio > areaRatio) {
        drawH = overlay.imageH;
        drawW = drawH * imgRatio;
    } else {
        drawW = overlay.imageW;
        drawH = drawW / imgRatio;
    }
    const imgX = overlay.imageX + (overlay.imageW - drawW) / 2 + cur.imageOffset.x;
    const imgY = overlay.imageY + (overlay.imageH - drawH) / 2 + cur.imageOffset.y;
    this.ctx.drawImage(cur.image, imgX, imgY, drawW, drawH);
    this.ctx.restore();

    // 2. EXIF 오버레이 그리기
    if (this.hasExifData()) {
        this.drawExifOverlay(this.ctx, totalW, totalH, overlay);
    } else {
        // EXIF 없음 안내 (오버레이 영역에 메시지)
        this.drawNoExifMessage(this.ctx, totalW, totalH, overlay);
    }

    this.updatePreviewContainerSize();
}
```

### 5.3 getExifOverlayDimensions()

```javascript
// 스타일별로 캔버스 크기와 이미지/오버레이 영역 계산
getExifOverlayDimensions(dims) {
    const baseW = dims.width;
    const baseH = dims.height;

    switch (this.exifStyle) {
        case 'filmstrip': {
            // 하단 바: 캔버스 높이의 7%
            const barH = Math.round(baseH * 0.07);
            return {
                canvasWidth: baseW,
                canvasHeight: baseH + barH,
                imageX: 0, imageY: 0,
                imageW: baseW, imageH: baseH,
                barX: 0, barY: baseH,
                barW: baseW, barH: barH
            };
        }
        case 'minimal': {
            // 오버레이이므로 캔버스 크기 변경 없음
            return {
                canvasWidth: baseW,
                canvasHeight: baseH,
                imageX: 0, imageY: 0,
                imageW: baseW, imageH: baseH,
                barX: 0, barY: 0,
                barW: baseW, barH: baseH
            };
        }
        case 'magazine': {
            // 좌측 세로 바: 캔버스 너비의 9%
            const barW = Math.round(baseW * 0.09);
            return {
                canvasWidth: baseW + barW,
                canvasHeight: baseH,
                imageX: barW, imageY: 0,
                imageW: baseW, imageH: baseH,
                barX: 0, barY: 0,
                barW: barW, barH: baseH
            };
        }
        case 'signature': {
            // 하단 바: 캔버스 높이의 10% (로고 + 세팅 2줄)
            const barH = Math.round(baseH * 0.10);
            return {
                canvasWidth: baseW,
                canvasHeight: baseH + barH,
                imageX: 0, imageY: 0,
                imageW: baseW, imageH: baseH,
                barX: 0, barY: baseH,
                barW: baseW, barH: barH
            };
        }
        default:
            return {
                canvasWidth: baseW, canvasHeight: baseH,
                imageX: 0, imageY: 0,
                imageW: baseW, imageH: baseH,
                barX: 0, barY: 0, barW: 0, barH: 0
            };
    }
}
```

### 5.4 drawExifOverlay()

```javascript
drawExifOverlay(ctx, canvasW, canvasH, overlay) {
    const values = this.getActiveExifValues();
    if (values.length === 0) return;

    switch (this.exifStyle) {
        case 'filmstrip': this.drawFilmStripOverlay(ctx, overlay, values); break;
        case 'minimal':   this.drawMinimalOverlay(ctx, overlay, values); break;
        case 'magazine':  this.drawMagazineOverlay(ctx, overlay, values); break;
        case 'signature': this.drawSignatureOverlay(ctx, overlay, values); break;
    }
}
```

### 5.5 drawFilmStripOverlay()

```javascript
drawFilmStripOverlay(ctx, overlay, values) {
    const { barX, barY, barW, barH } = overlay;
    const fontPx = this.getExifFontPx(overlay.canvasHeight);

    // 텍스트/바 색상 결정
    const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
    const barColor = this.resolveExifBarColor(textColor);

    // 바 배경
    if (barColor !== 'transparent') {
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, barW, barH);
    }

    // 브랜드 테마 적용 (Signature 전용이지만 Film Strip에서도 accent 라인 가능)
    const brand = this.detectBrand(this.currentImage.exifData);

    // 텍스트
    ctx.fillStyle = textColor;
    ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = values.map(v => v.value).join(` ${this.exifSeparator} `);
    const maxWidth = barW * 0.9;
    ctx.fillText(text, barX + barW / 2, barY + barH / 2, maxWidth);
}
```

### 5.6 drawMinimalOverlay()

```javascript
drawMinimalOverlay(ctx, overlay, values) {
    const fontPx = this.getExifFontPx(overlay.canvasHeight);
    const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
    const padding = fontPx * 1.5;

    ctx.fillStyle = textColor;
    ctx.font = `300 ${fontPx}px "DM Sans", sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    // 텍스트 그림자
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = fontPx * 0.4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    // 값들을 한 줄로 연결
    const text = values.map(v => v.value).join(` ${this.exifSeparator} `);
    const x = overlay.imageX + overlay.imageW - padding;
    const y = overlay.imageY + overlay.imageH - padding;
    ctx.fillText(text, x, y);

    // 그림자 초기화
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
}
```

### 5.7 drawMagazineOverlay()

```javascript
drawMagazineOverlay(ctx, overlay, values) {
    const { barX, barY, barW, barH } = overlay;
    const fontPx = this.getExifFontPx(overlay.canvasHeight);

    const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
    const barBgColor = this.resolveExifBarColor(textColor);

    // 세로 바 배경
    if (barBgColor !== 'transparent') {
        ctx.fillStyle = barBgColor;
        ctx.fillRect(barX, barY, barW, barH);
    }

    // 브랜드 감지
    const brand = this.detectBrand(this.currentImage.exifData);

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = barX + barW / 2;
    const lineHeight = fontPx * 1.8;
    const startY = barY + barH * 0.15;

    // 카메라 브랜드명 (크게, accent 색상)
    if (brand) {
        ctx.font = `600 ${Math.round(fontPx * 1.3)}px "DM Sans", sans-serif`;
        ctx.fillStyle = brand.accent;

        // 세로 쓰기: 한 글자씩
        const brandChars = brand.name.split('');
        brandChars.forEach((char, i) => {
            ctx.fillText(char, centerX, startY + i * fontPx * 1.4);
        });
        ctx.fillStyle = textColor;
    }

    // EXIF 값들 (세로 나열)
    ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
    const valStartY = brand
        ? startY + brand.name.length * fontPx * 1.4 + lineHeight
        : startY;

    values.forEach((v, i) => {
        ctx.fillText(v.value, centerX, valStartY + i * lineHeight, barW * 0.85);
    });
}
```

### 5.8 drawSignatureOverlay()

```javascript
drawSignatureOverlay(ctx, overlay, values) {
    const { barX, barY, barW, barH } = overlay;
    const fontPx = this.getExifFontPx(overlay.canvasHeight);
    const brand = this.detectBrand(this.currentImage.exifData);

    const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
    const barBgColor = this.resolveExifBarColor(textColor);

    // 바 배경
    if (barBgColor !== 'transparent') {
        ctx.fillStyle = barBgColor;
        ctx.fillRect(barX, barY, barW, barH);
    }

    // 1줄: 브랜드명 (accent 색상, 큰 폰트)
    const brandY = barY + barH * 0.35;
    if (brand) {
        ctx.font = `700 ${Math.round(fontPx * 1.6)}px "Playfair Display", serif`;
        ctx.fillStyle = brand.accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(brand.name, barX + barW / 2, brandY);
    } else {
        // 브랜드 미감지 시 카메라명 표시
        const cameraVal = values.find(v => v.key === 'camera');
        if (cameraVal) {
            ctx.font = `700 ${Math.round(fontPx * 1.4)}px "DM Sans", sans-serif`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cameraVal.value, barX + barW / 2, brandY);
        }
    }

    // 2줄: 촬영 세팅 (작은 폰트)
    const settingsValues = values.filter(v => v.key !== 'camera');
    if (settingsValues.length > 0) {
        const settingsY = barY + barH * 0.70;
        ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const text = settingsValues.map(v => v.value).join(` ${this.exifSeparator} `);
        ctx.fillText(text, barX + barW / 2, settingsY, barW * 0.9);
    }
}
```

### 5.9 drawNoExifMessage()

```javascript
drawNoExifMessage(ctx, canvasW, canvasH, overlay) {
    const fontPx = Math.round(canvasH * 0.018);

    if (this.exifStyle === 'minimal') {
        // minimal은 이미지 위에 메시지
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText('EXIF 정보 없음', canvasW - fontPx * 1.5, canvasH - fontPx * 1.5);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    } else {
        // 바 영역에 메시지
        const barColor = this.resolveExifBarColor(
            this.exifTextColor === 'auto' ? '#FFFFFF' : (this.exifTextColor === 'white' ? '#FFFFFF' : '#000000')
        );
        if (barColor !== 'transparent') {
            ctx.fillStyle = barColor;
            ctx.fillRect(overlay.barX, overlay.barY, overlay.barW, overlay.barH);
        }
        ctx.fillStyle = this.exifTextColor === 'black' ? '#000000' : '#999999';
        ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EXIF 정보가 없습니다', overlay.barX + overlay.barW / 2, overlay.barY + overlay.barH / 2);
    }
}
```

---

## 6. switchAppMode() 확장

```javascript
switchAppMode(mode) {
    if (mode === this.appMode) return;
    this.appMode = mode;

    const isSplit = mode === 'split';
    const isConvert = mode === 'convert';
    const isExif = mode === 'exif';
    const isFrame = mode === 'frame';

    // Toggle mode buttons
    this.appModeToggle.querySelectorAll('.app-mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === mode)
    );

    // Toggle split section
    this.splitSection.style.display = isSplit ? '' : 'none';
    this.mobileSplitSection.style.display = isSplit ? '' : 'none';

    // Toggle convert section
    this.convertSection.style.display = isConvert ? '' : 'none';
    this.mobileTabBtnConvert.style.display = isConvert ? '' : 'none';
    if (!isConvert) this.tabPanelConvert.classList.remove('active');

    // Toggle EXIF section
    this.exifPanel.style.display = isExif ? '' : 'none';
    this.mobileTabBtnExif.style.display = isExif ? '' : 'none';
    if (!isExif) this.tabPanelExif.classList.remove('active');

    // 비율 컨트롤: split/convert에서 숨김, exif/frame에서 표시
    if (isSplit) {
        this.savedRatioBeforeSplit = [...this.canvasRatio];
        this.canvasRatio = this.splitDirection === 'horizontal' ? [3, 4] : [4, 3];
        this.ratioSection.style.display = 'none';
        this.mobileRatioHeader.style.display = 'none';
        this.mobileRatioButtons.style.display = 'none';
    } else if (isConvert) {
        this.ratioSection.style.display = 'none';
        this.mobileRatioHeader.style.display = 'none';
        this.mobileRatioButtons.style.display = 'none';
    } else {
        // frame, exif: 비율 컨트롤 표시
        if (this.savedRatioBeforeSplit) {
            this.canvasRatio = this.savedRatioBeforeSplit;
            this.savedRatioBeforeSplit = null;
        }
        this.ratioSection.style.display = '';
        this.mobileRatioHeader.style.display = '';
        this.mobileRatioButtons.style.display = '';
        const ratioStr = this.canvasRatio.join(':');
        this.ratioButtons.querySelectorAll('.ratio-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.ratio === ratioStr));
        this.mobileRatioButtons.querySelectorAll('.ratio-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.ratio === ratioStr));
    }

    this.resetAllOffsets();
    this.updateCanvasSize();

    // 프레임 컨트롤: split/convert/exif에서 숨김
    const hideFrame = isSplit || isConvert || isExif;
    this.frameRatioSection.style.display = hideFrame ? 'none' : '';
    this.frameColorSection.style.display = hideFrame ? 'none' : '';
    this.mobileTabBtnFrame.style.display = hideFrame ? 'none' : '';
    this.mobileTabBtnColor.style.display = hideFrame ? 'none' : '';
    if (this.favoritesSection) this.favoritesSection.style.display = (isConvert || isExif) ? 'none' : '';
    if (hideFrame) {
        this.tabPanelFrame.classList.remove('active');
        this.tabPanelColor.classList.remove('active');
    }

    // 프리뷰 모드: split/convert에서 숨김, exif/frame에서 표시
    const hidePreview = isSplit || isConvert;
    this.previewModeToggle.style.display = hidePreview ? 'none' : '';
    if (hidePreview && this.previewMode !== 'default') {
        this.previewMode = 'default';
        this.previewModeToggle.querySelectorAll('.preview-mode-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.mode === 'default')
        );
        this.updatePreviewMode();
    }

    this.splitCurrentPanel = 0;
    this.updateDownloadLabel();
    if (isConvert) this.syncFormatUI();
    if (isExif) this.syncExifUI();

    this.render();
}
```

---

## 7. HTML 구조

### 7.1 app-mode-toggle (index.html)

```html
<!-- 기존 3버튼 뒤에 추가 -->
<div class="app-mode-toggle" id="app-mode-toggle">
    <button class="app-mode-btn active" data-mode="frame">프레임</button>
    <button class="app-mode-btn" data-mode="split">분할</button>
    <button class="app-mode-btn" data-mode="convert">변환</button>
    <button class="app-mode-btn" data-mode="exif">EXIF 프레임</button>
</div>
```

### 7.2 데스크톱 사이드바 — EXIF 패널

```html
<!-- convert-section 바로 아래에 추가 -->
<section class="control-section exif-panel" id="exif-panel" style="display:none">
    <h3 class="section-title">EXIF 스타일</h3>

    <!-- 스타일 선택 -->
    <div class="exif-style-selector" id="exif-style-buttons">
        <button class="exif-style-btn active" data-style="filmstrip">
            <span class="style-icon">▬</span>
            <span class="style-label">Film Strip</span>
        </button>
        <button class="exif-style-btn" data-style="minimal">
            <span class="style-icon">◢</span>
            <span class="style-label">Minimal</span>
        </button>
        <button class="exif-style-btn" data-style="magazine">
            <span class="style-icon">▐</span>
            <span class="style-label">Magazine</span>
        </button>
        <button class="exif-style-btn" data-style="signature">
            <span class="style-icon">✦</span>
            <span class="style-label">Signature</span>
        </button>
    </div>

    <!-- 표시 필드 토글 -->
    <h3 class="section-title" style="margin-top:1rem">표시 항목</h3>
    <div class="exif-field-toggles" id="exif-field-toggles">
        <label class="exif-field-toggle">
            <input type="checkbox" data-field="camera"> 카메라
        </label>
        <label class="exif-field-toggle">
            <input type="checkbox" data-field="lens"> 렌즈
        </label>
        <label class="exif-field-toggle">
            <input type="checkbox" data-field="focalLength" checked> 초점거리
        </label>
        <label class="exif-field-toggle">
            <input type="checkbox" data-field="aperture" checked> 조리개
        </label>
        <label class="exif-field-toggle">
            <input type="checkbox" data-field="shutter" checked> 셔터속도
        </label>
        <label class="exif-field-toggle">
            <input type="checkbox" data-field="iso" checked> ISO
        </label>
        <label class="exif-field-toggle">
            <input type="checkbox" data-field="date"> 촬영일
        </label>
    </div>

    <!-- 텍스트 스타일 -->
    <h3 class="section-title" style="margin-top:1rem">텍스트 설정</h3>
    <div class="exif-text-controls">
        <div class="control-row">
            <span class="control-label">글자 크기</span>
            <div class="exif-size-buttons" id="exif-font-size-buttons">
                <button class="size-btn" data-size="small">S</button>
                <button class="size-btn active" data-size="medium">M</button>
                <button class="size-btn" data-size="large">L</button>
            </div>
        </div>
        <div class="control-row">
            <span class="control-label">글자 색상</span>
            <div class="exif-color-buttons" id="exif-text-color-buttons">
                <button class="color-opt active" data-color="white" style="background:#000;color:#fff">밝게</button>
                <button class="color-opt" data-color="black" style="background:#fff;color:#000">어둡게</button>
                <button class="color-opt" data-color="auto">자동</button>
            </div>
        </div>
        <div class="control-row">
            <span class="control-label">배경 색상</span>
            <div class="exif-bar-color-buttons" id="exif-bar-color-buttons">
                <button class="color-opt active" data-color="black" style="background:#000;color:#fff">검정</button>
                <button class="color-opt" data-color="white" style="background:#fff;color:#000">흰색</button>
                <button class="color-opt" data-color="auto">자동</button>
                <button class="color-opt" data-color="transparent">없음</button>
            </div>
        </div>
        <div class="control-row">
            <span class="control-label">구분자</span>
            <div class="exif-separator-buttons" id="exif-separator-buttons">
                <button class="sep-btn active" data-sep="│">│</button>
                <button class="sep-btn" data-sep="·">·</button>
                <button class="sep-btn" data-sep="-">-</button>
                <button class="sep-btn" data-sep=" ">공백</button>
            </div>
        </div>
    </div>
</section>
```

### 7.3 모바일 탭 — EXIF 탭

```html
<!-- 모바일 탭 바에 추가 -->
<button class="tab-btn" data-tab="exif" id="mobile-tab-btn-exif" style="display:none">EXIF</button>

<!-- 모바일 탭 패널에 추가 (tab-panel-convert 아래) -->
<div class="tab-panel" id="tab-panel-exif" data-tab="exif">
    <div class="tab-panel-content">
        <div class="tab-panel-header">EXIF 스타일</div>

        <!-- 스타일 선택 (데스크톱과 동일 구조, id만 mobile- 접두) -->
        <div class="exif-style-selector" id="mobile-exif-style-buttons">
            <button class="exif-style-btn active" data-style="filmstrip">
                <span class="style-icon">▬</span>
                <span class="style-label">Film Strip</span>
            </button>
            <button class="exif-style-btn" data-style="minimal">
                <span class="style-icon">◢</span>
                <span class="style-label">Minimal</span>
            </button>
            <button class="exif-style-btn" data-style="magazine">
                <span class="style-icon">▐</span>
                <span class="style-label">Magazine</span>
            </button>
            <button class="exif-style-btn" data-style="signature">
                <span class="style-icon">✦</span>
                <span class="style-label">Signature</span>
            </button>
        </div>

        <!-- 필드 토글 -->
        <div class="tab-panel-sub-label" style="margin-top:0.75rem">표시 항목</div>
        <div class="exif-field-toggles" id="mobile-exif-field-toggles">
            <label class="exif-field-toggle">
                <input type="checkbox" data-field="camera"> 카메라
            </label>
            <label class="exif-field-toggle">
                <input type="checkbox" data-field="lens"> 렌즈
            </label>
            <label class="exif-field-toggle">
                <input type="checkbox" data-field="focalLength" checked> 초점거리
            </label>
            <label class="exif-field-toggle">
                <input type="checkbox" data-field="aperture" checked> 조리개
            </label>
            <label class="exif-field-toggle">
                <input type="checkbox" data-field="shutter" checked> 셔터속도
            </label>
            <label class="exif-field-toggle">
                <input type="checkbox" data-field="iso" checked> ISO
            </label>
            <label class="exif-field-toggle">
                <input type="checkbox" data-field="date"> 촬영일
            </label>
        </div>

        <!-- 텍스트 설정 -->
        <div class="tab-panel-sub-label" style="margin-top:0.75rem">텍스트 설정</div>
        <div class="exif-text-controls">
            <div class="control-row">
                <span class="control-label">크기</span>
                <div class="exif-size-buttons" id="mobile-exif-font-size-buttons">
                    <button class="size-btn" data-size="small">S</button>
                    <button class="size-btn active" data-size="medium">M</button>
                    <button class="size-btn" data-size="large">L</button>
                </div>
            </div>
            <div class="control-row">
                <span class="control-label">글자색</span>
                <div class="exif-color-buttons" id="mobile-exif-text-color-buttons">
                    <button class="color-opt active" data-color="white" style="background:#000;color:#fff">밝게</button>
                    <button class="color-opt" data-color="black" style="background:#fff;color:#000">어둡게</button>
                    <button class="color-opt" data-color="auto">자동</button>
                </div>
            </div>
            <div class="control-row">
                <span class="control-label">배경색</span>
                <div class="exif-bar-color-buttons" id="mobile-exif-bar-color-buttons">
                    <button class="color-opt active" data-color="black" style="background:#000;color:#fff">검정</button>
                    <button class="color-opt" data-color="white" style="background:#fff;color:#000">흰색</button>
                    <button class="color-opt" data-color="auto">자동</button>
                    <button class="color-opt" data-color="transparent">없음</button>
                </div>
            </div>
            <div class="control-row">
                <span class="control-label">구분자</span>
                <div class="exif-separator-buttons" id="mobile-exif-separator-buttons">
                    <button class="sep-btn active" data-sep="│">│</button>
                    <button class="sep-btn" data-sep="·">·</button>
                    <button class="sep-btn" data-sep="-">-</button>
                    <button class="sep-btn" data-sep=" ">공백</button>
                </div>
            </div>
        </div>
    </div>
</div>
```

---

## 8. bindElements() 확장

```javascript
// EXIF 프레임 모드
this.exifPanel = document.getElementById('exif-panel');
this.exifStyleButtons = document.getElementById('exif-style-buttons');
this.exifFieldToggles = document.getElementById('exif-field-toggles');
this.exifFontSizeButtons = document.getElementById('exif-font-size-buttons');
this.exifTextColorButtons = document.getElementById('exif-text-color-buttons');
this.exifBarColorButtons = document.getElementById('exif-bar-color-buttons');
this.exifSeparatorButtons = document.getElementById('exif-separator-buttons');
this.mobileExifStyleButtons = document.getElementById('mobile-exif-style-buttons');
this.mobileExifFieldToggles = document.getElementById('mobile-exif-field-toggles');
this.mobileExifFontSizeButtons = document.getElementById('mobile-exif-font-size-buttons');
this.mobileExifTextColorButtons = document.getElementById('mobile-exif-text-color-buttons');
this.mobileExifBarColorButtons = document.getElementById('mobile-exif-bar-color-buttons');
this.mobileExifSeparatorButtons = document.getElementById('mobile-exif-separator-buttons');
this.mobileTabBtnExif = document.getElementById('mobile-tab-btn-exif');
this.tabPanelExif = document.getElementById('tab-panel-exif');
```

---

## 9. 이벤트 바인딩

```javascript
setupExifEventListeners() {
    // 스타일 선택
    const bindStyleBtns = (container) => {
        container.querySelectorAll('.exif-style-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.exifStyle = btn.dataset.style;
                this.syncExifUI();
                this.render();
            });
        });
    };
    bindStyleBtns(this.exifStyleButtons);
    bindStyleBtns(this.mobileExifStyleButtons);

    // 필드 토글
    const bindFieldToggles = (container) => {
        container.querySelectorAll('input[data-field]').forEach(cb => {
            cb.addEventListener('change', () => {
                this.exifFields[cb.dataset.field] = cb.checked;
                this.syncExifUI();
                this.render();
            });
        });
    };
    bindFieldToggles(this.exifFieldToggles);
    bindFieldToggles(this.mobileExifFieldToggles);

    // 폰트 크기
    const bindSizeBtns = (container) => {
        container.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.exifFontSize = btn.dataset.size;
                this.syncExifUI();
                this.render();
            });
        });
    };
    bindSizeBtns(this.exifFontSizeButtons);
    bindSizeBtns(this.mobileExifFontSizeButtons);

    // 텍스트 색상
    const bindTextColorBtns = (container) => {
        container.querySelectorAll('.color-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                this.exifTextColor = btn.dataset.color;
                this.syncExifUI();
                this.render();
            });
        });
    };
    bindTextColorBtns(this.exifTextColorButtons);
    bindTextColorBtns(this.mobileExifTextColorButtons);

    // 바 배경색
    const bindBarColorBtns = (container) => {
        container.querySelectorAll('.color-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                this.exifBarColor = btn.dataset.color;
                this.syncExifUI();
                this.render();
            });
        });
    };
    bindBarColorBtns(this.exifBarColorButtons);
    bindBarColorBtns(this.mobileExifBarColorButtons);

    // 구분자
    const bindSepBtns = (container) => {
        container.querySelectorAll('.sep-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.exifSeparator = btn.dataset.sep;
                this.syncExifUI();
                this.render();
            });
        });
    };
    bindSepBtns(this.exifSeparatorButtons);
    bindSepBtns(this.mobileExifSeparatorButtons);
}
```

---

## 10. UI 동기화 — syncExifUI()

```javascript
syncExifUI() {
    // 스타일 버튼
    [this.exifStyleButtons, this.mobileExifStyleButtons].forEach(container => {
        container.querySelectorAll('.exif-style-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.style === this.exifStyle));
    });

    // 필드 토글
    [this.exifFieldToggles, this.mobileExifFieldToggles].forEach(container => {
        container.querySelectorAll('input[data-field]').forEach(cb => {
            cb.checked = this.exifFields[cb.dataset.field];
            // EXIF 데이터에 해당 값이 없으면 비활성화
            if (this.currentImage && this.currentImage.exifData) {
                const hasValue = this.checkExifFieldAvailable(cb.dataset.field);
                cb.disabled = !hasValue;
                cb.closest('.exif-field-toggle').classList.toggle('unavailable', !hasValue);
            }
        });
    });

    // 폰트 크기
    [this.exifFontSizeButtons, this.mobileExifFontSizeButtons].forEach(container => {
        container.querySelectorAll('.size-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.size === this.exifFontSize));
    });

    // 텍스트 색상
    [this.exifTextColorButtons, this.mobileExifTextColorButtons].forEach(container => {
        container.querySelectorAll('.color-opt').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.color === this.exifTextColor));
    });

    // 바 배경색
    [this.exifBarColorButtons, this.mobileExifBarColorButtons].forEach(container => {
        container.querySelectorAll('.color-opt').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.color === this.exifBarColor));
    });

    // 구분자
    [this.exifSeparatorButtons, this.mobileExifSeparatorButtons].forEach(container => {
        container.querySelectorAll('.sep-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.sep === this.exifSeparator));
    });
}

// 특정 EXIF 필드에 값이 있는지 확인
checkExifFieldAvailable(field) {
    const data = this.currentImage?.exifData;
    if (!data) return false;
    switch (field) {
        case 'camera': return !!(data[0x010F] || data[0x0110]);
        case 'lens': return !!data[0xA434];
        case 'focalLength': return !!data[0x920A];
        case 'aperture': return !!data[0x829D];
        case 'shutter': return !!data[0x829A];
        case 'iso': return !!data[0x8827];
        case 'date': return !!(data[0x9003] || data[0x0132]);
        default: return false;
    }
}
```

---

## 11. getCurrentPreset() / applyPreset() 확장

```javascript
getCurrentPreset() {
    return {
        canvasRatio: [...this.canvasRatio],
        frameRatio: this.frameRatio,
        frameColor: this.frameColor,
        blurIntensity: this.blurIntensity,
        pixelateIntensity: this.pixelateIntensity,
        // EXIF 프레임 설정
        exifStyle: this.exifStyle,
        exifFields: { ...this.exifFields },
        exifFontSize: this.exifFontSize,
        exifTextColor: this.exifTextColor,
        exifSeparator: this.exifSeparator,
        exifBarColor: this.exifBarColor,
    };
}

applyPreset(preset, options = {}) {
    // ... 기존 코드 ...

    // EXIF 프레임 설정
    if (preset.exifStyle !== undefined) this.exifStyle = preset.exifStyle;
    if (preset.exifFields !== undefined) this.exifFields = { ...preset.exifFields };
    if (preset.exifFontSize !== undefined) this.exifFontSize = preset.exifFontSize;
    if (preset.exifTextColor !== undefined) this.exifTextColor = preset.exifTextColor;
    if (preset.exifSeparator !== undefined) this.exifSeparator = preset.exifSeparator;
    if (preset.exifBarColor !== undefined) this.exifBarColor = preset.exifBarColor;

    // ... 기존 코드 (syncAllUI, render 등) ...
}
```

---

## 12. 다운로드 확장

```javascript
// downloadSingle() 수정 — EXIF 모드 분기 추가
async downloadSingle() {
    const cur = this.currentImage;
    if (!cur) return;

    if (this.appMode === 'exif') {
        await this.downloadExifFrame();
        return;
    }

    // ... 기존 frame 모드 다운로드 ...
}

async downloadExifFrame() {
    const cur = this.currentImage;
    if (!cur) return;

    const dims = this.getCanvasDimensions();
    const overlay = this.getExifOverlayDimensions(dims);

    const offscreen = document.createElement('canvas');
    offscreen.width = overlay.canvasWidth;
    offscreen.height = overlay.canvasHeight;
    const ctx = offscreen.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 이미지 그리기 (renderExifFrame과 동일 로직)
    ctx.save();
    ctx.beginPath();
    ctx.rect(overlay.imageX, overlay.imageY, overlay.imageW, overlay.imageH);
    ctx.clip();
    const imgRatio = cur.image.naturalWidth / cur.image.naturalHeight;
    const areaRatio = overlay.imageW / overlay.imageH;
    let drawW, drawH;
    if (imgRatio > areaRatio) {
        drawH = overlay.imageH;
        drawW = drawH * imgRatio;
    } else {
        drawW = overlay.imageW;
        drawH = drawW / imgRatio;
    }
    const imgX = overlay.imageX + (overlay.imageW - drawW) / 2 + cur.imageOffset.x;
    const imgY = overlay.imageY + (overlay.imageH - drawH) / 2 + cur.imageOffset.y;
    ctx.drawImage(cur.image, imgX, imgY, drawW, drawH);
    ctx.restore();

    // EXIF 오버레이
    if (this.hasExifData()) {
        this.drawExifOverlay(ctx, overlay.canvasWidth, overlay.canvasHeight, overlay);
    }

    const blob = await new Promise((resolve, reject) => {
        offscreen.toBlob(b => {
            offscreen.width = 0;
            offscreen.height = 0;
            b ? resolve(b) : reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
    });

    const baseName = cur.fileName ? cur.fileName.replace(/\.[^.]+$/, '') : 'photo';
    const fileName = `${baseName}_exif.png`;
    await this.triggerDownload(blob, fileName);
}
```

---

## 13. updateDownloadLabel() 확장

```javascript
updateDownloadLabel() {
    let label = '다운로드';
    if (this.appMode === 'exif') {
        label = 'EXIF 프레임 다운로드';
    } else if (this.appMode === 'convert') {
        // ... 기존 convert 라벨 ...
    } else if (this.images.length > 1) {
        label = `다운로드 (${this.images.length}장)`;
    }
    this.downloadBtn.textContent = label;
    this.mobileDownloadBtn.textContent = label;
}
```

---

## 14. EXIF 데이터 저장 (이미지 로드 시)

```javascript
// 기존 이미지 로드 코드에서 EXIF 파싱 결과를 이미지 객체에 저장
// addImage() 또는 loadImage() 내부에서:
const exifData = this.readExifFromBuffer(buffer);
// images 배열에 저장
this.images.push({
    image: img,
    fileName: file.name,
    exifData: exifData,   // ← 추가 (기존에는 displayExif()만 호출)
    imageOffset: { x: 0, y: 0 },
    // ...
});
```

> 참고: 현재 코드는 `displayExif(exifData)`로 사이드바에만 표시. EXIF 모드에서 렌더링에도 사용하려면 `this.currentImage.exifData`로 접근 가능해야 함.

---

## 15. CSS 설계

```css
/* EXIF 스타일 선택 버튼 */
.exif-style-selector {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
}
.exif-style-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.25rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    cursor: pointer;
    transition: all 0.15s;
    font-size: 0.7rem;
    color: var(--text-secondary);
}
.exif-style-btn:hover {
    border-color: var(--text-secondary);
}
.exif-style-btn.active {
    border-color: var(--accent);
    background: var(--accent-bg, rgba(0, 122, 255, 0.08));
    color: var(--accent);
}
.exif-style-btn .style-icon {
    font-size: 1.2rem;
}

/* 필드 토글 */
.exif-field-toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
}
.exif-field-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    color: var(--text);
    cursor: pointer;
}
.exif-field-toggle.unavailable {
    opacity: 0.35;
    pointer-events: none;
}
.exif-field-toggle input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: var(--accent);
}

/* 텍스트 컨트롤 */
.exif-text-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.exif-text-controls .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.exif-text-controls .control-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    flex-shrink: 0;
}

/* 크기/색상/구분자 버튼 공통 */
.exif-size-buttons, .exif-color-buttons, .exif-bar-color-buttons, .exif-separator-buttons {
    display: flex;
    gap: 0.25rem;
}
.size-btn, .color-opt, .sep-btn {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.15s;
    color: var(--text);
}
.size-btn:hover, .color-opt:hover, .sep-btn:hover {
    border-color: var(--text-secondary);
}
.size-btn.active, .color-opt.active, .sep-btn.active {
    border-color: var(--accent);
    background: var(--accent-bg, rgba(0, 122, 255, 0.08));
    color: var(--accent);
}
```

---

## 16. 구현 순서 (Design 기준)

```
Step 1: 상태 변수 + 상수 + 헬퍼 메서드 (app.js)
  ├── constructor에 EXIF 상태 추가 (exifStyle, exifFields, ...)
  ├── BRAND_THEMES, EXIF_FIELD_MAP, EXIF_FONT_SIZES 상수
  ├── getActiveExifValues(), detectBrand()
  ├── getExifFontPx(), resolveExifTextColor(), resolveExifBarColor()
  ├── hasExifData(), checkExifFieldAvailable()
  └── EXIF 데이터를 images 배열에 저장하도록 수정

Step 2: HTML — app-mode-btn + EXIF 패널 (index.html)
  ├── "EXIF 프레임" 버튼 추가
  ├── 데스크톱 사이드바 exif-panel 섹션
  ├── 모바일 탭 버튼 + tab-panel-exif
  └── 모바일 필드 토글 + 텍스트 설정

Step 3: CSS 스타일 (style.css)
  ├── .exif-style-selector, .exif-style-btn
  ├── .exif-field-toggles, .exif-field-toggle
  └── .exif-text-controls, .size-btn, .color-opt, .sep-btn

Step 4: bindElements() 확장 (app.js)
  └── EXIF 관련 DOM 참조 추가

Step 5: switchAppMode() 확장 (app.js)
  ├── isExif 분기 추가
  ├── EXIF 패널 표시/숨김
  ├── 프레임 컨트롤 숨김 (exif 시)
  └── 프리뷰 모드 허용 (frame과 동일)

Step 6: 렌더링 — renderExifFrame() + 4개 오버레이 (app.js)
  ├── render() 분기 추가
  ├── getExifOverlayDimensions()
  ├── renderExifFrame()
  ├── drawExifOverlay()
  ├── drawFilmStripOverlay()
  ├── drawMinimalOverlay()
  ├── drawMagazineOverlay()
  ├── drawSignatureOverlay()
  └── drawNoExifMessage()

Step 7: 이벤트 바인딩 + syncExifUI() (app.js)
  ├── setupExifEventListeners()
  ├── syncExifUI()
  └── 데스크톱 ↔ 모바일 동기화

Step 8: getCurrentPreset() / applyPreset() 확장 (app.js)
  └── EXIF 설정을 preset에 포함

Step 9: 다운로드 지원 (app.js)
  ├── downloadSingle() — EXIF 모드 분기
  ├── downloadExifFrame()
  └── updateDownloadLabel() 확장

Step 10: 통합 테스트 + 빌드
  ├── EXIF 있는 사진 / 없는 사진 테스트
  ├── 4종 스타일 프리뷰 확인
  ├── 필드 토글 / 텍스트 설정 확인
  ├── 모바일 동기화 확인
  └── npm run build
```
