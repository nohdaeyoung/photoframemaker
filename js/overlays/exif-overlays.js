/**
 * exif-overlays.js — EXIF 프레임 스타일 드로잉 함수 14종 (+NoExif)
 *
 * 각 함수 시그니처: drawXxxOverlay(ctx, overlay, values, app)
 *   - ctx: CanvasRenderingContext2D
 *   - overlay: getExifOverlayDimensions() 반환값
 *   - values: getActiveExifValues() 반환값 [{key, value}, ...]
 *   - app: PhotoFrameMaker 인스턴스 (상태 접근용)
 */

import { roundRect } from '../utils/canvas.js';
import {
    detectBrand,
    getExifFontPx,
    resolveExifTextColor,
    resolveExifBarColor,
} from '../utils/exif-utils.js';

// ─── 1. Film Strip ──────────────────────────────────────────────────────────

export function drawFilmStripOverlay(ctx, overlay, values, app) {
    const fw = overlay.imageX;
    const stripH = overlay.topBarH ?? (overlay.imageY - fw);
    if (stripH <= 0) return;

    const stripX = overlay.barX;
    const stripW = overlay.barW;
    const topStripY = fw;
    const botStripY = overlay.barY;

    const _FS = { auto: ['#1c1c1c','#c8bfa8'], kodak: ['#1c1c1c','#c8bfa8'], fujifilm: ['#1A2420','#6DB38A'], ilford: ['#1A1A1A','#DCDCDC'], cinestill: ['#1E0A0A','#E8C8C0'], agfa: ['#141A10','#C8D080'] };
    const [FILM_BG, TEXT_COLOR] = _FS[app.filmBrand] || _FS.auto;

    const holeW = Math.round(stripH * 0.42);
    const holeH = Math.round(stripH * 0.62);
    const holeR = Math.round(holeW * 0.28);
    const pitch  = Math.round(stripH * 0.88);
    const holeVY = Math.round((stripH - holeH) / 2);
    const nHoles = Math.max(3, Math.floor((stripW + pitch) / pitch));
    const totalHW = (nHoles - 1) * pitch + holeW;
    const holeStartX = Math.round((stripW - totalHW) / 2);

    const rrPath = (c, x, y, w, h, r) => {
        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
    };

    const drawStrip = (destY) => {
        const oc = document.createElement('canvas');
        oc.width = stripW; oc.height = stripH;
        const oc_ctx = oc.getContext('2d');
        oc_ctx.fillStyle = FILM_BG;
        oc_ctx.fillRect(0, 0, stripW, stripH);
        oc_ctx.globalAlpha = 0.035;
        oc_ctx.fillStyle = '#ffffff';
        for (let gy = 0; gy < stripH; gy += 2) oc_ctx.fillRect(0, gy, stripW, 1);
        oc_ctx.globalAlpha = 1;
        oc_ctx.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < nHoles; i++) {
            rrPath(oc_ctx, holeStartX + i * pitch, holeVY, holeW, holeH, holeR);
            oc_ctx.fill();
        }
        oc_ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(oc, stripX, destY);
    };

    drawStrip(topStripY);
    drawStrip(botStripY);

    const fontPx  = getExifFontPx(overlay.imageH, app.exifFontSize);
    const annotPx = Math.max(8, Math.round(stripH * 0.30));
    const pad     = Math.round(holeW * 0.55);
    const midTopY = topStripY + stripH / 2;
    const midBotY = botStripY + stripH / 2;

    ctx.save();
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `400 ${annotPx}px "Courier New", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u25C6 1A', stripX + stripW - pad, midTopY);
    ctx.restore();

    if (values.length > 0) {
        ctx.save();
        ctx.textBaseline = 'middle';
        const camVal   = values.find(v => v.key === 'camera');
        const otherVal = values.filter(v => v.key !== 'camera');
        if (camVal && otherVal.length > 0) {
            ctx.fillStyle = TEXT_COLOR;
            ctx.font = `500 ${Math.round(fontPx * 0.80)}px "DM Sans", sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(camVal.value, stripX + pad, midBotY);
            const expText = otherVal.map(v => v.value).join('  ');
            ctx.font = `300 ${Math.round(fontPx * 0.78)}px "DM Sans", sans-serif`;
            ctx.textAlign = 'right';
            ctx.fillText(expText, stripX + stripW - pad, midBotY);
        } else {
            ctx.fillStyle = TEXT_COLOR;
            ctx.font = `300 ${Math.round(fontPx * 0.80)}px "DM Sans", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(values.map(v => v.value).join('  ·  '), stripX + stripW / 2, midBotY, stripW * 0.8);
        }
        ctx.restore();
    }
}

// ─── 2. Minimal ─────────────────────────────────────────────────────────────

export function drawMinimalOverlay(ctx, overlay, values, app) {
    const fontPx = getExifFontPx(overlay.canvasHeight, app.exifFontSize);
    const textColor = resolveExifTextColor(ctx, overlay.imageW, overlay.imageH, app.exifTextColor);
    const padding = fontPx * 1.5;

    ctx.fillStyle = textColor;
    ctx.font = `300 ${fontPx}px "DM Sans", sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = fontPx * 0.4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    const text = values.map(v => v.value).join(` ${app.exifSeparator} `);
    ctx.fillText(text, overlay.imageX + overlay.imageW - padding, overlay.imageY + overlay.imageH - padding);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
}

// ─── 3. Magazine ─────────────────────────────────────────────────────────────

export function drawMagazineOverlay(ctx, overlay, values, app) {
    const { barX, barY, barW, barH } = overlay;
    const fontPx = getExifFontPx(overlay.canvasHeight, app.exifFontSize);
    const textColor = resolveExifTextColor(ctx, overlay.imageW, overlay.imageH, app.exifTextColor);
    const barBgColor = resolveExifBarColor(textColor, app.exifBarColor);

    if (barBgColor !== 'transparent') {
        ctx.fillStyle = barBgColor;
        ctx.fillRect(barX, barY, barW, barH);
    }

    const brand = detectBrand(app.currentImage?.exifData);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = barX + barW / 2;
    const lineHeight = fontPx * 1.8;
    let curY = barY + barH * 0.12;

    if (brand) {
        ctx.font = `600 ${Math.round(fontPx * 1.3)}px "DM Sans", sans-serif`;
        ctx.fillStyle = brand.accent;
        const chars = brand.name.split('');
        chars.forEach((char) => {
            ctx.fillText(char, centerX, curY);
            curY += fontPx * 1.4;
        });
        curY += lineHeight * 0.5;
    }

    ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
    ctx.fillStyle = textColor;
    values.forEach((v) => {
        ctx.fillText(v.value, centerX, curY, barW * 0.85);
        curY += lineHeight;
    });
}

// ─── 4. Signature ────────────────────────────────────────────────────────────

export function drawSignatureOverlay(ctx, overlay, values, app) {
    const { barX, barY, barW, barH } = overlay;
    const fontPx = getExifFontPx(overlay.canvasHeight, app.exifFontSize);
    const brand = detectBrand(app.currentImage?.exifData);
    const textColor = resolveExifTextColor(ctx, overlay.imageW, overlay.imageH, app.exifTextColor);
    const barBgColor = resolveExifBarColor(textColor, app.exifBarColor);

    if (barBgColor !== 'transparent') {
        ctx.fillStyle = barBgColor;
        ctx.fillRect(barX, barY, barW, barH);
    }

    const brandY = barY + barH * 0.35;
    if (brand) {
        ctx.font = `700 ${Math.round(fontPx * 1.6)}px "Playfair Display", serif`;
        ctx.fillStyle = brand.accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(brand.name, barX + barW / 2, brandY);
    } else {
        const cameraVal = values.find(v => v.key === 'camera');
        if (cameraVal) {
            ctx.font = `700 ${Math.round(fontPx * 1.4)}px "DM Sans", sans-serif`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cameraVal.value, barX + barW / 2, brandY);
        }
    }

    const settingsValues = values.filter(v => v.key !== 'camera');
    if (settingsValues.length > 0) {
        const settingsY = barY + barH * 0.70;
        ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = settingsValues.map(v => v.value).join(` ${app.exifSeparator} `);
        ctx.fillText(text, barX + barW / 2, settingsY, barW * 0.9);
    }
}

// ─── 5. Letterbox ────────────────────────────────────────────────────────────

export function drawLetterboxOverlay(ctx, overlay, values, app) {
    const fw   = overlay.imageX;
    const barH = overlay.topBarH ?? (overlay.imageY - fw);
    if (barH <= 0) return;
    const barW = overlay.barW;
    const barX = overlay.barX;
    const topY = fw;
    const botY = overlay.barY;

    const DARK  = '#0c0c0c';
    const TEXT  = '#e0e0e0';
    const MUTED = '#787878';

    ctx.fillStyle = DARK;
    ctx.fillRect(barX, topY, barW, barH);
    ctx.fillRect(barX, botY, barW, barH);

    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(barX, botY); ctx.lineTo(barX + barW, botY);
    ctx.stroke();

    const fontPx    = getExifFontPx(overlay.imageH, app.exifFontSize);
    const pad       = Math.round(barW * 0.04);
    const camVal    = values.find(v => v.key === 'camera');
    const otherVals = values.filter(v => v.key !== 'camera');

    ctx.save();
    ctx.textBaseline = 'middle';
    if (camVal && otherVals.length > 0) {
        ctx.fillStyle = TEXT;
        ctx.font = `600 ${Math.round(fontPx * 0.92)}px "Courier New", monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(camVal.value.toUpperCase(), barX + pad, botY + barH * 0.34);
        ctx.fillStyle = MUTED;
        ctx.font = `400 ${Math.round(fontPx * 0.76)}px "Courier New", monospace`;
        ctx.fillText(otherVals.map(v => v.value).join('   '), barX + pad, botY + barH * 0.70);
    } else {
        ctx.fillStyle = TEXT;
        ctx.font = `500 ${Math.round(fontPx * 0.88)}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(values.map(v => v.value).join('  '), barX + barW / 2, botY + barH / 2, barW * 0.85);
    }
    ctx.restore();
}

// ─── 6. Polaroid ─────────────────────────────────────────────────────────────

export function drawPolaroidOverlay(ctx, overlay, values, app) {
    const fw  = overlay.imageX;
    const topH = overlay.topBarH ?? (overlay.imageY - fw);
    const { barX, barY, barW, barH } = overlay;

    const CREAM = '#f5f0e8';
    const TEXT  = '#3a3a3a';
    const MUTED = '#9a9a9a';

    if (topH > 0) {
        ctx.fillStyle = CREAM;
        ctx.fillRect(barX, fw, barW, topH);
    }
    ctx.fillStyle = CREAM;
    ctx.fillRect(barX, barY, barW, barH);

    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(barX, barY); ctx.lineTo(barX + barW, barY);
    ctx.stroke();

    const fontPx    = getExifFontPx(overlay.imageH, app.exifFontSize);
    const pFont     = app.polaroidFont === 'handwriting' ? '"Caveat", cursive' : '"DM Sans", sans-serif';
    const camVal    = values.find(v => v.key === 'camera');
    const otherVals = values.filter(v => v.key !== 'camera');

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (camVal) {
        ctx.fillStyle = TEXT;
        ctx.font = `400 ${Math.round(fontPx * 1.05)}px ${pFont}`;
        ctx.fillText('Shot on ' + camVal.value, barX + barW / 2, barY + barH * (otherVals.length > 0 ? 0.36 : 0.50), barW * 0.82);
    }
    if (otherVals.length > 0) {
        ctx.fillStyle = MUTED;
        ctx.font = `300 ${Math.round(fontPx * 0.82)}px ${pFont}`;
        ctx.fillText(otherVals.map(v => v.value).join('  ·  '), barX + barW / 2, barY + barH * (camVal ? 0.65 : 0.50), barW * 0.80);
    }
    ctx.restore();
}

// ─── 7. Leica ────────────────────────────────────────────────────────────────

export function drawLeicaOverlay(ctx, overlay, values, app) {
    const { barX, barY, barW, barH } = overlay;
    const textColor = resolveExifTextColor(ctx, overlay.imageW, overlay.imageH, app.exifTextColor);
    const isDark    = textColor === '#FFFFFF';

    const BG    = isDark ? '#111111' : '#f8f5f0';
    const MAIN  = isDark ? '#ece8e2' : '#1a1a1a';
    const MUTED = isDark ? '#7a7a7a' : '#9a9a9a';
    const RED   = '#CC1818';

    ctx.fillStyle = BG;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = RED;
    ctx.fillRect(barX, barY, barW, Math.max(1, Math.round(barH * 0.025)));

    const fontPx    = getExifFontPx(overlay.imageH, app.exifFontSize);
    const pad       = Math.round(barW * 0.04);
    const dotR      = Math.round(barH * 0.10);
    const camVal    = values.find(v => v.key === 'camera');
    const otherVals = values.filter(v => v.key !== 'camera');

    ctx.save();
    ctx.textBaseline = 'middle';

    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(barX + pad + dotR, barY + barH / 2, dotR, 0, Math.PI * 2);
    ctx.fill();

    if (camVal) {
        ctx.fillStyle = MAIN;
        ctx.font = `italic 700 ${Math.round(fontPx * 1.05)}px "Playfair Display", serif`;
        ctx.textAlign = 'right';
        ctx.fillText(camVal.value, barX + barW - pad, barY + barH * (otherVals.length > 0 ? 0.32 : 0.50), barW * 0.65);
    }
    if (otherVals.length > 0) {
        ctx.fillStyle = MUTED;
        ctx.font = `300 ${Math.round(fontPx * 0.80)}px "DM Sans", sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(otherVals.map(v => v.value).join('  ·  '), barX + barW - pad, barY + barH * (camVal ? 0.72 : 0.50), barW * 0.65);
    }
    ctx.restore();
}

// ─── 8. Fuji Style ───────────────────────────────────────────────────────────

export function drawFujistyleOverlay(ctx, overlay, values, app) {
    const fw  = overlay.imageX;
    const topH = overlay.topBarH ?? (overlay.imageY - fw);
    const { barX, barY, barW, barH } = overlay;

    const brand   = detectBrand(app.currentImage?.exifData);
    const ACCENT  = brand?.accent  || '#4a7c59';
    const PRIMARY = brand?.primary || '#1c1c1c';

    if (topH > 0) {
        ctx.fillStyle = ACCENT;
        ctx.fillRect(barX, fw, barW, topH);

        const camVal = values.find(v => v.key === 'camera');
        const topPx  = Math.max(9, Math.round(topH * 0.40));
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = `700 ${topPx}px "DM Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            (camVal ? camVal.value : 'PHOTO FRAME MAKER').toUpperCase(),
            barX + barW / 2, fw + topH / 2, barW * 0.85
        );
        ctx.restore();
    }

    ctx.fillStyle = PRIMARY;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(barX, barY, barW, Math.max(1, Math.round(barH * 0.04)));

    const otherVals = values.filter(v => v.key !== 'camera');
    if (otherVals.length > 0) {
        const botPx = Math.max(8, Math.round(barH * 0.38));
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.font = `300 ${botPx}px "DM Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(otherVals.map(v => v.value).join('  ·  '), barX + barW / 2, barY + barH / 2, barW * 0.85);
        ctx.restore();
    }
}

// ─── 9. Fuji Recipe ──────────────────────────────────────────────────────────

export function drawFujirecipeOverlay(ctx, overlay, values, app) {
    const { barX, barY, barW, barH, imageX, imageY } = overlay;
    const fw   = app.getFrameWidth();
    const topM = overlay.topBarH ?? (imageY - fw);
    const BG = '#FAFAF5', DIV = '#E0DDD5', TEXT1 = '#2C2C2A', TEXT2 = '#8A8A82', TEXT3 = '#A0A098';
    if (topM > 0) { ctx.fillStyle = BG; ctx.fillRect(barX, fw, barW, topM); }
    ctx.fillStyle = BG;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = DIV; ctx.lineWidth = Math.max(1, Math.round(overlay.imageH * 0.0006));
    ctx.beginPath(); ctx.moveTo(barX, barY); ctx.lineTo(barX + barW, barY); ctx.stroke();

    const fp  = getExifFontPx(overlay.imageH, app.exifFontSize);
    const pad = Math.round(barW * 0.044);
    const camVal  = values.find(v => v.key === 'camera');
    const lensVal = values.find(v => v.key === 'lens');
    const dateVal = values.find(v => v.key === 'date');
    ctx.save(); ctx.textBaseline = 'middle';

    const filmName = camVal ? camVal.value.toUpperCase() : 'STANDARD';
    ctx.fillStyle = TEXT1; ctx.font = `600 ${Math.round(fp * 0.95)}px "Courier New", monospace`;
    ctx.textAlign = 'left'; ctx.fillText(filmName, barX + pad, barY + barH * 0.35, barW * 0.54);

    if (dateVal) {
        const parts = dateVal.value.split('.');
        const short = parts.length >= 3 ? `'${parts[0].slice(2)} ${parts[1]} ${parts[2]}` : dateVal.value;
        ctx.fillStyle = TEXT2; ctx.font = `400 ${Math.round(fp * 0.84)}px "Courier New", monospace`;
        ctx.textAlign = 'right'; ctx.fillText(short, barX + barW - pad, barY + barH * 0.35);
    }

    const meta = [camVal?.value, lensVal?.value].filter(Boolean).join(' · ');
    if (meta) {
        ctx.fillStyle = TEXT3; ctx.font = `400 ${Math.round(fp * 0.74)}px "Courier New", monospace`;
        ctx.textAlign = 'left'; ctx.fillText(meta, barX + pad, barY + barH * 0.72, barW * 0.85);
    }
    ctx.restore();
}

// ─── 10. Glass ───────────────────────────────────────────────────────────────

export function drawGlassOverlay(ctx, overlay, values, app) {
    const { imageX, imageY, imageW, imageH } = overlay;
    const fp  = getExifFontPx(imageH, app.exifFontSize);
    const pad = Math.round(imageW * 0.042);
    const camVal  = values.find(v => v.key === 'camera');
    const lensVal = values.find(v => v.key === 'lens');
    const others  = values.filter(v => v.key !== 'camera' && v.key !== 'lens' && v.key !== 'date');
    const cardH   = Math.round(fp * 5.2);
    const ipad    = Math.round(cardH * 0.18);

    const line1 = camVal?.value || '';
    const line2 = [lensVal?.value, ...others.map(v => v.value)].filter(Boolean).join(' · ');
    ctx.font = `600 ${Math.round(fp * 1.05)}px "DM Sans", sans-serif`;
    const w1 = line1 ? ctx.measureText(line1).width : 0;
    ctx.font = `400 ${Math.round(fp * 0.80)}px "DM Sans", sans-serif`;
    const w2 = line2 ? ctx.measureText(line2).width : 0;
    const cardW   = Math.min(Math.round(Math.max(w1, w2) + ipad * 2), imageW - pad * 2);

    const glassPos = app.glassPosition || 'bottom-left';
    const cardX = (glassPos === 'bottom-right' || glassPos === 'top-right') ? imageX + imageW - pad - cardW : imageX + pad;
    const cardY = (glassPos === 'top-left'     || glassPos === 'top-right')  ? imageY + pad               : imageY + imageH - cardH - pad;
    const r       = Math.round(cardH * 0.22);

    const isDarkGlass = (app.glassTheme || 'light') === 'dark';
    const glassFill   = isDarkGlass ? '#000000' : '#FFFFFF';
    const glassAlpha  = isDarkGlass ? 0.62 : 0.20;
    const glassBorder = isDarkGlass ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.32)';
    const textSub     = isDarkGlass ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.82)';

    ctx.save();
    ctx.globalAlpha = glassAlpha; ctx.fillStyle = glassFill;
    roundRect(ctx, cardX, cardY, cardW, cardH, r); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = glassBorder;
    ctx.lineWidth = Math.max(1, Math.round(imageH * 0.0008));
    roundRect(ctx, cardX, cardY, cardW, cardH, r); ctx.stroke();

    const tx = cardX + ipad;
    ctx.shadowColor = isDarkGlass ? 'transparent' : 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = isDarkGlass ? 0 : Math.round(fp * 0.35);
    if (line1) {
        ctx.fillStyle = '#FFFFFF'; ctx.font = `600 ${Math.round(fp * 1.05)}px "DM Sans", sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(line1, tx, cardY + cardH * 0.36);
    }
    if (line2) {
        ctx.fillStyle = textSub; ctx.font = `400 ${Math.round(fp * 0.80)}px "DM Sans", sans-serif`;
        ctx.shadowBlur = isDarkGlass ? 0 : Math.round(fp * 0.18);
        ctx.fillText(line2, tx, cardY + cardH * 0.70);
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.restore();
}

// ─── 11. Leica Lux ───────────────────────────────────────────────────────────

export function drawLeicaluxOverlay(ctx, overlay, values, app) {
    const { barX, barY, barW, barH } = overlay;
    const textColor = resolveExifTextColor(ctx, overlay.imageW, overlay.imageH, app.exifTextColor);
    const isDark = textColor === '#FFFFFF';
    const BG = isDark ? '#000000' : '#FFFFFF';
    const PRIMARY = isDark ? '#FFFFFF' : '#000000';
    const SECONDARY = isDark ? '#666666' : '#888888';
    ctx.fillStyle = BG; ctx.fillRect(barX, barY, barW, barH);

    const fp  = getExifFontPx(overlay.imageH, app.exifFontSize);
    const pad = Math.round(barW * 0.044);
    const brand = detectBrand(app.currentImage?.exifData);
    const dotColor = { sony: null, nikon: '#FFD100', canon: '#BC0024', fujifilm: '#006C3E', leica: '#E60012' }[brand?.key] || '#E60012';
    const camVal   = values.find(v => v.key === 'camera');
    const apVal    = values.find(v => v.key === 'aperture');
    const focalVal = values.find(v => v.key === 'focalLength');
    const shutVal  = values.find(v => v.key === 'shutter');
    const isoVal   = values.find(v => v.key === 'iso');
    const midY = barY + barH / 2;

    ctx.save(); ctx.textBaseline = 'middle';
    const dotR = Math.round(barH * 0.085);
    if (brand?.key !== 'sony') {
        ctx.fillStyle = dotColor;
        ctx.beginPath(); ctx.arc(barX + pad + dotR, midY, dotR, 0, Math.PI * 2); ctx.fill();
    }
    const brandName = (brand ? brand.name : (camVal?.value?.split(' ')[0] || 'CAMERA')).toUpperCase();
    ctx.fillStyle = PRIMARY; ctx.font = `700 ${Math.round(fp * 0.80)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'left';
    const dotGap = brand?.key !== 'sony' ? dotR * 2 + Math.round(barW * 0.016) : 0;
    ctx.fillText(brandName, barX + pad + dotGap, midY, barW * 0.28);
    const l1 = [focalVal?.value, apVal?.value].filter(Boolean).join('  ');
    const l2 = [shutVal?.value, isoVal?.value].filter(Boolean).join('  ');
    if (l1) {
        ctx.fillStyle = PRIMARY; ctx.font = `300 ${Math.round(fp * 0.98)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(l1, barX + barW - pad, barY + barH * 0.34);
    }
    if (l2) {
        ctx.fillStyle = SECONDARY; ctx.font = `300 ${Math.round(fp * 0.76)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(l2, barX + barW - pad, barY + barH * 0.68);
    }
    ctx.restore();
}

// ─── 12. Instax ──────────────────────────────────────────────────────────────

export function drawInstaxOverlay(ctx, overlay, values, app) {
    const { barX, barY, barW, barH, imageX, imageY, imageW, imageH } = overlay;
    const fw   = app.getFrameWidth();
    const sideM = Math.max(0, barX - fw);  // barX = sideM + fw
    const CREAM = '#FAF9F6', TEXT = '#3A3A38', MUTED = '#6A6A65', DATE_C = '#8A8A82';
    const fullSideH = imageY - fw + imageH + barH;
    ctx.fillStyle = CREAM;
    ctx.fillRect(fw, fw, sideM, fullSideH);                   // 왼쪽 여백
    ctx.fillRect(imageX + imageW, fw, sideM, fullSideH);      // 오른쪽 여백
    ctx.fillRect(imageX, fw, imageW, imageY - fw);            // 위쪽 여백
    ctx.fillRect(barX, barY, barW, barH);
    const grad = ctx.createLinearGradient(0, barY, 0, barY + Math.round(barH * 0.15));
    grad.addColorStop(0, 'rgba(0,0,0,0.04)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(barX, barY, barW, Math.round(barH * 0.15));
    ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1;
    ctx.strokeRect(imageX, imageY, imageW, imageH);

    const fp   = getExifFontPx(imageH, app.exifFontSize);
    const iFont = app.polaroidFont === 'clean' ? '"DM Sans", sans-serif' : '"Caveat", cursive';
    const padL = Math.round(barW * 0.065);
    const camVal   = values.find(v => v.key === 'camera');
    const focalVal = values.find(v => v.key === 'focalLength');
    const apVal    = values.find(v => v.key === 'aperture');
    const isoVal   = values.find(v => v.key === 'iso');
    const dateVal  = values.find(v => v.key === 'date');
    ctx.save();
    if (camVal) {
        ctx.fillStyle = TEXT; ctx.font = `400 ${Math.round(fp * 1.28)}px ${iFont}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(camVal.value, barX + padL, barY + Math.round(barH * 0.14), barW * 0.65);
    }
    const exif = [focalVal?.value, apVal?.value, isoVal?.value].filter(Boolean);
    if (exif.length) {
        ctx.fillStyle = MUTED; ctx.font = `400 ${Math.round(fp * 1.02)}px ${iFont}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(exif.join('  '), barX + padL, barY + Math.round(barH * 0.44), barW * 0.65);
    }
    if (dateVal) {
        ctx.fillStyle = DATE_C; ctx.font = `400 ${Math.round(fp * 0.94)}px ${iFont}`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(dateVal.value, barX + barW - padL, barY + barH - Math.round(barH * 0.10));
    }
    ctx.restore();
}

// ─── 13. Film Stock ──────────────────────────────────────────────────────────

export function drawFilmstockOverlay(ctx, overlay, values, app) {
    const fw      = app.getFrameWidth();
    const stripH  = overlay.topBarH ?? (overlay.imageY - fw);
    if (stripH <= 0) return;
    const stripW  = overlay.barW;
    const stripX  = overlay.barX;
    const topY    = fw;
    const botY    = overlay.barY;
    const autoBrand = detectBrand(app.currentImage?.exifData);
    const schemes = {
        fujifilm:  { base: '#1A2420', text: '#6DB38A', accent: '#40A060' },
        canon:     { base: '#1E1418', text: '#E8E0D0', accent: '#BC0024' },
        nikon:     { base: '#1A1A18', text: '#C8C0A8', accent: '#FFD100' },
        kodak:     { base: '#2D2419', text: '#D4A853', accent: '#E8A020' },
        ilford:    { base: '#1A1A1A', text: '#E8E8E8', accent: '#CCCCCC' },
        cinestill: { base: '#1E1010', text: '#E8D0C8', accent: '#CC3333' },
        agfa:      { base: '#121A1A', text: '#C8D4A0', accent: '#6A8840' },
        default:   { base: '#2D2419', text: '#D4A853', accent: '#E8A020' },
    };
    const BRAND_NAMES = { kodak: 'KODAK', fujifilm: 'FUJIFILM', ilford: 'ILFORD', cinestill: 'CINESTILL', agfa: 'AGFA' };
    const brand = (app.filmBrand !== 'auto') ? { key: app.filmBrand, name: BRAND_NAMES[app.filmBrand] || app.filmBrand.toUpperCase() } : autoBrand;
    const sc = schemes[brand?.key] || schemes.default;

    ctx.fillStyle = sc.base;
    ctx.fillRect(stripX, topY, stripW, stripH);
    ctx.fillRect(stripX, botY, stripW, stripH);

    const holeW = Math.round(stripH * 0.55);
    const holeH = Math.round(stripH * 0.72);
    const holeR = Math.round(holeW * 0.38);
    const spacing = Math.round(holeW * 2.0);
    const offscreen = document.createElement('canvas');
    offscreen.width = stripW; offscreen.height = stripH;
    const oc = offscreen.getContext('2d');
    oc.fillStyle = sc.base; oc.fillRect(0, 0, stripW, stripH);
    for (let i = 0; i < 1200; i++) {
        const gx = Math.random() * stripW, gy = Math.random() * stripH;
        oc.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
        oc.fillRect(gx, gy, 1, 1);
    }
    oc.globalCompositeOperation = 'destination-out';
    for (let x = Math.round(spacing * 0.4); x < stripW; x += spacing) {
        roundRect(oc, x - holeW / 2, (stripH - holeH) / 2, holeW, holeH, holeR);
        oc.fill();
    }
    [topY, botY].forEach(sy => ctx.drawImage(offscreen, stripX, sy));
    offscreen.width = 0;

    const fp    = Math.max(8, Math.round(stripH * 0.30));
    const midT  = topY + stripH / 2;
    const midB  = botY + stripH / 2;
    const padX  = Math.round(holeW * 0.6);
    ctx.save(); ctx.textBaseline = 'middle'; ctx.fillStyle = sc.text;
    ctx.font = `900 ${fp}px "Courier New", monospace`;
    ctx.textAlign = 'left'; ctx.fillText('◀ 5', stripX + padX, midT);
    ctx.textAlign = 'center';
    const brandLabel = (brand ? brand.name.toUpperCase() : 'KODAK') + ' 400';
    ctx.font = `700 ${fp}px "Courier New", monospace`;
    ctx.globalAlpha = 0.78; ctx.fillText('▶ ' + brandLabel, stripX + stripW / 2, midT);
    ctx.globalAlpha = 1; ctx.textAlign = 'right';
    ctx.font = `900 ${fp}px "Courier New", monospace`; ctx.fillText('6 ▶', stripX + stripW - padX, midT);
    ctx.font = `400 ${fp}px "Courier New", monospace`;
    ctx.textAlign = 'center'; ctx.globalAlpha = 0.80;
    const exifLine = values.map(v => v.value).join('  ');
    ctx.fillText(exifLine, stripX + stripW / 2, midB, stripW * 0.88);
    ctx.globalAlpha = 1;
    ctx.restore();
}

// ─── 14. Shot On ─────────────────────────────────────────────────────────────

export function drawShotonOverlay(ctx, overlay, values, app) {
    const { barX, barY, barW, barH } = overlay;
    const textColor = resolveExifTextColor(ctx, overlay.imageW, overlay.imageH, app.exifTextColor);
    const isDark = textColor === '#FFFFFF';
    const BG = isDark ? '#000000' : '#FFFFFF';
    const TEXT1 = isDark ? '#F0F0F0' : '#1A1A1A';
    const TEXT2 = isDark ? '#777777' : '#888888';
    const TEXT3 = isDark ? '#555555' : '#AAAAAA';
    const DIV   = isDark ? '#222222' : '#EEEEEE';
    ctx.fillStyle = BG; ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = DIV; ctx.lineWidth = Math.max(1, Math.round(overlay.imageH * 0.0005));
    ctx.beginPath(); ctx.moveTo(barX, barY); ctx.lineTo(barX + barW, barY); ctx.stroke();

    const fp   = getExifFontPx(overlay.imageH, app.exifFontSize);
    const pad  = Math.round(barW * 0.044);
    const brand = detectBrand(app.currentImage?.exifData);
    const camVal  = values.find(v => v.key === 'camera');
    const lensVal = values.find(v => v.key === 'lens');
    const apVal   = values.find(v => v.key === 'aperture');
    const shutVal = values.find(v => v.key === 'shutter');
    const isoVal  = values.find(v => v.key === 'iso');

    const logoR = Math.round(fp * 1.6);
    const logoX = barX + pad + logoR;
    const logoY = barY + barH * 0.30;
    ctx.save();
    ctx.fillStyle = isDark ? '#2A2A2A' : '#F5F5F5';
    ctx.beginPath(); ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2); ctx.fill();
    const initial = brand ? brand.name[0].toUpperCase() : (camVal?.value?.[0] || '?');
    ctx.fillStyle = brand?.accent || TEXT1;
    ctx.font = `700 ${Math.round(fp * 0.88)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(initial, logoX, logoY);
    const textStartX = barX + pad + logoR * 2 + Math.round(barW * 0.02);
    ctx.fillStyle = TEXT1; ctx.font = `600 ${Math.round(fp * 1.06)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(camVal?.value || 'Camera', textStartX, barY + barH * 0.24, barW * 0.55);
    ctx.fillStyle = TEXT2; ctx.font = `400 ${Math.round(fp * 0.80)}px "DM Sans", sans-serif`;
    ctx.fillText(lensVal?.value || '', textStartX, barY + barH * 0.38, barW * 0.55);

    const divY = Math.round(barY + barH * 0.52);
    ctx.setLineDash([Math.round(fp * 0.4), Math.round(fp * 0.4)]);
    ctx.strokeStyle = DIV; ctx.lineWidth = Math.max(1, Math.round(barH * 0.008));
    ctx.beginPath(); ctx.moveTo(barX + pad, divY); ctx.lineTo(barX + barW - pad, divY); ctx.stroke();
    ctx.setLineDash([]);

    const cols = [
        { val: apVal?.value || '—',   label: 'APERTURE' },
        { val: shutVal?.value || '—', label: 'SHUTTER' },
        { val: isoVal?.value || '—',  label: 'ISO' },
    ];
    const colW = barW / 3;
    cols.forEach((col, i) => {
        const cx = barX + colW * i + colW / 2;
        if (i > 0) {
            ctx.strokeStyle = DIV; ctx.lineWidth = 1; ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(barX + colW * i, divY + Math.round(barH * 0.06));
            ctx.lineTo(barX + colW * i, barY + barH - Math.round(barH * 0.06));
            ctx.stroke();
        }
        ctx.fillStyle = TEXT1; ctx.font = `600 ${Math.round(fp * 1.14)}px "DM Sans", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(col.val, cx, barY + barH * 0.71);
        ctx.fillStyle = TEXT3; ctx.font = `400 ${Math.round(fp * 0.63)}px "DM Sans", sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(col.label, cx, barY + barH * 0.87);
    });
    ctx.restore();
}

// ─── 15. Editorial ───────────────────────────────────────────────────────────

export function drawEditorialOverlay(ctx, overlay, values, app) {
    const { barX, barY, barW, barH, imageX, imageY } = overlay;
    const fw   = app.getFrameWidth();
    const margin = Math.max(0, barX - fw);  // barX = margin + fw
    const BG = '#FFFFFF', RULE1 = '#1A1A1A', RULE2 = '#CCCCCC';
    const C1 = '#1A1A1A', C2 = '#555555', C3 = '#888888', C4 = '#AAAAAA';
    ctx.fillStyle = BG;
    ctx.fillRect(fw, fw, imageX - fw, overlay.imageH + margin);          // 왼쪽 여백
    ctx.fillRect(imageX + barW, fw, margin, overlay.imageH + margin);    // 오른쪽 여백
    ctx.fillRect(barX, barY, barW, barH + fw);

    const fp = getExifFontPx(overlay.imageH, app.exifFontSize);
    const camVal   = values.find(v => v.key === 'camera');
    const lensVal  = values.find(v => v.key === 'lens');
    const apVal    = values.find(v => v.key === 'aperture');
    const shutVal  = values.find(v => v.key === 'shutter');
    const isoVal   = values.find(v => v.key === 'iso');
    const focalVal = values.find(v => v.key === 'focalLength');
    const dateVal  = values.find(v => v.key === 'date');

    const ruleX = barX, ruleW = barW;
    let y = barY + Math.round(barH * 0.06);
    ctx.fillStyle = RULE1; ctx.fillRect(ruleX, y, ruleW, Math.max(2, Math.round(barH * 0.012)));
    y += Math.round(barH * 0.18);

    ctx.save(); ctx.textBaseline = 'top';
    if (camVal) {
        ctx.fillStyle = C1; ctx.font = `700 ${Math.round(fp * 1.04)}px "Playfair Display", "Noto Serif", Georgia, serif`;
        ctx.textAlign = 'left'; ctx.fillText(camVal.value, ruleX, y, ruleW * 0.9);
        y += Math.round(fp * 1.4);
    }
    if (lensVal) {
        ctx.fillStyle = C2; ctx.font = `italic 400 ${Math.round(fp * 0.85)}px "Playfair Display", "Noto Serif", Georgia, serif`;
        ctx.fillText(lensVal.value, ruleX, y, ruleW * 0.9); y += Math.round(fp * 1.8);
    }
    const exif1 = [apVal && `Aperture ${apVal.value}`, shutVal && `Shutter ${shutVal.value}`].filter(Boolean).join('  ·  ');
    const exif2 = [isoVal?.value, focalVal && `Focal ${focalVal.value}`].filter(Boolean).join('  ·  ');
    ctx.fillStyle = C3; ctx.font = `400 ${Math.round(fp * 0.72)}px "DM Sans", sans-serif`;
    if (exif1) { ctx.fillText(exif1, ruleX, y, ruleW * 0.9); y += Math.round(fp * 1.1); }
    if (exif2) { ctx.fillText(exif2, ruleX, y, ruleW * 0.9); y += Math.round(fp * 1.7); }
    if (dateVal) {
        ctx.fillStyle = C4; ctx.font = `300 ${Math.round(fp * 0.65)}px "DM Sans", sans-serif`;
        ctx.fillText(dateVal.value, ruleX, y, ruleW * 0.9); y += Math.round(fp * 1.6);
    }
    ctx.fillStyle = RULE2; ctx.fillRect(ruleX, y, ruleW, Math.max(1, Math.round(barH * 0.007)));
    ctx.restore();
}

// ─── 16. HUD ─────────────────────────────────────────────────────────────────

export function drawHudOverlay(ctx, overlay, values, app) {
    const { barX, barY, barW, barH, imageX, imageY, imageW, imageH } = overlay;
    const fw   = app.getFrameWidth();
    const topH = overlay.topBarH ?? (imageY - fw);
    const BG   = '#0A0A0A';
    const HUD_ACCENTS = { default: '#FFFFFF', green: '#39FF14', red: '#FF3A3A', amber: '#FFB300', cyan: '#00E5FF' };
    const VAL  = HUD_ACCENTS[app.hudAccent] || '#FFFFFF', LABEL = '#555555', INFO = '#666666';
    ctx.fillStyle = BG;
    ctx.fillRect(fw, fw, barW, topH);
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = Math.max(1, Math.round(imageH * 0.001));
    ctx.strokeRect(imageX, imageY, imageW, imageH);

    const fp   = getExifFontPx(imageH, app.exifFontSize);
    const pad  = Math.round(barW * 0.044);
    const camVal   = values.find(v => v.key === 'camera');
    const lensVal  = values.find(v => v.key === 'lens');
    const apVal    = values.find(v => v.key === 'aperture');
    const isoVal   = values.find(v => v.key === 'iso');
    const focalVal = values.find(v => v.key === 'focalLength');
    const shutVal  = values.find(v => v.key === 'shutter');
    const dateVal  = values.find(v => v.key === 'date');
    const valPx    = Math.round(fp * 1.30);
    const lblPx    = Math.round(Math.max(7, fp * 0.56));
    const midTopY  = fw + topH / 2;

    ctx.save();
    const drawCorner = (tx, ty, alignH, val, label) => {
        ctx.fillStyle = VAL; ctx.font = `700 ${valPx}px "JetBrains Mono", "SF Mono", monospace`;
        ctx.textAlign = alignH; ctx.textBaseline = 'middle';
        ctx.fillText(val, tx, ty - Math.round(fp * 0.55));
        ctx.fillStyle = LABEL; ctx.font = `500 ${lblPx}px "DM Sans", sans-serif`;
        ctx.fillText(label.toUpperCase(), tx, ty + Math.round(fp * 0.55));
    };
    if (apVal)    drawCorner(barX + pad, midTopY, 'left',  apVal.value,    'APERTURE');
    if (isoVal)   drawCorner(barX + barW - pad, midTopY, 'right', isoVal.value,   'ISO');
    const botCornerY = barY + Math.round(barH * 0.30);
    if (focalVal) drawCorner(barX + pad, botCornerY, 'left', focalVal.value, 'FOCAL LENGTH');
    if (shutVal)  drawCorner(barX + barW - pad, botCornerY, 'right', shutVal.value,  'SHUTTER SPEED');

    const infoY = barY + barH * 0.72;
    const camLens = [camVal?.value, lensVal?.value].filter(Boolean).join(' · ');
    ctx.fillStyle = INFO; ctx.font = `400 ${Math.round(fp * 0.62)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(camLens, barX + pad, infoY, barW * 0.62);
    if (dateVal) {
        ctx.textAlign = 'right';
        ctx.fillText(dateVal.value, barX + barW - pad, infoY);
    }
    ctx.restore();
}

// ─── 17. Minimal Bar ─────────────────────────────────────────────────────────

export function drawMinimalbarOverlay(ctx, overlay, values, app) {
    const { barX, barY, barW, barH } = overlay;
    const textColor = resolveExifTextColor(ctx, overlay.imageW, overlay.imageH, app.exifTextColor);
    const isDark = textColor === '#FFFFFF';
    const BG  = isDark ? '#111111' : '#FFFFFF';
    const TXT = isDark ? '#666666' : '#999999';
    const DIV = isDark ? '#333333' : '#E0E0E0';
    ctx.fillStyle = BG; ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = DIV; ctx.lineWidth = Math.max(0.5, Math.round(barH * 0.015));
    ctx.beginPath(); ctx.moveTo(barX, barY); ctx.lineTo(barX + barW, barY); ctx.stroke();

    const fp  = Math.max(9, Math.round(barH * 0.30));
    const pad = Math.round(barW * 0.032);
    const sep = ' · ';
    const dateVal = values.find(v => v.key === 'date');
    const main = values.filter(v => v.key !== 'date').map(v => v.value).join(sep);
    ctx.save();
    ctx.fillStyle = TXT; ctx.font = `400 ${fp}px "Inter", "Pretendard", "Helvetica Neue", sans-serif`;
    ctx.textBaseline = 'middle'; const midY = barY + barH / 2;
    const fullLine = [main, dateVal?.value].filter(Boolean).join(sep);
    ctx.textAlign = 'left';
    const lineW = ctx.measureText(fullLine).width;
    if (lineW <= barW - pad * 2) {
        ctx.fillText(fullLine, barX + pad, midY, barW - pad * 2);
    } else {
        ctx.fillText(main, barX + pad, barY + barH * 0.30, barW * 0.72);
        if (dateVal) {
            ctx.textAlign = 'right';
            ctx.fillText(dateVal.value, barX + barW - pad, barY + barH * 0.72);
        }
    }
    ctx.restore();
}

// ─── 18. Card Grid ───────────────────────────────────────────────────────────

export function drawCardgridOverlay(ctx, overlay, values, app) {
    const { barX, barY, barW, barH } = overlay;
    const textColor = resolveExifTextColor(ctx, overlay.imageW, overlay.imageH, app.exifTextColor);
    const isDark = textColor === '#FFFFFF';
    const BG    = isDark ? '#1A1A1A' : '#FFFFFF';
    const CARD  = isDark ? '#242424' : '#F8F8F6';
    const CBORD = isDark ? '#333333' : 'transparent';
    const TEXT1 = isDark ? '#E8E8E8' : '#1A1A1A';
    const TEXT2 = isDark ? '#777777' : '#888888';
    const ICOL  = isDark ? '#555555' : '#AAAAAA';
    ctx.fillStyle = BG; ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = isDark ? '#2A2A2A' : '#F0F0F0';
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(barX, barY); ctx.lineTo(barX + barW, barY); ctx.stroke();

    const fp   = getExifFontPx(overlay.imageH, app.exifFontSize);
    const pad  = Math.round(barW * 0.044);
    const brand   = detectBrand(app.currentImage?.exifData);
    const camVal  = values.find(v => v.key === 'camera');
    const lensVal = values.find(v => v.key === 'lens');
    const apVal   = values.find(v => v.key === 'aperture');
    const shutVal = values.find(v => v.key === 'shutter');
    const isoVal  = values.find(v => v.key === 'iso');
    const focalVal = values.find(v => v.key === 'focalLength');
    const dateVal  = values.find(v => v.key === 'date');

    const logoSz = Math.round(fp * 2.2);
    const logoX  = barX + pad;
    const logoY  = barY + Math.round(barH * 0.08);
    const logoR  = Math.round(logoSz * 0.2);
    ctx.save();
    ctx.fillStyle = isDark ? '#2A2A2A' : '#F5F5F5';
    roundRect(ctx, logoX, logoY, logoSz, logoSz, logoR); ctx.fill();
    if (CBORD !== 'transparent') {
        ctx.strokeStyle = CBORD; ctx.lineWidth = 1;
        roundRect(ctx, logoX, logoY, logoSz, logoSz, logoR); ctx.stroke();
    }
    const initial = brand ? brand.name[0].toUpperCase() : (camVal?.value?.[0] || '?');
    ctx.fillStyle = brand?.accent || TEXT1;
    ctx.font = `700 ${Math.round(fp * 0.85)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initial, logoX + logoSz / 2, logoY + logoSz / 2);
    const tx = logoX + logoSz + Math.round(barW * 0.018);
    ctx.fillStyle = TEXT1; ctx.font = `600 ${Math.round(fp * 0.98)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(camVal?.value || 'Camera', tx, logoY + logoSz * 0.32, barW * 0.55);
    ctx.fillStyle = TEXT2; ctx.font = `400 ${Math.round(fp * 0.72)}px "DM Sans", sans-serif`;
    ctx.fillText(lensVal?.value || '', tx, logoY + logoSz * 0.72, barW * 0.55);

    const gridY      = barY + Math.round(barH * 0.30);
    const gridBotPad = Math.round(barH * 0.04);
    const gapSz      = Math.round(barW * 0.012);
    const cv = parseInt(app.cardVariant) || 6;
    const cols = (cv === 2) ? 2 : (cv === 3) ? 3 : (cv === 4) ? 2 : 3;
    const rows = (cv <= 3) ? 1 : 2;
    const cardWi = Math.round((barW - pad * 2 - gapSz * (cols - 1)) / cols);
    const cardHi = Math.round((barY + barH - gridBotPad - gridY - gapSz * (rows - 1)) / rows);
    const cardR  = Math.round(cardWi * 0.12);
    const allCards = [
        { val: apVal?.value,    label: 'Aperture', icon: '◎' },
        { val: shutVal?.value,  label: 'Shutter',  icon: '⚡' },
        { val: isoVal?.value,   label: 'ISO',      icon: '▣' },
        { val: focalVal?.value, label: 'Focal',    icon: '⊕' },
        { val: dateVal?.value,  label: 'Date',     icon: '◈' },
        { val: `${Math.round(overlay.imageW / overlay.imageH * 100) / 100}:1`, label: 'Ratio', icon: '⊞' },
    ];
    const cards = allCards.slice(0, cols * rows);
    cards.forEach((card, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const cx = barX + pad + col * (cardWi + gapSz);
        const cy = gridY + row * (cardHi + gapSz);
        ctx.fillStyle = CARD;
        roundRect(ctx, cx, cy, cardWi, cardHi, cardR); ctx.fill();
        if (CBORD !== 'transparent') {
            ctx.strokeStyle = CBORD; ctx.lineWidth = 1;
            roundRect(ctx, cx, cy, cardWi, cardHi, cardR); ctx.stroke();
        }
        const iconPx = Math.max(8, Math.round(fp * 0.72));
        const valPx  = Math.max(9, Math.round(fp * 0.96));
        const lblPx  = Math.max(7, Math.round(fp * 0.58));
        ctx.fillStyle = ICOL; ctx.font = `${iconPx}px "DM Sans", sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(card.icon, cx + Math.round(cardWi * 0.12), cy + Math.round(cardHi * 0.12));
        ctx.fillStyle = TEXT1; ctx.font = `700 ${valPx}px "DM Sans", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(card.val || '—', cx + cardWi / 2, cy + cardHi * 0.60, cardWi * 0.88);
        ctx.fillStyle = ICOL; ctx.font = `400 ${lblPx}px "DM Sans", sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(card.label, cx + cardWi / 2, cy + cardHi * 0.83);
    });
    ctx.restore();
}

// ─── No EXIF Message ─────────────────────────────────────────────────────────

export function drawNoExifMessage(ctx, canvasW, canvasH, overlay, app) {
    const fontPx = Math.round(canvasH * 0.018);
    if (app.exifStyle === 'minimal') {
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
        const barColor = resolveExifBarColor(
            app.exifTextColor === 'black' ? '#000000' : '#FFFFFF',
            app.exifBarColor
        );
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
