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

        this.previewToolbar = document.getElementById('preview-toolbar');
        this.previewRemoveBtn = document.getElementById('preview-remove-btn');

        this.sidebar = document.getElementById('sidebar');
        this.sheetHandle = document.getElementById('sheet-handle');
        this.sheetBackdrop = document.getElementById('sheet-backdrop');
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
            this.ratioButtons.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const [w, h] = btn.dataset.ratio.split(':').map(Number);
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
            this.imageOffset = { x: 0, y: 0 };
            this.render();
            this.updateInfo();
        });

        // Color presets
        this.colorPresets.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;
            this.colorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            this.frameColor = swatch.dataset.color;
            this.customColorInput.value = this.frameColor;
            this.render();
        });

        this.customColorInput.addEventListener('input', () => {
            this.frameColor = this.customColorInput.value;
            this.colorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
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

        const img = new Image();
        img.onload = () => {
            this.image = img;
            this.imageOffset = { x: 0, y: 0 };
            this.updateUploadUI();
            this.render();
            this.updateInfo();
            this.downloadBtn.disabled = false;
            this.previewToolbar.style.display = '';
            this.previewContainer.classList.add('has-image');

            // Auto-expand bottom sheet on mobile
            if (this.sheetState !== undefined && window.innerWidth <= 900) {
                this.setSheetState('half');
            }
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

        // Collapse bottom sheet on mobile
        if (this.sheetState !== undefined && window.innerWidth <= 900) {
            this.setSheetState('collapsed');
        }

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

        if (this.image) {
            this.infoOriginalLabel.style.display = '';
            this.infoOriginal.style.display = '';
            this.infoOriginal.textContent = `${this.image.naturalWidth} × ${this.image.naturalHeight} px`;

            // Check if upscaling
            const draw = this.getDrawDimensions();
            const scaleX = draw.width / this.image.naturalWidth;
            const scaleY = draw.height / this.image.naturalHeight;
            const scale = Math.min(scaleX, scaleY);

            if (scale > 1.5) {
                this.upscaleWarning.style.display = '';
            } else {
                this.upscaleWarning.style.display = 'none';
            }
        } else {
            this.infoOriginalLabel.style.display = 'none';
            this.infoOriginal.style.display = 'none';
            this.upscaleWarning.style.display = 'none';
        }
    }

    // --- Bottom Sheet (mobile) ---

    setupBottomSheet() {
        if (!this.sheetHandle) return;

        this.sheetState = 'collapsed';
        let startY, startTranslateY, moved, isDraggingSheet;

        const getTranslateY = () => {
            const style = getComputedStyle(this.sidebar);
            const matrix = new DOMMatrix(style.transform);
            return matrix.m42;
        };

        const isMobile = () => window.innerWidth <= 900;

        // Touch drag on handle
        this.sheetHandle.addEventListener('touchstart', (e) => {
            if (!isMobile()) return;
            startY = e.touches[0].clientY;
            startTranslateY = getTranslateY();
            moved = false;
            isDraggingSheet = true;
            this.sidebar.style.transition = 'none';
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isDraggingSheet) return;
            const dy = e.touches[0].clientY - startY;
            if (Math.abs(dy) > 5) moved = true;
            const newY = Math.max(0, startTranslateY + dy);
            this.sidebar.style.transform = `translateY(${newY}px)`;

            // Update backdrop opacity proportionally
            const maxY = this.sidebar.offsetHeight - 48;
            const progress = 1 - Math.min(1, newY / maxY);
            this.sheetBackdrop.style.opacity = progress * 0.4;
            this.sheetBackdrop.style.pointerEvents = progress > 0.05 ? 'auto' : 'none';
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (!isDraggingSheet) return;
            isDraggingSheet = false;
            this.sidebar.style.transition = '';

            if (!moved) {
                this.toggleSheet();
                return;
            }

            this.snapSheet(getTranslateY());
        });

        // Mouse click on handle (desktop testing)
        this.sheetHandle.addEventListener('click', () => {
            if (!isMobile()) return;
            if (!('ontouchstart' in window)) {
                this.toggleSheet();
            }
        });

        // Backdrop tap to collapse
        this.sheetBackdrop.addEventListener('click', () => {
            this.setSheetState('collapsed');
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (!isMobile()) {
                this.sidebar.style.transform = '';
                this.sidebar.classList.remove('sheet-expanded');
                this.sheetBackdrop.classList.remove('active');
                this.sheetBackdrop.style.opacity = '';
                this.sheetBackdrop.style.pointerEvents = '';
            } else {
                this.setSheetState(this.sheetState);
            }
        });

        // Set initial collapsed state on mobile
        if (isMobile()) {
            requestAnimationFrame(() => this.setSheetState('collapsed'));
        }
    }

    toggleSheet() {
        this.setSheetState(this.sheetState === 'collapsed' ? 'half' : 'collapsed');
    }

    snapSheet(currentY) {
        const height = this.sidebar.offsetHeight;
        const vh = window.innerHeight;

        const snaps = [
            { state: 'collapsed', y: height - 48 },
            { state: 'half', y: Math.max(0, height - vh * 0.55) },
            { state: 'full', y: 0 }
        ];

        let nearest = snaps[0];
        for (const s of snaps) {
            if (Math.abs(currentY - s.y) < Math.abs(currentY - nearest.y)) {
                nearest = s;
            }
        }

        this.setSheetState(nearest.state);
    }

    setSheetState(state) {
        this.sheetState = state;
        const height = this.sidebar.offsetHeight;
        const vh = window.innerHeight;

        this.sidebar.classList.remove('sheet-open');
        this.sheetBackdrop.style.opacity = '';
        this.sheetBackdrop.style.pointerEvents = '';

        switch (state) {
            case 'collapsed':
                this.sidebar.style.transform = `translateY(${height - 48}px)`;
                this.sheetBackdrop.classList.remove('active');
                break;
            case 'half':
                this.sidebar.style.transform = `translateY(${Math.max(0, height - vh * 0.55)}px)`;
                this.sidebar.classList.add('sheet-open');
                this.sheetBackdrop.classList.add('active');
                break;
            case 'full':
                this.sidebar.style.transform = 'translateY(0)';
                this.sidebar.classList.add('sheet-open');
                this.sheetBackdrop.classList.add('active');
                break;
        }
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
