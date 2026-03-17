/**
 * exif-mode.js — EXIF 프레임 모드 (ExifApp)
 *
 * AppBase를 상속하며 renderMode()에서 EXIF 오버레이가 합성된 프레임을 렌더링한다.
 * EXIF 오버레이 드로잉 함수는 overlays/exif-overlays.js에서 import한다.
 */

import { AppBase } from '../core/app-base.js';
import { resolveExifTextColor, resolveExifBarColor } from '../utils/exif-utils.js';
import {
    drawFilmStripOverlay,
    drawMinimalOverlay,
    drawMagazineOverlay,
    drawSignatureOverlay,
    drawLetterboxOverlay,
    drawPolaroidOverlay,
    drawLeicaOverlay,
    drawFujistyleOverlay,
    drawFujirecipeOverlay,
    drawGlassOverlay,
    drawLeicaluxOverlay,
    drawInstaxOverlay,
    drawFilmstockOverlay,
    drawShotonOverlay,
    drawEditorialOverlay,
    drawHudOverlay,
    drawMinimalbarOverlay,
    drawCardgridOverlay,
} from '../overlays/exif-overlays.js';

export class ExifApp extends AppBase {
    constructor() {
        super();
        this.appMode = 'exif';
    }

    // EXIF 모드는 프레임 없음
    getFrameWidth() { return 0; }

    // ---------------------------------------------------------------
    // renderMode() — EXIF 프레임 캔버스 렌더링
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

        const imgNW = cur.image.naturalWidth;
        const imgNH = cur.image.naturalHeight;
        const rawOverlay = this.getExifOverlayDimensions({ width: imgNW, height: imgNH });
        const fw = this.getFrameWidth();
        const rawCW = rawOverlay.canvasWidth;
        const rawCH = rawOverlay.canvasHeight;

        const totalW = rawCW + fw * 2;
        const totalH = rawCH + fw * 2;

        this.canvas.width  = totalW;
        this.canvas.height = totalH;
        this.canvas.style.aspectRatio = `${totalW} / ${totalH}`;
        this.ctx.clearRect(0, 0, totalW, totalH);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // 프레임 배경 드로잉
        this.drawFrameBackground(this.ctx, cur.image, totalW, totalH);

        // overlay 좌표에 frame width 오프셋 적용
        const ox = {
            ...rawOverlay,
            imageX: rawOverlay.imageX + fw,
            imageY: rawOverlay.imageY + fw,
            barX:   rawOverlay.barX + fw,
            barY:   rawOverlay.barY + fw,
        };

        this.ctx.save();

        // 이미지 드로잉
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(ox.imageX, ox.imageY, ox.imageW, ox.imageH);
        this.ctx.clip();
        this.ctx.drawImage(cur.image, ox.imageX, ox.imageY, ox.imageW, ox.imageH);
        this.ctx.restore();

        // EXIF 오버레이
        if (this.hasExifData()) {
            this._drawExifOverlay(this.ctx, totalW, totalH, ox);
        } else {
            this._drawNoExifMessage(this.ctx, totalW, totalH, ox);
        }

        this.ctx.restore();

        this.updatePreviewContainerSize();
    }

    // ---------------------------------------------------------------
    // EXIF 오버레이 스타일 디스패치
    // ---------------------------------------------------------------

    _drawExifOverlay(ctx, canvasW, canvasH, overlay) {
        const values = this.getActiveExifValues();
        if (values.length === 0) return;
        switch (this.exifStyle) {
            case 'filmstrip':  drawFilmStripOverlay(ctx, overlay, values, this); break;
            case 'minimal':    drawMinimalOverlay(ctx, overlay, values, this);   break;
            case 'magazine':   drawMagazineOverlay(ctx, overlay, values, this);  break;
            case 'signature':  drawSignatureOverlay(ctx, overlay, values, this); break;
            case 'letterbox':  drawLetterboxOverlay(ctx, overlay, values, this); break;
            case 'polaroid':   drawPolaroidOverlay(ctx, overlay, values, this);  break;
            case 'leica':      drawLeicaOverlay(ctx, overlay, values, this);     break;
            case 'fujistyle':  drawFujistyleOverlay(ctx, overlay, values, this); break;
            case 'fujirecipe': drawFujirecipeOverlay(ctx, overlay, values, this); break;
            case 'glass':      drawGlassOverlay(ctx, overlay, values, this);     break;
            case 'leicalux':   drawLeicaluxOverlay(ctx, overlay, values, this);  break;
            case 'instax':     drawInstaxOverlay(ctx, overlay, values, this);    break;
            case 'filmstock':  drawFilmstockOverlay(ctx, overlay, values, this); break;
            case 'shoton':     drawShotonOverlay(ctx, overlay, values, this);    break;
            case 'editorial':  drawEditorialOverlay(ctx, overlay, values, this); break;
            case 'hud':        drawHudOverlay(ctx, overlay, values, this);       break;
            case 'minimalbar': drawMinimalbarOverlay(ctx, overlay, values, this); break;
            case 'cardgrid':   drawCardgridOverlay(ctx, overlay, values, this);  break;
        }
    }

    _drawNoExifMessage(ctx, canvasW, canvasH, overlay) {
        const fontPx = Math.round(canvasH * 0.018);
        if (this.exifStyle === 'minimal') {
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
            const textColor = this.exifTextColor === 'black' ? '#000000' : '#FFFFFF';
            const barColor = resolveExifBarColor(textColor, this.exifBarColor);
            if (barColor !== 'transparent') {
                ctx.fillStyle = barColor;
                ctx.fillRect(overlay.barX, overlay.barY, overlay.barW, overlay.barH);
            }
            ctx.fillStyle = '#999999';
            ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('EXIF 정보가 없습니다', overlay.barX + overlay.barW / 2, overlay.barY + overlay.barH / 2);
        }
    }

    // ---------------------------------------------------------------
    // getExifOverlayDimensions() — 스타일별 캔버스 레이아웃 계산
    // ---------------------------------------------------------------

    getExifOverlayDimensions(dims) {
        const baseW = dims.width;
        const baseH = dims.height;
        switch (this.exifStyle) {
            case 'filmstrip': {
                const stripH = Math.round(baseH * 0.10);
                return { canvasWidth: baseW, canvasHeight: baseH + stripH * 2, imageX: 0, imageY: stripH, imageW: baseW, imageH: baseH, barX: 0, barY: baseH + stripH, barW: baseW, barH: stripH };
            }
            case 'minimal':
                return { canvasWidth: baseW, canvasHeight: baseH, imageX: 0, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: 0, barW: baseW, barH: baseH };
            case 'magazine': {
                const barW = Math.round(baseW * 0.09);
                return { canvasWidth: baseW + barW, canvasHeight: baseH, imageX: barW, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: 0, barW, barH: baseH };
            }
            case 'signature': {
                const barH = Math.round(baseH * 0.10);
                return { canvasWidth: baseW, canvasHeight: baseH + barH, imageX: 0, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: baseH, barW: baseW, barH };
            }
            case 'letterbox': {
                const barH = Math.round(baseH * 0.16);
                return { canvasWidth: baseW, canvasHeight: baseH + barH * 2, imageX: 0, imageY: barH, imageW: baseW, imageH: baseH, barX: 0, barY: baseH + barH, barW: baseW, barH };
            }
            case 'polaroid': {
                const topH = Math.round(baseH * 0.04);
                const botH = Math.round(baseH * 0.32);
                return { canvasWidth: baseW, canvasHeight: baseH + topH + botH, imageX: 0, imageY: topH, imageW: baseW, imageH: baseH, barX: 0, barY: baseH + topH, barW: baseW, barH: botH };
            }
            case 'leica': {
                const barH = Math.round(baseH * 0.09);
                return { canvasWidth: baseW, canvasHeight: baseH + barH, imageX: 0, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: baseH, barW: baseW, barH };
            }
            case 'fujistyle': {
                const topH = Math.round(baseH * 0.09);
                const botH = Math.round(baseH * 0.08);
                return { canvasWidth: baseW, canvasHeight: baseH + topH + botH, imageX: 0, imageY: topH, imageW: baseW, imageH: baseH, barX: 0, barY: baseH + topH, barW: baseW, barH: botH };
            }
            case 'fujirecipe': {
                const topM = Math.round(baseH * 0.004);
                const barH = Math.round(baseH * 0.10);
                return { canvasWidth: baseW, canvasHeight: baseH + topM + barH, imageX: 0, imageY: topM, imageW: baseW, imageH: baseH, barX: 0, barY: baseH + topM, barW: baseW, barH };
            }
            case 'glass':
                return { canvasWidth: baseW, canvasHeight: baseH, imageX: 0, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: 0, barW: baseW, barH: baseH };
            case 'leicalux': {
                const barH = Math.round(baseH * 0.13);
                return { canvasWidth: baseW, canvasHeight: baseH + barH, imageX: 0, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: baseH, barW: baseW, barH };
            }
            case 'instax': {
                const sideM = Math.round(baseH * 0.026);
                const botH  = Math.round(baseH * 0.26);
                return { canvasWidth: baseW + sideM * 2, canvasHeight: baseH + sideM + botH, imageX: sideM, imageY: sideM, imageW: baseW, imageH: baseH, barX: sideM, barY: baseH + sideM, barW: baseW, barH: botH };
            }
            case 'filmstock': {
                const stripH = Math.round(baseH * 0.11);
                return { canvasWidth: baseW, canvasHeight: baseH + stripH * 2, imageX: 0, imageY: stripH, imageW: baseW, imageH: baseH, barX: 0, barY: baseH + stripH, barW: baseW, barH: stripH };
            }
            case 'shoton': {
                const barH = Math.round(baseH * 0.23);
                return { canvasWidth: baseW, canvasHeight: baseH + barH, imageX: 0, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: baseH, barW: baseW, barH };
            }
            case 'editorial': {
                const margin = Math.round(baseW * 0.04);
                const barH   = Math.round(baseH * 0.23);
                return { canvasWidth: baseW + margin * 2, canvasHeight: baseH + margin + barH, imageX: margin, imageY: margin, imageW: baseW, imageH: baseH, barX: margin, barY: baseH + margin, barW: baseW, barH };
            }
            case 'hud': {
                const topH = Math.round(baseH * 0.13);
                const botH = Math.round(baseH * 0.17);
                return { canvasWidth: baseW, canvasHeight: baseH + topH + botH, imageX: 0, imageY: topH, imageW: baseW, imageH: baseH, barX: 0, barY: baseH + topH, barW: baseW, barH: botH };
            }
            case 'minimalbar': {
                const barH = Math.max(Math.round(baseH * 0.045), Math.round(baseW * 0.028));
                return { canvasWidth: baseW, canvasHeight: baseH + barH, imageX: 0, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: baseH, barW: baseW, barH };
            }
            case 'cardgrid': {
                const cv = parseInt(this.cardVariant) || 6;
                const rows = (cv <= 3) ? 1 : 2;
                const barH = Math.round(baseH * (rows === 1 ? 0.28 : 0.52));
                return { canvasWidth: baseW, canvasHeight: baseH + barH, imageX: 0, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: baseH, barW: baseW, barH };
            }
            default:
                return { canvasWidth: baseW, canvasHeight: baseH, imageX: 0, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: 0, barW: 0, barH: 0 };
        }
    }

    // ---------------------------------------------------------------
    // EXIF 모드 초기화 — syncExifUI + setupExifEventListeners 호출
    // ---------------------------------------------------------------

    setupModeEventListeners() {
        this.syncExifUI();
        this.setupExifEventListeners();
    }

    setupExifEventListeners() {
        const bindBtns = (container, mobileContainer, attr, callback) => {
            [container, mobileContainer].forEach(c => {
                if (!c) return;
                c.addEventListener('click', (e) => {
                    const btn = e.target.closest(`[data-${attr}]`);
                    if (!btn) return;
                    callback(btn.dataset[attr]);
                    this.syncExifUI();
                    this.render();
                });
            });
        };

        bindBtns(this.exifStyleButtons,     this.mobileExifStyleButtons,     'style', v => { this.exifStyle = v; });
        bindBtns(this.exifFontSizeButtons,  this.mobileExifFontSizeButtons,  'size',  v => { this.exifFontSize = v; });
        bindBtns(this.exifTextColorButtons, this.mobileExifTextColorButtons, 'color', v => { this.exifTextColor = v; });
        bindBtns(this.exifBarColorButtons,  this.mobileExifBarColorButtons,  'color', v => { this.exifBarColor = v; });
        bindBtns(this.exifSeparatorButtons, this.mobileExifSeparatorButtons, 'sep',   v => { this.exifSeparator = v; });

        [this.exifFieldToggles, this.mobileExifFieldToggles].forEach(c => {
            if (!c) return;
            c.addEventListener('change', (e) => {
                const cb = e.target;
                if (!cb.dataset.field) return;
                this.exifFields[cb.dataset.field] = cb.checked;
                this.syncExifUI();
                this.render();
            });
        });

        // 스타일별 전용 옵션 이벤트
        const bindOptBtns = (containers, attr, setter) => containers.forEach(c => {
            if (!c) return;
            c.addEventListener('click', e => {
                const btn = e.target.closest(`[data-${attr}]`);
                if (!btn) return;
                setter(btn.dataset[attr]);
                this.syncExifUI();
                this.render();
            });
        });

        bindOptBtns([this.exifFilmBrandButtons,     this.mobileExifFilmBrandButtons],     'brand',  v => { this.filmBrand = v; });
        bindOptBtns([this.exifPolaroidFontButtons,  this.mobileExifPolaroidFontButtons],  'font',   v => { this.polaroidFont = v; });
        bindOptBtns([this.exifGlassThemeButtons,    this.mobileExifGlassThemeButtons],    'theme',  v => { this.glassTheme = v; });
        bindOptBtns([this.exifGlassPositionButtons, this.mobileExifGlassPositionButtons], 'pos',    v => { this.glassPosition = v; });
        bindOptBtns([this.exifHudAccentButtons,     this.mobileExifHudAccentButtons],     'accent', v => { this.hudAccent = v; });
        bindOptBtns([this.exifCardVariantButtons,   this.mobileExifCardVariantButtons],   'cards',  v => { this.cardVariant = parseInt(v); });
    }

    // ---------------------------------------------------------------
    // EXIF 데이터 유틸 — AppBase에서 이동
    // ---------------------------------------------------------------

    hasExifData() {
        const cur = this.currentImage;
        if (!cur || !cur.exifData) return false;
        const d = cur.exifData;
        return !!(d[0x010F] || d[0x0110] || d[0xA434] || d[0x920A] || d[0x829D] || d[0x829A] || d[0x8827] || d[0x9003] || d[0x0132]);
    }

    getActiveExifValues() {
        const cur = this.currentImage;
        if (!cur || !cur.exifData) return [];
        const data = cur.exifData;
        const result = [];
        for (const [key, enabled] of Object.entries(this.exifFields)) {
            if (!enabled) continue;
            let value = null;
            switch (key) {
                case 'camera': { const make = data[0x010F] || '', model = data[0x0110] || ''; if (model) value = model.startsWith(make) ? model : (make ? `${make} ${model}` : model); break; }
                case 'lens': value = data[0xA434] || null; break;
                case 'focalLength': if (data[0x920A]) value = `${Math.round(data[0x920A].value)}mm`; break;
                case 'aperture': if (data[0x829D]) { const f = data[0x829D].value; value = `f/${f % 1 === 0 ? f.toFixed(0) : f.toFixed(1)}`; } break;
                case 'shutter': if (data[0x829A]) { const { num, den } = data[0x829A]; if (num && den) { const ss = num / den; value = ss >= 1 ? `${ss}s` : `1/${Math.round(den / num)}s`; } } break;
                case 'iso': if (data[0x8827]) value = `ISO ${data[0x8827]}`; break;
                case 'date': { const dateStr = data[0x9003] || data[0x0132]; if (dateStr) value = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1.$2.$3'); break; }
            }
            if (value) result.push({ key, value });
        }
        return result;
    }

    checkExifFieldAvailable(field) {
        const data = this.currentImage?.exifData; if (!data) return false;
        const map = { camera: [0x010F, 0x0110], lens: [0xA434], focalLength: [0x920A], aperture: [0x829D], shutter: [0x829A], iso: [0x8827], date: [0x9003, 0x0132] };
        return (map[field] || []).some(tag => !!data[tag]);
    }

    syncExifUI() {
        [this.exifStyleButtons, this.mobileExifStyleButtons].forEach(c => {
            if (!c) return; c.querySelectorAll('.exif-style-btn').forEach(b => b.classList.toggle('active', b.dataset.style === this.exifStyle));
        });
        [this.exifFieldToggles, this.mobileExifFieldToggles].forEach(c => {
            if (!c) return;
            c.querySelectorAll('input[data-field]').forEach(cb => {
                cb.checked = this.exifFields[cb.dataset.field];
                if (this.currentImage?.exifData) { const has = this.checkExifFieldAvailable(cb.dataset.field); cb.disabled = !has; cb.closest('.exif-field-toggle')?.classList.toggle('unavailable', !has); }
                else { cb.disabled = false; cb.closest('.exif-field-toggle')?.classList.remove('unavailable'); }
            });
        });
        [this.exifFontSizeButtons, this.mobileExifFontSizeButtons].forEach(c => { if (!c) return; c.querySelectorAll('.size-btn').forEach(b => b.classList.toggle('active', b.dataset.size === this.exifFontSize)); });
        [this.exifTextColorButtons, this.mobileExifTextColorButtons].forEach(c => { if (!c) return; c.querySelectorAll('.color-opt').forEach(b => b.classList.toggle('active', b.dataset.color === this.exifTextColor)); });
        [this.exifBarColorButtons, this.mobileExifBarColorButtons].forEach(c => { if (!c) return; c.querySelectorAll('.color-opt').forEach(b => b.classList.toggle('active', b.dataset.color === this.exifBarColor)); });
        [this.exifSeparatorButtons, this.mobileExifSeparatorButtons].forEach(c => { if (!c) return; c.querySelectorAll('.sep-btn').forEach(b => b.classList.toggle('active', b.dataset.sep === this.exifSeparator)); });

        // 스타일별 전용 옵션 섹션 show/hide
        const STYLE_OPT_MAP = { filmstrip: 'film', filmstock: 'film', polaroid: 'font', instax: 'font', glass: 'glass', hud: 'hud', cardgrid: 'cardgrid' };
        const activeOpt = STYLE_OPT_MAP[this.exifStyle] || null;
        ['film', 'font', 'glass', 'hud', 'cardgrid'].forEach(key => {
            const show = key === activeOpt;
            const d = document.getElementById(`exif-opts-${key}`);
            const m = document.getElementById(`mobile-exif-opts-${key}`);
            if (d) d.classList.toggle('visible', show);
            if (m) m.classList.toggle('visible', show);
        });

        // 스타일별 버튼 active 상태 동기화
        const syncOpt = (ids, attr, val) => ids.forEach(id => {
            const c = document.getElementById(id);
            if (!c) return;
            c.querySelectorAll(`[data-${attr}]`).forEach(b => b.classList.toggle('active', b.dataset[attr] == val));
        });
        syncOpt(['exif-film-brand-buttons',       'mobile-exif-film-brand-buttons'],       'brand',  this.filmBrand);
        syncOpt(['exif-polaroid-font-buttons',    'mobile-exif-polaroid-font-buttons'],    'font',   this.polaroidFont);
        syncOpt(['exif-glass-theme-buttons',      'mobile-exif-glass-theme-buttons'],      'theme',  this.glassTheme);
        syncOpt(['exif-glass-position-buttons',   'mobile-exif-glass-position-buttons'],   'pos',    this.glassPosition);
        syncOpt(['exif-hud-accent-buttons',       'mobile-exif-hud-accent-buttons'],       'accent', this.hudAccent);
        syncOpt(['exif-card-variant-buttons',     'mobile-exif-card-variant-buttons'],     'cards',  this.cardVariant);
    }
}
