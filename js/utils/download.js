/**
 * download.js — 다운로드 유틸리티
 *
 * 모든 함수는 app 인스턴스를 첫 번째 파라미터로 받는다.
 * triggerDownload, blobToBase64는 app 상태 없이 동작하는 순수 유틸.
 */

let _jszipPromise = null;
function ensureJSZip() {
    if (typeof JSZip !== 'undefined') return Promise.resolve();
    if (!_jszipPromise) {
        _jszipPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('JSZip 로드 실패'));
            document.head.appendChild(script);
        });
    }
    return _jszipPromise;
}

/**
 * 다운로드 진입점 — 모드에 따라 적절한 다운로드 함수로 라우팅.
 */
export async function download(app) {
    if (!app.hasImage || app.isDownloading) return;

    app.setDownloadLock(true);

    // 안전장치: 15초 후 lock 강제 해제 (toBlob 무응답 등 대비)
    const safetyTimer = setTimeout(() => {
        if (app.isDownloading) {
            app.hideProgress();
            app.setDownloadLock(false);
        }
    }, 15000);

    try {
        if (app.appMode === 'convert') {
            await downloadConverted(app);
            return;
        }
        if (app.appMode === 'split') {
            await downloadSplit(app);
            return;
        }

        if (app.hasMultipleImages) {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                await downloadMultipleAsImages(app);
            } else {
                await downloadAsZip(app);
            }
        } else {
            await downloadSingle(app);
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Download failed:', err);
            app.showToast('다운로드에 실패했습니다');
        }
    } finally {
        clearTimeout(safetyTimer);
        app.hideProgress();
        app.setDownloadLock(false);
    }
}

/**
 * 단일 이미지 다운로드 (프레임/EXIF 모드).
 */
export async function downloadSingle(app) {
    const cur = app.currentImage;
    if (!cur) return;

    if (app.appMode === 'exif') {
        await downloadExifFrame(app);
        return;
    }

    const dims = app.getCanvasDimensions();
    const offscreen = document.createElement('canvas');
    offscreen.width = dims.width;
    offscreen.height = dims.height;
    const ctx = offscreen.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    app.drawFrameBackground(ctx, cur.image, dims.width, dims.height);

    const photoArea = app.getPhotoArea();
    const draw = app.getDrawDimensions(cur.image);

    ctx.save();
    ctx.beginPath();
    ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
    ctx.clip();

    const x = photoArea.x + (photoArea.width - draw.width) / 2 + cur.imageOffset.x;
    const y = photoArea.y + (photoArea.height - draw.height) / 2 + cur.imageOffset.y;
    ctx.drawImage(cur.image, x, y, draw.width, draw.height);
    ctx.restore();

    const blob = await new Promise((resolve, reject) => {
        offscreen.toBlob(b => {
            offscreen.width = 0;
            offscreen.height = 0;
            b ? resolve(b) : reject(new Error('Canvas toBlob failed'));
        }, 'image/jpeg', 0.95);
    });

    const baseName = cur.fileName ? cur.fileName.replace(/\.[^.]+$/, '') : 'photo';
    await triggerDownload(blob, `${baseName}_pfm.jpg`);
}

/**
 * 변환 모드 다운로드.
 */
export async function downloadConverted(app) {
    const [mime, quality] = app.getBlobArgs();
    const ext = app.getExtension();
    const items = app.loadedImages;

    if (items.length === 1) {
        const item = items[0];
        const img = item.image;
        const offscreen = document.createElement('canvas');
        offscreen.width = img.naturalWidth;
        offscreen.height = img.naturalHeight;
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const blob = await new Promise((resolve, reject) => {
            offscreen.toBlob(b => {
                offscreen.width = 0; offscreen.height = 0;
                b ? resolve(b) : reject(new Error('toBlob failed'));
            }, mime, quality);
        });
        const baseName = item.fileName ? item.fileName.replace(/\.[^.]+$/, '') : 'photo';
        await triggerDownload(blob, baseName + ext);
    } else {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const total = items.length;
        app.showProgress(0, total);

        if (isMobile) {
            const files = [];
            for (let i = 0; i < total; i++) {
                const item = items[i];
                const blob = await app.renderConvertedBlob(item, mime, quality);
                const baseName = item.fileName ? item.fileName.replace(/\.[^.]+$/, '') : `photo_${i + 1}`;
                files.push(new File([blob], baseName + ext, { type: mime }));
                app.showProgress(i + 1, total);
            }
            if (navigator.canShare && navigator.canShare({ files })) {
                await navigator.share({ files });
            } else {
                for (const file of files) {
                    await triggerDownload(file, file.name);
                }
            }
        } else if (typeof JSZip !== 'undefined') {
            const zip = new JSZip();
            for (let i = 0; i < total; i++) {
                const item = items[i];
                const blob = await app.renderConvertedBlob(item, mime, quality);
                const baseName = item.fileName ? item.fileName.replace(/\.[^.]+$/, '') : `photo_${i + 1}`;
                zip.file(baseName + ext, blob);
                app.showProgress(i + 1, total);
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            await triggerDownload(zipBlob, 'photos_converted.zip');
        } else {
            for (let i = 0; i < total; i++) {
                const item = items[i];
                const blob = await app.renderConvertedBlob(item, mime, quality);
                const baseName = item.fileName ? item.fileName.replace(/\.[^.]+$/, '') : `photo_${i + 1}`;
                await triggerDownload(blob, baseName + ext);
                app.showProgress(i + 1, total);
            }
        }
    }
}

/**
 * 분할 모드 다운로드.
 */
export async function downloadSplit(app) {
    const cur = app.currentImage;
    if (!cur) return;

    const dims = app.getCanvasDimensions();
    const photoArea = app.getPhotoArea();
    const total = app.splitCount;
    const baseName = cur.fileName ? cur.fileName.replace(/\.[^.]+$/, '') : 'photo';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    app.showProgress(0, total);

    if (isMobile) {
        const files = [];
        for (let i = 0; i < total; i++) {
            app.showProgress(i + 1, total);
            const blob = await app.renderSplitPanelToBlob(cur, dims, photoArea, i);
            files.push({ blob, fileName: `${baseName}_split_${i + 1}.jpg` });
        }

        if (await tryBatchShare(files)) {
            app.hideProgress();
            return;
        }

        for (let i = 0; i < files.length; i++) {
            await triggerDownload(files[i].blob, files[i].fileName);
            if (i < files.length - 1) await new Promise(r => setTimeout(r, 300));
        }
        app.hideProgress();
        return;
    }

    // Desktop: ZIP 다운로드
    await ensureJSZip();
    const files = [];
    for (let i = 0; i < total; i++) {
        app.showProgress(i + 1, total);
        const blob = await app.renderSplitPanelToBlob(cur, dims, photoArea, i);
        files.push({ name: `${baseName}_split_${i + 1}.jpg`, blob });
    }

    const zip = new JSZip();
    for (const f of files) zip.file(f.name, f.blob);

    app.showProgress(total, total, '압축 중...');

    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 1 }
    });

    await triggerDownload(zipBlob, `${baseName}_split_${total}장.zip`);
    app.hideProgress();
}

/**
 * EXIF 프레임 다운로드 (원본 해상도).
 */
export async function downloadExifFrame(app) {
    const cur = app.currentImage;
    if (!cur) return;

    const imgNW = cur.image.naturalWidth;
    const imgNH = cur.image.naturalHeight;
    const rawOverlay = app.getExifOverlayDimensions({ width: imgNW, height: imgNH });
    const fw = app.getFrameWidth();
    const rawCW = rawOverlay.canvasWidth;
    const rawCH = rawOverlay.canvasHeight;

    const totalW = rawCW + fw * 2;
    const totalH = rawCH + fw * 2;

    const offscreen = document.createElement('canvas');
    offscreen.width = totalW;
    offscreen.height = totalH;
    const ctx = offscreen.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    app.drawFrameBackground(ctx, cur.image, totalW, totalH);

    const ox = { ...rawOverlay, imageX: rawOverlay.imageX + fw, imageY: rawOverlay.imageY + fw, barX: rawOverlay.barX + fw, barY: rawOverlay.barY + fw };

    ctx.save();
    ctx.beginPath();
    ctx.rect(ox.imageX, ox.imageY, ox.imageW, ox.imageH);
    ctx.clip();
    ctx.drawImage(cur.image, ox.imageX, ox.imageY, ox.imageW, ox.imageH);
    ctx.restore();

    if (app.hasExifData()) {
        app._drawExifOverlay(ctx, totalW, totalH, ox);
    } else {
        app._drawNoExifMessage(ctx, totalW, totalH, ox);
    }

    const blob = await new Promise((resolve, reject) => {
        offscreen.toBlob(b => {
            offscreen.width = 0;
            offscreen.height = 0;
            b ? resolve(b) : reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
    });

    const baseName = cur.fileName ? cur.fileName.replace(/\.[^.]+$/, '') : 'photo';
    await triggerDownload(blob, `${baseName}_exif.png`);
}

/**
 * 다중 이미지 모바일 다운로드 (Web Share API).
 */
export async function downloadMultipleAsImages(app) {
    const total = app.images.length;
    const dims = app.getCanvasDimensions();
    const photoArea = app.getPhotoArea();

    app.showProgress(0, total);

    const nameCount = {};
    const files = [];

    for (let i = 0; i < total; i++) {
        const item = app.images[i];
        app.showProgress(i + 1, total);

        const blob = await app.renderItemToBlob(item, dims, photoArea);

        const baseName = item.fileName ? item.fileName.replace(/\.[^.]+$/, '') : 'photo';
        let fileName = `${baseName}_pfm.jpg`;
        if (nameCount[fileName]) {
            nameCount[fileName]++;
            fileName = `${baseName}_pfm(${nameCount[fileName]}).jpg`;
        } else {
            nameCount[fileName] = 1;
        }

        files.push({ blob, fileName });
    }

    if (await tryBatchShare(files)) {
        app.hideProgress();
        return;
    }

    for (let i = 0; i < files.length; i++) {
        await triggerDownload(files[i].blob, files[i].fileName);
        if (i < files.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    app.hideProgress();
}

/**
 * 다중 이미지 ZIP 다운로드 (데스크톱).
 */
export async function downloadAsZip(app) {
    await ensureJSZip();

    const zip = new JSZip();
    const total = app.images.length;
    const dims = app.getCanvasDimensions();
    const photoArea = app.getPhotoArea();

    app.showProgress(0, total);

    const nameCount = {};

    for (let i = 0; i < total; i++) {
        const item = app.images[i];
        app.showProgress(i + 1, total);

        const blob = await app.renderItemToBlob(item, dims, photoArea);

        const baseName = item.fileName ? item.fileName.replace(/\.[^.]+$/, '') : 'photo';
        let zipName = `${baseName}_pfm.jpg`;
        if (nameCount[zipName]) {
            nameCount[zipName]++;
            zipName = `${baseName}_pfm(${nameCount[zipName]}).jpg`;
        } else {
            nameCount[zipName] = 1;
        }

        zip.file(zipName, blob);
    }

    app.showProgress(total, total, '압축 중...');

    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 1 }
    });

    await triggerDownload(zipBlob, `photoframe_${total}장_pfm.zip`);
    app.hideProgress();
}

/**
 * iOS 배치 공유 시도. 성공하면 true 반환.
 * @param {{ blob: Blob, fileName: string }[]} filesArray
 */
export async function tryBatchShare(filesArray) {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!isIOS || !navigator.canShare) return false;

    try {
        const shareFiles = filesArray.map(f =>
            new File([f.blob], f.fileName, { type: f.blob.type })
        );
        if (!navigator.canShare({ files: shareFiles })) return false;

        await navigator.share({ files: shareFiles });
        return true;
    } catch (e) {
        if (e.name === 'AbortError') return true;
        console.error('Batch share failed:', e);
        return false;
    }
}

/**
 * 플랫폼별 파일 저장/공유 처리.
 * Capacitor 네이티브 → iOS Share Sheet / Android 갤러리 → Web Share API → <a download>
 * @param {Blob|File} blob
 * @param {string} fileName
 */
export async function triggerDownload(blob, fileName) {
    if (window.Capacitor?.isNativePlatform()) {
        const platform = window.Capacitor.getPlatform();

        if (platform === 'android') {
            try {
                const { Media } = await import('@capacitor-community/media');
                const base64 = await blobToBase64(blob);
                const dataUri = 'data:image/png;base64,' + base64;

                const albumName = 'Photo Frame Maker';
                const { albums } = await Media.getAlbums();
                let album = albums.find(a => a.name === albumName);
                if (!album) {
                    await Media.createAlbum({ name: albumName });
                    const result = await Media.getAlbums();
                    album = result.albums.find(a => a.name === albumName);
                }

                const saveOpts = { path: dataUri, fileName: fileName.replace(/\.[^.]+$/, '') };
                if (album) saveOpts.albumIdentifier = album.identifier;

                await Media.savePhoto(saveOpts);
                return;
            } catch (e) {
                console.error('Media save failed:', e);
            }
        }

        if (platform === 'ios') {
            try {
                const { Filesystem, Directory } = await import('@capacitor/filesystem');
                const { Share } = await import('@capacitor/share');
                const base64 = await blobToBase64(blob);

                const tempPath = 'tmp_share_' + fileName;
                const written = await Filesystem.writeFile({
                    path: tempPath,
                    data: base64,
                    directory: Directory.Cache
                });

                await Share.share({ title: fileName, files: [written.uri] });

                try {
                    await Filesystem.deleteFile({ path: tempPath, directory: Directory.Cache });
                } catch (_) { /* ignore */ }
                return;
            } catch (e) {
                if (e.message?.includes('canceled') || e.message?.includes('cancelled')) return;
                console.error('Share failed:', e);
            }
        }
    }

    // iOS Safari: Web Share API
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIOS && navigator.canShare) {
        try {
            const file = new File([blob], fileName, { type: blob.type });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file] });
                return;
            }
        } catch (e) {
            if (e.name === 'AbortError') return;
            console.error('Web Share failed:', e);
        }
    }

    // Web: <a download> — GTM linkClick 트리거 방지
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.setAttribute('data-gtm-ignore', 'true');
    a.style.display = 'none';
    document.body.appendChild(a);

    // GTM이 click 이벤트를 가로채지 못하도록 stopPropagation
    a.addEventListener('click', e => e.stopPropagation(), { once: true });
    a.click();

    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Blob → Base64 문자열 변환.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
