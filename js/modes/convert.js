/**
 * convert.js — 변환 모드 (ConvertApp)
 *
 * AppBase를 상속하며 renderMode()에서 원본 이미지를 그대로 표시한다.
 * 포맷/품질 변경 후 다운로드 시 실제 변환이 이뤄진다.
 */

import { AppBase } from '../core/app-base.js';

export class ConvertApp extends AppBase {
    constructor() {
        super();
        this.appMode = 'convert';
    }

    // ---------------------------------------------------------------
    // renderMode() — 변환 모드 캔버스 렌더링 (원본 이미지 미리보기)
    // ---------------------------------------------------------------

    renderMode() {
        const cur = this.currentImage;
        if (!cur) {
            const dims = this.getCanvasDimensions();
            this.canvas.width  = dims.width;
            this.canvas.height = dims.height;
            this.canvas.style.aspectRatio = `${dims.width} / ${dims.height}`;
            this.ctx.clearRect(0, 0, dims.width, dims.height);
            this.drawPlaceholder();
            return;
        }

        const img = cur.image;
        // 최대 2000px 미리보기 (성능 제한)
        const MAX_PREVIEW = 2000;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > MAX_PREVIEW || h > MAX_PREVIEW) {
            if (w >= h) { h = Math.round(MAX_PREVIEW * h / w); w = MAX_PREVIEW; }
            else        { w = Math.round(MAX_PREVIEW * w / h); h = MAX_PREVIEW; }
        }

        this.canvas.width  = w;
        this.canvas.height = h;
        this.canvas.style.aspectRatio = `${w} / ${h}`;
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.ctx.drawImage(img, 0, 0, w, h);

        this.updatePreviewContainerSize();
    }

    // ---------------------------------------------------------------
    // 변환 모드 초기화 — syncFormatUI 호출
    // ---------------------------------------------------------------

    setupModeEventListeners() {
        this.syncFormatUI();
    }

    // ---------------------------------------------------------------
    // Convert 전용 유틸 — AppBase에서 이동
    // ---------------------------------------------------------------

    getMimeType() { return { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[this.outputFormat]; }
    getExtension() { return { png: '.png', jpeg: '.jpg', webp: '.webp' }[this.outputFormat]; }
    getBlobArgs() { return [this.getMimeType(), this.outputFormat === 'png' ? undefined : this.outputQuality / 100]; }

    checkWebPSupport() {
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        this.supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        if (!this.supportsWebP && this.formatButtons) {
            const webpBtn = this.formatButtons.querySelector('.format-btn[data-format="webp"]');
            if (webpBtn) webpBtn.disabled = true;
        }
    }

    syncFormatUI() {
        [this.formatButtons, this.mobileFormatButtons].forEach(c => {
            if (!c) return; c.querySelectorAll('.format-btn').forEach(b => b.classList.toggle('active', b.dataset.format === this.outputFormat));
        });
        [this.qualitySlider, this.mobileQualitySlider].forEach(el => { if (el) el.value = this.outputQuality; });
        [this.qualityValue, this.mobileQualityValue].forEach(el => { if (el) el.textContent = this.outputQuality + '%'; });
        this.updateQualityControlState();
    }

    updateQualityControlState() {
        const disabled = this.outputFormat === 'png';
        [this.qualityControl, this.mobileQualityControl].forEach(el => { if (el) el.classList.toggle('disabled', disabled); });
        [this.qualitySlider, this.mobileQualitySlider].forEach(el => { if (el) el.disabled = disabled; });
    }
}
