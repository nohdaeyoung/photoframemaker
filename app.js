class PhotoFrameMaker {
    constructor() {
        this.image = null;
        this.imageUrl = null;
        this.fileName = '';
        this.fileSize = 0;
        this.canvasRatio = [1, 1];
        this.canvasSize = 1000;
        this.frameRatio = 5;
        this.frameColor = '#FFFFFF';
        this.imageOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragStartOffset = { x: 0, y: 0 };

        this.canvas = document.getElementById('preview-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.previewContainer = document.getElementById('preview-container');

        this.init();
    }

    init() {
        this.bindElements();
        this.setupEventListeners();
        this.updateCanvasSize();
        this.render();
        this.updateInfo();
        this.setupBottomSheet();
    }

    bindElements() {
        this.uploadZone = document.getElementById('upload-zone');
        this.fileInput = document.getElementById('file-input');
        this.uploadContent = document.getElementById('upload-content');
        this.ratioButtons = document.getElementById('ratio-buttons');
        this.canvasSizeInput = document.getElementById('canvas-size');
        this.frameRatioSlider = document.getElementById('frame-ratio-slider');
        this.frameRatioInput = document.getElementById('frame-ratio');
        this.colorPresets = document.getElementById('color-presets');
        this.customColorInput = document.getElementById('custom-color');
        this.downloadBtn = document.getElementById('download-btn');
        this.previewHint = document.getElementById('preview-hint');

        this.infoCanvas = document.getElementById('info-canvas');
        this.infoFrame = document.getElementById('info-frame');
        this.infoPhoto = document.getElementById('info-photo');
        this.infoOriginal = document.getElementById('info-original');
        this.infoOriginalLabel = document.getElementById('info-original-label');
        this.upscaleWarning = document.getElementById('upscale-warning');
        this.exifSection = document.getElementById('exif-section');
        this.exifGrid = document.getElementById('exif-grid');

        this.previewToolbar = document.getElementById('preview-toolbar');
        this.previewRemoveBtn = document.getElementById('preview-remove-btn');

        this.sidebar = document.getElementById('sidebar');
        this.sheetHandle = document.getElementById('sheet-handle');
        this.sheetBackdrop = document.getElementById('sheet-backdrop');

        // Mobile tab bar elements
        this.mobileTabBar = document.getElementById('mobile-tab-bar');
        this.mobileTabPanels = document.getElementById('mobile-tab-panels');
        this.mobileDownloadBtn = document.getElementById('mobile-download-btn');
        this.mobileCanvasSizeInput = document.getElementById('mobile-canvas-size');
        this.mobileFrameRatioSlider = document.getElementById('mobile-frame-ratio-slider');
        this.mobileFrameRatioInput = document.getElementById('mobile-frame-ratio');
        this.mobileColorPresets = document.getElementById('mobile-color-presets');
        this.mobileCustomColorInput = document.getElementById('mobile-custom-color');
        this.mobileInfoCanvas = document.getElementById('mobile-info-canvas');
        this.mobileInfoFrame = document.getElementById('mobile-info-frame');
        this.mobileInfoPhoto = document.getElementById('mobile-info-photo');
        this.mobileInfoOriginal = document.getElementById('mobile-info-original');
        this.mobileInfoOriginalLabel = document.getElementById('mobile-info-original-label');
        this.mobileUpscaleWarning = document.getElementById('mobile-upscale-warning');
        this.mobileExifSection = document.getElementById('mobile-exif-section');
        this.mobileExifGrid = document.getElementById('mobile-exif-grid');
        this.mobilePhotoInfo = document.getElementById('mobile-photo-info');
        this.mobilePhotoThumb = document.getElementById('mobile-photo-thumb');
        this.mobilePhotoName = document.getElementById('mobile-photo-name');
        this.mobilePhotoSize = document.getElementById('mobile-photo-size');
        this.mobilePhotoUploadBtn = document.getElementById('mobile-photo-upload-btn');
        this.mobilePhotoUploadLabel = document.getElementById('mobile-photo-upload-label');
        this.mobilePhotoDeleteBtn = document.getElementById('mobile-photo-delete-btn');
    }

    setupEventListeners() {
        // Preview delete button
        this.previewRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeImage();
        });

        // File upload
        this.uploadZone.addEventListener('click', (e) => {
            if (e.target.closest('.upload-remove-btn')) return;
            this.fileInput.click();
        });
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) this.loadImage(e.target.files[0]);
        });

        // Drag and drop
        this.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadZone.classList.add('drag-over');
        });
        this.uploadZone.addEventListener('dragleave', () => {
            this.uploadZone.classList.remove('drag-over');
        });
        this.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) this.loadImage(e.dataTransfer.files[0]);
        });

        // Paste
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    this.loadImage(item.getAsFile());
                    break;
                }
            }
        });

        // Ratio buttons
        this.ratioButtons.addEventListener('click', (e) => {
            const btn = e.target.closest('.ratio-btn');
            if (!btn) return;
            const ratio = btn.dataset.ratio;
            this.ratioButtons.querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratio));
            document.getElementById('mobile-ratio-buttons').querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratio));
            const [w, h] = ratio.split(':').map(Number);
            this.canvasRatio = [w, h];
            this.imageOffset = { x: 0, y: 0 };
            this.updateCanvasSize();
            this.render();
            this.updateInfo();
        });

        // Canvas size
        this.canvasSizeInput.addEventListener('input', () => {
            const val = parseInt(this.canvasSizeInput.value);
            if (val >= 100 && val <= 10000) {
                this.canvasSize = val;
                this.mobileCanvasSizeInput.value = val;
                this.imageOffset = { x: 0, y: 0 };
                this.updateCanvasSize();
                this.render();
                this.updateInfo();
            }
        });

        // Frame ratio
        this.frameRatioSlider.addEventListener('input', () => {
            this.frameRatio = parseFloat(this.frameRatioSlider.value);
            this.frameRatioInput.value = this.frameRatio;
            this.mobileFrameRatioSlider.value = this.frameRatio;
            this.mobileFrameRatioInput.value = this.frameRatio;
            this.imageOffset = { x: 0, y: 0 };
            this.render();
            this.updateInfo();
        });

        this.frameRatioInput.addEventListener('input', () => {
            let val = parseFloat(this.frameRatioInput.value);
            if (isNaN(val)) return;
            val = Math.max(0, Math.min(25, val));
            this.frameRatio = val;
            this.frameRatioSlider.value = val;
            this.mobileFrameRatioSlider.value = val;
            this.mobileFrameRatioInput.value = val;
            this.imageOffset = { x: 0, y: 0 };
            this.render();
            this.updateInfo();
        });

        // Color presets
        this.colorPresets.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;
            const color = swatch.dataset.color;
            this.colorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
            this.mobileColorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
            this.frameColor = color;
            this.customColorInput.value = color;
            this.mobileCustomColorInput.value = color;
            this.render();
        });

        this.customColorInput.addEventListener('input', () => {
            this.frameColor = this.customColorInput.value;
            this.mobileCustomColorInput.value = this.frameColor;
            this.colorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            this.mobileColorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            this.render();
        });

        // Canvas drag (image repositioning)
        this.canvas.addEventListener('mousedown', (e) => this.onDragStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.onDragMove(e));
        document.addEventListener('mouseup', () => this.onDragEnd());

        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1 && this.image) {
                e.preventDefault();
                this.onDragStart(e.touches[0]);
            }
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.image) {
                e.preventDefault();
                this.onDragMove(e.touches[0]);
            }
        }, { passive: false });
        document.addEventListener('touchend', () => this.onDragEnd());

        // Preview area click to upload (when no image)
        this.previewContainer.addEventListener('click', (e) => {
            if (!this.image) {
                this.fileInput.style.top = e.clientY + 'px';
                this.fileInput.style.left = e.clientX + 'px';
                this.fileInput.click();
            }
        });

        // Preview area drag and drop
        this.previewContainer.addEventListener('dragover', (e) => {
            if (!this.image) {
                e.preventDefault();
                this.previewContainer.classList.add('drag-over');
            }
        });
        this.previewContainer.addEventListener('dragleave', () => {
            this.previewContainer.classList.remove('drag-over');
        });
        this.previewContainer.addEventListener('drop', (e) => {
            if (!this.image) {
                e.preventDefault();
                this.previewContainer.classList.remove('drag-over');
                if (e.dataTransfer.files[0]) this.loadImage(e.dataTransfer.files[0]);
            }
        });

        // Download
        this.downloadBtn.addEventListener('click', () => this.download());
    }

    // --- Calculations ---

    getCanvasDimensions() {
        const [w, h] = this.canvasRatio;
        const maxSide = this.canvasSize;
        if (w >= h) {
            return {
                width: maxSide,
                height: Math.round(maxSide * h / w)
            };
        } else {
            return {
                width: Math.round(maxSide * w / h),
                height: maxSide
            };
        }
    }

    getFrameWidth() {
        return Math.round(this.canvasSize * this.frameRatio / 100);
    }

    getPhotoArea() {
        const dims = this.getCanvasDimensions();
        const fw = this.getFrameWidth();
        return {
            x: fw,
            y: fw,
            width: Math.max(0, dims.width - 2 * fw),
            height: Math.max(0, dims.height - 2 * fw)
        };
    }

    getDrawDimensions() {
        if (!this.image) return { width: 0, height: 0 };
        const photoArea = this.getPhotoArea();
        if (photoArea.width === 0 || photoArea.height === 0) return { width: 0, height: 0 };

        const imgRatio = this.image.naturalWidth / this.image.naturalHeight;
        const areaRatio = photoArea.width / photoArea.height;

        // Contain mode: fit entire image inside photo area (no cropping)
        let drawWidth, drawHeight;
        if (imgRatio > areaRatio) {
            // Image is wider than area - fit by width
            drawWidth = photoArea.width;
            drawHeight = drawWidth / imgRatio;
        } else {
            // Image is taller than area - fit by height
            drawHeight = photoArea.height;
            drawWidth = drawHeight * imgRatio;
        }
        return { width: drawWidth, height: drawHeight };
    }

    // --- Canvas size update ---

    updateCanvasSize() {
        const dims = this.getCanvasDimensions();
        this.canvas.width = dims.width;
        this.canvas.height = dims.height;
    }

    // --- Rendering ---

    render() {
        const dims = this.getCanvasDimensions();
        this.ctx.clearRect(0, 0, dims.width, dims.height);

        // Draw frame (background color)
        this.ctx.fillStyle = this.frameColor;
        this.ctx.fillRect(0, 0, dims.width, dims.height);

        // Draw image or placeholder
        if (this.image) {
            this.drawImage();
        } else {
            this.drawPlaceholder();
        }
    }

    drawImage() {
        const photoArea = this.getPhotoArea();
        if (photoArea.width === 0 || photoArea.height === 0) return;

        const draw = this.getDrawDimensions();
        if (draw.width === 0 || draw.height === 0) return;

        this.ctx.save();
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Clip to photo area
        this.ctx.beginPath();
        this.ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
        this.ctx.clip();

        const x = photoArea.x + (photoArea.width - draw.width) / 2;
        const y = photoArea.y + (photoArea.height - draw.height) / 2;

        this.ctx.drawImage(this.image, x, y, draw.width, draw.height);
        this.ctx.restore();
    }

    drawPlaceholder() {
        const photoArea = this.getPhotoArea();
        if (photoArea.width <= 0 || photoArea.height <= 0) return;

        // Light gray placeholder for photo area
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        this.ctx.fillRect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
    }

    // --- Image loading ---

    loadImage(file) {
        if (!file.type.startsWith('image/')) return;

        if (this.imageUrl) {
            URL.revokeObjectURL(this.imageUrl);
        }

        this.fileName = file.name;
        this.fileSize = file.size;
        this.imageUrl = URL.createObjectURL(file);

        // Parse EXIF before creating image
        this.parseExif(file);

        const img = new Image();
        img.onload = () => {
            this.image = img;
            this.imageOffset = { x: 0, y: 0 };
            this.updateUploadUI();
            this.render();
            this.updateInfo();
            this.downloadBtn.disabled = false;
            this.mobileDownloadBtn.disabled = false;
            this.previewToolbar.style.display = '';
            this.previewContainer.classList.add('has-image');
            this.updateMobilePhotoTab();
        };
        img.src = this.imageUrl;
    }

    removeImage() {
        if (this.imageUrl) {
            URL.revokeObjectURL(this.imageUrl);
        }
        this.image = null;
        this.imageUrl = null;
        this.fileName = '';
        this.fileSize = 0;
        this.imageOffset = { x: 0, y: 0 };
        this.fileInput.value = '';

        // Reset upload zone UI
        this.uploadZone.classList.remove('has-image');
        this.uploadContent.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
            </svg>
            <p>클릭하거나 파일을 드래그하세요</p>
            <span class="upload-hint">또는 Ctrl+V로 붙여넣기</span>
        `;

        // Reset preview
        this.previewContainer.classList.remove('has-image');
        this.previewToolbar.style.display = 'none';
        this.downloadBtn.disabled = true;
        this.mobileDownloadBtn.disabled = true;

        // Reset EXIF
        this.exifSection.style.display = 'none';
        this.exifGrid.innerHTML = '';
        this.mobileExifSection.style.display = 'none';
        this.mobileExifGrid.innerHTML = '';

        this.updateMobilePhotoTab();
        this.render();
        this.updateInfo();
    }

    updateUploadUI() {
        this.uploadZone.classList.add('has-image');
        const sizeStr = this.fileSize < 1024 * 1024
            ? (this.fileSize / 1024).toFixed(1) + ' KB'
            : (this.fileSize / (1024 * 1024)).toFixed(1) + ' MB';

        this.uploadContent.innerHTML = `
            <img class="upload-thumb" src="${this.imageUrl}" alt="미리보기">
            <div class="upload-info">
                <div class="upload-filename">${this.fileName}</div>
                <div class="upload-filesize">${this.image.naturalWidth} × ${this.image.naturalHeight} px · ${sizeStr}</div>
                <div class="upload-hint" style="display:block; margin-top:2px;">클릭하여 변경</div>
            </div>
            <span id="upload-remove-btn" title="사진 삭제" style="flex-shrink:0; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:rgba(0,0,0,0.1); color:#6b7280; font-size:18px; cursor:pointer; line-height:1;">&times;</span>
        `;

        // Rebind inline delete button
        document.getElementById('upload-remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeImage();
        });
    }

    // --- Drag handling ---

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    isInPhotoArea(canvasCoords) {
        const pa = this.getPhotoArea();
        return canvasCoords.x >= pa.x && canvasCoords.x <= pa.x + pa.width &&
               canvasCoords.y >= pa.y && canvasCoords.y <= pa.y + pa.height;
    }

    onDragStart(e) {
        if (!this.image) return;
        const coords = this.getCanvasCoords(e);
        if (!this.isInPhotoArea(coords)) return;

        this.isDragging = true;
        this.dragStart = coords;
        this.dragStartOffset = { ...this.imageOffset };
        this.canvas.style.cursor = 'grabbing';
    }

    onDragMove(e) {
        if (!this.image) return;

        const coords = this.getCanvasCoords(e);

        if (!this.isDragging) {
            this.canvas.style.cursor = this.isInPhotoArea(coords) ? 'grab' : 'default';
            return;
        }

        const dx = coords.x - this.dragStart.x;
        const dy = coords.y - this.dragStart.y;

        this.imageOffset = {
            x: this.dragStartOffset.x + dx,
            y: this.dragStartOffset.y + dy
        };

        this.clampOffset();
        this.render();
    }

    onDragEnd() {
        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        }
    }

    clampOffset() {
        const photoArea = this.getPhotoArea();
        const draw = this.getDrawDimensions();

        const maxOffsetX = Math.max(0, (draw.width - photoArea.width) / 2);
        const maxOffsetY = Math.max(0, (draw.height - photoArea.height) / 2);

        this.imageOffset.x = Math.max(-maxOffsetX, Math.min(maxOffsetX, this.imageOffset.x));
        this.imageOffset.y = Math.max(-maxOffsetY, Math.min(maxOffsetY, this.imageOffset.y));
    }

    // --- Info update ---

    updateInfo() {
        const dims = this.getCanvasDimensions();
        const fw = this.getFrameWidth();
        const pa = this.getPhotoArea();

        this.infoCanvas.textContent = `${dims.width} × ${dims.height} px`;
        this.infoFrame.textContent = `${fw} px`;
        this.infoPhoto.textContent = `${pa.width} × ${pa.height} px`;
        this.mobileInfoCanvas.textContent = `${dims.width} × ${dims.height} px`;
        this.mobileInfoFrame.textContent = `${fw} px`;
        this.mobileInfoPhoto.textContent = `${pa.width} × ${pa.height} px`;

        if (this.image) {
            const origText = `${this.image.naturalWidth} × ${this.image.naturalHeight} px`;
            this.infoOriginalLabel.style.display = '';
            this.infoOriginal.style.display = '';
            this.infoOriginal.textContent = origText;
            this.mobileInfoOriginalLabel.style.display = '';
            this.mobileInfoOriginal.style.display = '';
            this.mobileInfoOriginal.textContent = origText;

            // Check if upscaling
            const draw = this.getDrawDimensions();
            const scaleX = draw.width / this.image.naturalWidth;
            const scaleY = draw.height / this.image.naturalHeight;
            const scale = Math.min(scaleX, scaleY);

            const showWarn = scale > 1.5 ? '' : 'none';
            this.upscaleWarning.style.display = showWarn;
            this.mobileUpscaleWarning.style.display = showWarn;
        } else {
            this.infoOriginalLabel.style.display = 'none';
            this.infoOriginal.style.display = 'none';
            this.upscaleWarning.style.display = 'none';
            this.mobileInfoOriginalLabel.style.display = 'none';
            this.mobileInfoOriginal.style.display = 'none';
            this.mobileUpscaleWarning.style.display = 'none';
        }
    }

    // --- EXIF parsing ---

    async parseExif(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const exifData = this.readExifFromBuffer(arrayBuffer);
            this.displayExif(exifData);
        } catch (e) {
            this.exifSection.style.display = 'none';
        }
    }

    readExifFromBuffer(buffer) {
        const view = new DataView(buffer);
        if (view.getUint16(0) !== 0xFFD8) return null; // Not JPEG

        let offset = 2;
        while (offset < view.byteLength - 1) {
            const marker = view.getUint16(offset);
            if (marker === 0xFFE1) { // APP1 (EXIF)
                const length = view.getUint16(offset + 2);
                const exifStart = offset + 4;
                // Check "Exif\0\0"
                if (view.getUint32(exifStart) === 0x45786966 && view.getUint16(exifStart + 4) === 0x0000) {
                    return this.parseTiff(view, exifStart + 6);
                }
                offset += 2 + length;
            } else if ((marker & 0xFF00) === 0xFF00) {
                if (marker === 0xFFDA) break; // Start of scan
                offset += 2 + view.getUint16(offset + 2);
            } else {
                break;
            }
        }
        return null;
    }

    parseTiff(view, tiffStart) {
        const bigEndian = view.getUint16(tiffStart) === 0x4D4D;
        const get16 = (o) => view.getUint16(o, !bigEndian);
        const get32 = (o) => view.getUint32(o, !bigEndian);

        const ifdOffset = get32(tiffStart + 4);
        const tags = {};
        const exifTags = {};

        // Read IFD0
        this.readIFD(view, tiffStart, tiffStart + ifdOffset, get16, get32, tags);

        // Read ExifIFD if present
        if (tags[0x8769]) {
            this.readIFD(view, tiffStart, tiffStart + tags[0x8769], get16, get32, exifTags);
        }

        return { ...tags, ...exifTags };
    }

    readIFD(view, tiffStart, ifdStart, get16, get32, result) {
        try {
            const count = get16(ifdStart);
            for (let i = 0; i < count; i++) {
                const entryOffset = ifdStart + 2 + i * 12;
                const tag = get16(entryOffset);
                const type = get16(entryOffset + 2);
                const numValues = get32(entryOffset + 4);
                const valueOffset = entryOffset + 8;

                if (type === 2) { // ASCII string
                    const strLen = numValues;
                    const strOffset = strLen > 4 ? tiffStart + get32(valueOffset) : valueOffset;
                    let str = '';
                    for (let j = 0; j < strLen - 1; j++) {
                        str += String.fromCharCode(view.getUint8(strOffset + j));
                    }
                    result[tag] = str.trim();
                } else if (type === 3) { // SHORT
                    result[tag] = numValues === 1 ? get16(valueOffset) : get32(valueOffset);
                } else if (type === 4) { // LONG
                    result[tag] = get32(valueOffset);
                } else if (type === 5 || type === 10) { // RATIONAL or SRATIONAL
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

    displayExif(data) {
        if (!data) {
            this.exifSection.style.display = 'none';
            this.mobileExifSection.style.display = 'none';
            return;
        }

        const items = [];

        // Camera make + model (0x010F = Make, 0x0110 = Model)
        const make = data[0x010F] || '';
        const model = data[0x0110] || '';
        if (model) {
            const camera = model.startsWith(make) ? model : (make ? `${make} ${model}` : model);
            items.push(['카메라', camera]);
        }

        // Lens model (0xA434)
        if (data[0xA434]) {
            items.push(['렌즈', data[0xA434]]);
        }

        // Focal length (0x920A)
        if (data[0x920A]) {
            const fl = data[0x920A].value;
            items.push(['초점거리', `${Math.round(fl)}mm`]);
        }

        // F-number (0x829D)
        if (data[0x829D]) {
            const f = data[0x829D].value;
            items.push(['조리개', `f/${f % 1 === 0 ? f.toFixed(0) : f.toFixed(1)}`]);
        }

        // Exposure time (0x829A)
        if (data[0x829A]) {
            const { num, den } = data[0x829A];
            if (num && den) {
                const ss = num / den;
                items.push(['셔터속도', ss >= 1 ? `${ss}s` : `1/${Math.round(den / num)}s`]);
            }
        }

        // ISO (0x8827)
        if (data[0x8827]) {
            items.push(['ISO', `${data[0x8827]}`]);
        }

        // Date taken (0x9003 = DateTimeOriginal, 0x0132 = DateTime)
        const dateStr = data[0x9003] || data[0x0132];
        if (dateStr) {
            const formatted = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1.$2.$3');
            items.push(['촬영일', formatted]);
        }

        // Software (0x0131)
        if (data[0x0131]) {
            items.push(['소프트웨어', data[0x0131]]);
        }

        if (items.length === 0) {
            this.exifSection.style.display = 'none';
            this.mobileExifSection.style.display = 'none';
            return;
        }

        const html = items.map(([label, value]) =>
            `<span class="info-label">${label}</span><span class="info-value">${value}</span>`
        ).join('');
        this.exifGrid.innerHTML = html;
        this.exifSection.style.display = '';
        this.mobileExifGrid.innerHTML = html;
        this.mobileExifSection.style.display = '';
    }

    updateMobilePhotoTab() {
        if (this.image) {
            this.mobilePhotoInfo.style.display = '';
            this.mobilePhotoThumb.src = this.imageUrl;
            this.mobilePhotoName.textContent = this.fileName;
            const sizeStr = this.fileSize < 1024 * 1024
                ? (this.fileSize / 1024).toFixed(1) + ' KB'
                : (this.fileSize / (1024 * 1024)).toFixed(1) + ' MB';
            this.mobilePhotoSize.textContent = `${this.image.naturalWidth} × ${this.image.naturalHeight} px · ${sizeStr}`;
            this.mobilePhotoUploadLabel.textContent = '사진 변경';
            this.mobilePhotoDeleteBtn.style.display = '';
        } else {
            this.mobilePhotoInfo.style.display = 'none';
            this.mobilePhotoUploadLabel.textContent = '사진 추가';
            this.mobilePhotoDeleteBtn.style.display = 'none';
        }
    }

    // --- Mobile tab bar ---

    setupBottomSheet() {
        if (!this.mobileTabBar) return;

        this.activeTab = null;

        // Tab button clicks
        this.mobileTabBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;

            const tab = btn.dataset.tab;

            // Download tab: trigger download directly
            if (tab === 'download') {
                this.download();
                return;
            }

            // Toggle panel: tap active tab to close
            if (this.activeTab === tab) {
                this.closeTabPanel();
            } else {
                this.openTabPanel(tab);
            }
        });

        // Backdrop tap to close
        this.sheetBackdrop.addEventListener('click', () => {
            this.closeTabPanel();
        });

        // Mobile ratio buttons
        document.getElementById('mobile-ratio-buttons').addEventListener('click', (e) => {
            const btn = e.target.closest('.ratio-btn');
            if (!btn) return;
            // Sync both desktop and mobile ratio buttons
            const ratio = btn.dataset.ratio;
            this.ratioButtons.querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratio));
            document.getElementById('mobile-ratio-buttons').querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratio));
            const [w, h] = ratio.split(':').map(Number);
            this.canvasRatio = [w, h];
            this.imageOffset = { x: 0, y: 0 };
            this.updateCanvasSize();
            this.render();
            this.updateInfo();
        });

        // Mobile canvas size
        this.mobileCanvasSizeInput.addEventListener('input', () => {
            const val = parseInt(this.mobileCanvasSizeInput.value);
            if (val >= 100 && val <= 10000) {
                this.canvasSize = val;
                this.canvasSizeInput.value = val;
                this.imageOffset = { x: 0, y: 0 };
                this.updateCanvasSize();
                this.render();
                this.updateInfo();
            }
        });

        // Mobile frame ratio
        this.mobileFrameRatioSlider.addEventListener('input', () => {
            this.frameRatio = parseFloat(this.mobileFrameRatioSlider.value);
            this.mobileFrameRatioInput.value = this.frameRatio;
            this.frameRatioSlider.value = this.frameRatio;
            this.frameRatioInput.value = this.frameRatio;
            this.imageOffset = { x: 0, y: 0 };
            this.render();
            this.updateInfo();
        });

        this.mobileFrameRatioInput.addEventListener('input', () => {
            let val = parseFloat(this.mobileFrameRatioInput.value);
            if (isNaN(val)) return;
            val = Math.max(0, Math.min(25, val));
            this.frameRatio = val;
            this.mobileFrameRatioSlider.value = val;
            this.frameRatioSlider.value = val;
            this.frameRatioInput.value = val;
            this.imageOffset = { x: 0, y: 0 };
            this.render();
            this.updateInfo();
        });

        // Mobile color presets
        this.mobileColorPresets.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;
            const color = swatch.dataset.color;
            // Sync both
            this.colorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
            this.mobileColorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
            this.frameColor = color;
            this.customColorInput.value = color;
            this.mobileCustomColorInput.value = color;
            this.render();
        });

        this.mobileCustomColorInput.addEventListener('input', () => {
            this.frameColor = this.mobileCustomColorInput.value;
            this.customColorInput.value = this.frameColor;
            this.colorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            this.mobileColorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            this.render();
        });

        // Mobile photo upload button
        this.mobilePhotoUploadBtn.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Mobile photo delete button
        this.mobilePhotoDeleteBtn.addEventListener('click', () => {
            this.removeImage();
            this.closeTabPanel();
        });

        // Close panel on resize to desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 900) {
                this.closeTabPanel();
            }
        });
    }

    openTabPanel(tab) {
        this.activeTab = tab;

        // Update tab button active states
        this.mobileTabBar.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Show target panel, hide others
        this.mobileTabPanels.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.tab === tab);
        });

        this.sheetBackdrop.classList.add('active');
    }

    closeTabPanel() {
        this.activeTab = null;
        this.mobileTabBar.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        this.mobileTabPanels.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        this.sheetBackdrop.classList.remove('active');
    }

    // --- Download ---

    download() {
        if (!this.image) return;

        const dims = this.getCanvasDimensions();

        // Use offscreen canvas for clean rendering
        const offscreen = document.createElement('canvas');
        offscreen.width = dims.width;
        offscreen.height = dims.height;
        const ctx = offscreen.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Frame
        ctx.fillStyle = this.frameColor;
        ctx.fillRect(0, 0, dims.width, dims.height);

        // Image
        const photoArea = this.getPhotoArea();
        const draw = this.getDrawDimensions();

        ctx.save();
        ctx.beginPath();
        ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
        ctx.clip();

        const x = photoArea.x + (photoArea.width - draw.width) / 2;
        const y = photoArea.y + (photoArea.height - draw.height) / 2;
        ctx.drawImage(this.image, x, y, draw.width, draw.height);
        ctx.restore();

        // Download as PNG (lossless)
        offscreen.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `framed_${dims.width}x${dims.height}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new PhotoFrameMaker();
});
