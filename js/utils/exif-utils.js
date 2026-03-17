/**
 * exif-utils.js — EXIF 데이터 파싱 및 EXIF 프레임 렌더링 유틸
 *
 * 인스턴스 상태를 받는 함수들은 명시적 파라미터로 상태를 전달한다:
 *   getExifFontPx(canvasHeight, fontSizeSetting)
 *   resolveExifTextColor(ctx, w, h, textColorSetting)
 *   resolveExifBarColor(textColor, barColorSetting)
 */

export const BRAND_THEMES = {
    'sony':     { primary: '#000000', accent: '#F58220', name: 'SONY' },
    'fujifilm': { primary: '#1A1A1A', accent: '#86B817', name: 'FUJIFILM' },
    'canon':    { primary: '#FFFFFF', accent: '#CC0000', name: 'Canon' },
    'nikon':    { primary: '#000000', accent: '#FFD700', name: 'Nikon' },
    'apple':    { primary: '#1D1D1F', accent: '#FFFFFF', name: 'Apple' },
    'leica':    { primary: '#FFFFFF', accent: '#E2001A', name: 'Leica' },
    'ricoh':    { primary: '#1A1A1A', accent: '#DA291C', name: 'RICOH' },
};

export const EXIF_FONT_SIZES = {
    small:  0.015,
    medium: 0.020,
    large:  0.028,
};

/** HTML 이스케이프 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ------- EXIF 바이너리 파싱 -------

/**
 * JPEG ArrayBuffer에서 EXIF 태그 객체를 파싱한다.
 * @param {ArrayBuffer} buffer
 * @returns {Object|null}
 */
export function readExifFromBuffer(buffer) {
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xFFD8) return null;

    let offset = 2;
    while (offset < view.byteLength - 1) {
        const marker = view.getUint16(offset);
        if (marker === 0xFFE1) {
            const length = view.getUint16(offset + 2);
            const exifStart = offset + 4;
            if (view.getUint32(exifStart) === 0x45786966 && view.getUint16(exifStart + 4) === 0x0000) {
                return parseTiff(view, exifStart + 6);
            }
            offset += 2 + length;
        } else if ((marker & 0xFF00) === 0xFF00) {
            if (marker === 0xFFDA) break;
            offset += 2 + view.getUint16(offset + 2);
        } else {
            break;
        }
    }
    return null;
}

export function parseTiff(view, tiffStart) {
    const bigEndian = view.getUint16(tiffStart) === 0x4D4D;
    const get16 = (o) => view.getUint16(o, !bigEndian);
    const get32 = (o) => view.getUint32(o, !bigEndian);

    const ifdOffset = get32(tiffStart + 4);
    const tags = {};
    const exifTags = {};

    readIFD(view, tiffStart, tiffStart + ifdOffset, get16, get32, tags);
    if (tags[0x8769]) {
        readIFD(view, tiffStart, tiffStart + tags[0x8769], get16, get32, exifTags);
    }

    return { ...tags, ...exifTags };
}

export function readIFD(view, tiffStart, ifdStart, get16, get32, result) {
    try {
        const count = get16(ifdStart);
        for (let i = 0; i < count; i++) {
            const entryOffset = ifdStart + 2 + i * 12;
            const tag = get16(entryOffset);
            const type = get16(entryOffset + 2);
            const numValues = get32(entryOffset + 4);
            const valueOffset = entryOffset + 8;

            if (type === 2) {
                const strLen = numValues;
                const strOffset = strLen > 4 ? tiffStart + get32(valueOffset) : valueOffset;
                let str = '';
                for (let j = 0; j < strLen - 1; j++) {
                    str += String.fromCharCode(view.getUint8(strOffset + j));
                }
                result[tag] = str.trim();
            } else if (type === 3) {
                result[tag] = numValues === 1 ? get16(valueOffset) : get32(valueOffset);
            } else if (type === 4) {
                result[tag] = get32(valueOffset);
            } else if (type === 5 || type === 10) {
                const ratOffset = tiffStart + get32(valueOffset);
                const num = get32(ratOffset);
                const den = get32(ratOffset + 4);
                result[tag] = { num, den, value: den ? num / den : 0 };
            }
        }
    } catch (e) {
        // Ignore read errors
    }
}

// ------- EXIF 프레임 렌더링 유틸 -------

/**
 * 카메라 브랜드 테마 감지.
 * @param {Object|null} exifData
 * @returns {{key, primary, accent, name}|null}
 */
export function detectBrand(exifData) {
    if (!exifData) return null;
    const make = (exifData[0x010F] || '').toLowerCase();
    for (const [key, theme] of Object.entries(BRAND_THEMES)) {
        if (make.includes(key)) return { key, ...theme };
    }
    return null;
}

/**
 * 캔버스 높이 기준 EXIF 폰트 크기(px) 계산.
 * @param {number} canvasHeight
 * @param {'small'|'medium'|'large'} fontSizeSetting  — app.exifFontSize
 */
export function getExifFontPx(canvasHeight, fontSizeSetting) {
    return Math.round(canvasHeight * (EXIF_FONT_SIZES[fontSizeSetting] || EXIF_FONT_SIZES.medium));
}

/**
 * 하단 영역 밝기를 샘플링해 텍스트 색(흰/검) 자동 결정.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {'white'|'black'|'auto'} textColorSetting  — app.exifTextColor
 * @returns {'#FFFFFF'|'#000000'}
 */
export function resolveExifTextColor(ctx, canvasW, canvasH, textColorSetting) {
    if (textColorSetting !== 'auto') return textColorSetting === 'white' ? '#FFFFFF' : '#000000';
    const sampleH = Math.max(1, Math.round(canvasH * 0.1));
    try {
        const imageData = ctx.getImageData(0, canvasH - sampleH, canvasW, sampleH);
        let brightness = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
            brightness += (imageData.data[i] * 0.299 + imageData.data[i+1] * 0.587 + imageData.data[i+2] * 0.114);
        }
        brightness /= (imageData.data.length / 4);
        return brightness > 128 ? '#000000' : '#FFFFFF';
    } catch (e) { return '#FFFFFF'; }
}

/**
 * EXIF 바 배경색 결정.
 * @param {'#FFFFFF'|'#000000'} textColor  — resolveExifTextColor 결과
 * @param {'black'|'white'|'auto'|'transparent'} barColorSetting  — app.exifBarColor
 * @returns {string}
 */
export function resolveExifBarColor(textColor, barColorSetting) {
    if (barColorSetting === 'transparent') return 'transparent';
    if (barColorSetting === 'auto') return textColor === '#FFFFFF' ? '#000000' : '#FFFFFF';
    return barColorSetting === 'white' ? '#FFFFFF' : '#000000';
}
