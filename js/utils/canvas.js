/**
 * canvas.js — 캔버스 순수 유틸 함수
 * 인스턴스 상태 없이 동작하는 순수 함수들
 */

// 모듈 레벨 캔버스 캐시 (GC 방지)
let _colorSampleCanvas = null;

/**
 * 캔버스에 둥근 사각형 경로를 그린다.
 * (ctx.roundRect 미지원 브라우저 대응)
 */
export function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

/** RGB → HSL 변환. 반환값: [h(0-1), s(0-1), l(0-1)] */
export function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
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

/** HSL → RGB 변환. 반환값: [r, g, b] (0-255) */
export function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * 이미지에서 지배색을 추출해 프레임 배경에 적합한 연한 색으로 반환.
 * @param {HTMLImageElement} img
 * @returns {string} hex color
 */
export function extractDominantColor(img) {
    if (!_colorSampleCanvas) _colorSampleCanvas = document.createElement('canvas');
    const sc = _colorSampleCanvas;
    const sz = 32;
    sc.width = sz;
    sc.height = sz;
    const sctx = sc.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, sz, sz);
    const data = sctx.getImageData(0, 0, sz, sz).data;

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
    }
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    // HSL 보정: 채도 낮추고 밝기 올려서 프레임에 적합하게
    const [h, s, l] = rgbToHsl(r, g, b);
    const adjS = Math.min(s, 0.35);
    const adjL = Math.max(l, 0.75);
    const [ar, ag, ab] = hslToRgb(h, adjS, adjL);

    return '#' + [ar, ag, ab].map(v => v.toString(16).padStart(2, '0')).join('');
}
