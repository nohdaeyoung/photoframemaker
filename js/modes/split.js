/**
 * split.js — 분할 모드 (SplitApp)
 *
 * AppBase를 상속하며 renderMode()에서 분할 이미지 렌더링을 담당한다.
 */

import { AppBase } from '../core/app-base.js';
import { escapeHtml } from '../utils/exif-utils.js';

export class SplitApp extends AppBase {
    constructor() {
        super();
        this.appMode = 'split';

        // split 모드는 프레임 없음 — canvasRatio는 splitDirection에 따라 결정
        this.canvasRatio = [4, 3]; // 기본: 가로 분할(4:3)
    }

    // ---------------------------------------------------------------
    // renderMode() — 분할 모드 캔버스 렌더링
    // ---------------------------------------------------------------

    renderMode() {
        if (this.currentImage) {
            const img = this.currentImage.image;
            // split 모드: 이미지 자연 크기 그대로 사용
            this.canvas.width  = img.naturalWidth;
            this.canvas.height = img.naturalHeight;
            this.canvas.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
            this.ctx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
            this.drawFrameBackground(this.ctx, img, img.naturalWidth, img.naturalHeight);
            this.drawSplitImage();
        } else {
            const dims = this.getCanvasDimensions();
            this.canvas.width  = dims.width;
            this.canvas.height = dims.height;
            this.canvas.style.aspectRatio = `${dims.width} / ${dims.height}`;
            this.ctx.clearRect(0, 0, dims.width, dims.height);
            this.drawPlaceholder();
        }

        this.updatePreviewContainerSize();
    }

    // ---------------------------------------------------------------
    // Split 전용 메서드 — AppBase에서 이동
    // ---------------------------------------------------------------

    setSplitCount(count) {
        if (count === this.splitCount) return;
        this.splitCount = count; this.splitCurrentPanel = 0;
        [this.splitButtons, this.mobileSplitButtons].forEach(c => {
            if (c) c.querySelectorAll('.split-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.split) === count));
        });
        this.render(); this.updateNavArrows(); this.updateThumbnailStrip(); this.updateDownloadButton(); this.updateInfo();
    }

    setSplitDirection(direction) {
        if (direction === this.splitDirection) return;
        this.splitDirection = direction; this.splitCurrentPanel = 0;
        [this.splitDirectionButtons, this.mobileSplitDirectionButtons].forEach(c => {
            if (c) c.querySelectorAll('.split-btn').forEach(b => b.classList.toggle('active', b.dataset.direction === direction));
        });
        this.canvasRatio = direction === 'horizontal' ? [3, 4] : [4, 3];
        this.resetAllOffsets(); this.updateCanvasSize(); this.syncFramePxInputs();
        this.render(); this.updateNavArrows(); this.updateThumbnailStrip(); this.updateDownloadButton(); this.updateInfo();
    }

    getSplitStripDimensions(img) {
        if (this.splitDirection === 'vertical') return { width: img.naturalWidth, height: img.naturalHeight / this.splitCount };
        return { width: img.naturalWidth / this.splitCount, height: img.naturalHeight };
    }

    getSplitSourceRect(img, panelIndex) {
        if (this.splitDirection === 'vertical') { const stripH = img.naturalHeight / this.splitCount; return { sx: 0, sy: stripH * panelIndex, sw: img.naturalWidth, sh: stripH }; }
        const stripW = img.naturalWidth / this.splitCount; return { sx: stripW * panelIndex, sy: 0, sw: stripW, sh: img.naturalHeight };
    }

    getSplitDrawDimensions(img) {
        const photoArea = this.getPhotoArea();
        if (photoArea.width === 0 || photoArea.height === 0) return { width: 0, height: 0 };
        const strip = this.getSplitStripDimensions(img);
        const stripRatio = strip.width / strip.height; const areaRatio = photoArea.width / photoArea.height;
        let dw, dh;
        if (stripRatio > areaRatio) { dw = photoArea.width; dh = dw / stripRatio; } else { dh = photoArea.height; dw = dh * stripRatio; }
        return { width: dw, height: dh };
    }

    drawSplitImage() {
        const cur = this.currentImage;
        if (!cur) return;
        const photoArea = this.getPhotoArea();
        if (photoArea.width === 0 || photoArea.height === 0) return;
        const img = cur.image;
        const draw = this.getSplitDrawDimensions(img);
        if (draw.width === 0 || draw.height === 0) return;
        const src = this.getSplitSourceRect(img, this.splitCurrentPanel);
        const x = photoArea.x + (photoArea.width - draw.width) / 2;
        const y = photoArea.y + (photoArea.height - draw.height) / 2;
        this.ctx.save();
        this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'high';
        this.ctx.beginPath();
        this.ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
        this.ctx.clip();
        this.ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, x, y, draw.width, draw.height);
        this.ctx.restore();
    }

    async renderSplitPanelToBlob(item, dims, photoArea, panelIndex) {
        const img = item.image;
        const src = this.getSplitSourceRect(img, panelIndex);
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.round(src.sw); offscreen.height = Math.round(src.sh);
        const ctx = offscreen.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, offscreen.width, offscreen.height);
        return await new Promise((resolve, reject) => {
            offscreen.toBlob(blob => { offscreen.width = 0; offscreen.height = 0; blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')); }, 'image/jpeg', 0.95);
        });
    }

    updateSplitThumbnails() {
        const cur = this.currentImage;
        if (!cur || this.splitCount <= 1) { this.thumbnailStrip.style.display = 'none'; this.returnThumbnailStrip(); return; }
        this.thumbnailCounter.textContent = `${this.splitCurrentPanel + 1}/${this.splitCount}`;
        this.thumbnailAddBtn.style.display = 'none';
        const img = cur.image;
        this.thumbnailList.innerHTML = '';
        for (let i = 0; i < this.splitCount; i++) {
            const div = document.createElement('div');
            div.className = `thumbnail-item${i === this.splitCurrentPanel ? ' active' : ''}`; div.dataset.index = i;
            const canvas = document.createElement('canvas'); canvas.width = 130; canvas.height = 130;
            const ctx = canvas.getContext('2d');
            const src = this.getSplitSourceRect(img, i);
            const strip = this.getSplitStripDimensions(img);
            const stripAspect = strip.width / strip.height;
            let dx, dy, dw, dh;
            if (stripAspect > 1) { dw = 130; dh = dw / stripAspect; dx = 0; dy = (130 - dh) / 2; }
            else { dh = 130; dw = dh * stripAspect; dx = (130 - dw) / 2; dy = 0; }
            ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, dx, dy, dw, dh);
            div.appendChild(canvas); this.thumbnailList.appendChild(div);
        }
        const isMobile = window.innerWidth <= 900;
        if (isMobile && this.activeTab === 'photo' && this.mobileThumbnailSlot) this.mobileThumbnailSlot.appendChild(this.thumbnailStrip);
        this.thumbnailStrip.style.display = '';
    }

    updateSplitThumbnailHighlight() {
        this.thumbnailList.querySelectorAll('.thumbnail-item').forEach(item => item.classList.toggle('active', parseInt(item.dataset.index) === this.splitCurrentPanel));
        this.thumbnailCounter.textContent = `${this.splitCurrentPanel + 1}/${this.splitCount}`;
    }
}
