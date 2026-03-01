class PhotoFrameMaker {
    constructor() {
        // Multi-image array (max 10)
        this.images = [];
        this.currentIndex = 0;

        this.canvasRatio = [1, 1];
        this.canvasSize = 1000;
        this.frameRatio = 5;
        this.frameColor = '#FFFFFF';
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragStartOffset = { x: 0, y: 0 };

        // Swipe navigation tracking
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.touchMoved = false;

        // Feed swipe tracking
        this.feedTouchStartX = 0;
        this.feedTouchStartY = 0;
        this.feedTouchStartTime = 0;

        this.previewMode = 'default';

        this.canvas = document.getElementById('preview-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.previewContainer = document.getElementById('preview-container');

        this.init();
    }

    // --- Convenience getters ---

    get currentImage() {
        return this.images[this.currentIndex] || null;
    }

    get imageCount() {
        return this.images.length;
    }

    get loadedImages() {
        return this.images.filter(item => item !== null);
    }

    get hasImage() {
        return this.loadedImages.length > 0;
    }

    get hasMultipleImages() {
        return this.loadedImages.length > 1;
    }

    init() {
        this.bindElements();
        this.setupEventListeners();
        this.updateCanvasSize();
        this.render();
        this.updateInfo();
        this.setupBottomSheet();

        // Ensure correct initial state
        this.previewToolbar.style.display = 'none';
        this.thumbnailStrip.style.display = 'none';
        this.downloadBtn.disabled = true;
        this.mobileDownloadBtn.disabled = true;
        this.previewContainer.classList.remove('has-image');
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
        this.previewModeToggle = document.getElementById('preview-mode-toggle');
        this.feedMockup = document.getElementById('feed-mockup');
        this.feedImage = document.getElementById('feed-image');
        this.feedNavPrevBtn = document.getElementById('feed-nav-prev');
        this.feedNavNextBtn = document.getElementById('feed-nav-next');
        this.feedDots = document.getElementById('feed-dots');
        this.profileMockup = document.getElementById('profile-mockup');
        this.profileGrid = document.getElementById('profile-grid');
        this.profileGridImage = document.getElementById('profile-grid-image');

        this.sidebar = document.getElementById('sidebar');
        this.sheetHandle = document.getElementById('sheet-handle');
        this.sheetBackdrop = document.getElementById('sheet-backdrop');

        // Canvas navigation arrows
        this.navPrevBtn = document.getElementById('canvas-nav-prev');
        this.navNextBtn = document.getElementById('canvas-nav-next');

        // Thumbnail strip
        this.thumbnailStrip = document.getElementById('thumbnail-strip');
        this.thumbnailList = document.getElementById('thumbnail-list');
        this.thumbnailAddBtn = document.getElementById('thumbnail-add-btn');
        this.thumbnailCounter = document.getElementById('thumbnail-counter');

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
            if (e.target.files.length > 0) this.loadImages(e.target.files);
        });

        // Drag and drop on upload zone
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
            if (e.dataTransfer.files.length > 0) this.loadImages(e.dataTransfer.files);
        });

        // Paste
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    this.loadImages([item.getAsFile()]);
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
            this.resetAllOffsets();
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
                this.resetAllOffsets();
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
            this.resetAllOffsets();
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
            this.resetAllOffsets();
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
            if (e.touches.length === 1 && this.hasImage) {
                e.preventDefault();
                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
                this.touchStartTime = Date.now();
                this.touchMoved = false;
                this.onDragStart(e.touches[0]);
            }
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.hasImage) {
                e.preventDefault();
                this.touchMoved = true;
                this.onDragMove(e.touches[0]);
            }
        }, { passive: false });
        document.addEventListener('touchend', (e) => {
            if (this.isDragging && this.hasMultipleImages) {
                const touch = e.changedTouches && e.changedTouches[0];
                if (touch) {
                    const dx = touch.clientX - this.touchStartX;
                    const dy = touch.clientY - this.touchStartY;
                    const dt = Date.now() - this.touchStartTime;
                    const absDx = Math.abs(dx);
                    const absDy = Math.abs(dy);

                    // Swipe: quick horizontal gesture (< 300ms, > 50px horizontal, more horizontal than vertical)
                    if (dt < 300 && absDx > 50 && absDx > absDy * 1.5) {
                        // Undo the drag offset that was applied during the swipe
                        if (this.currentImage) {
                            this.currentImage.imageOffset.x = this.dragStartOffset.x;
                            this.currentImage.imageOffset.y = this.dragStartOffset.y;
                        }
                        if (dx > 0) {
                            this.navigatePrev();
                        } else {
                            this.navigateNext();
                        }
                        this.isDragging = false;
                        return;
                    }
                }
            }
            this.onDragEnd();
        });

        // Preview area click to upload (when no image)
        this.previewContainer.addEventListener('click', (e) => {
            if (!this.hasImage) {
                this.fileInput.style.top = e.clientY + 'px';
                this.fileInput.style.left = e.clientX + 'px';
                this.fileInput.click();
            }
        });

        // Preview area drag and drop (always allow adding more)
        this.previewContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.previewContainer.classList.add('drag-over');
        });
        this.previewContainer.addEventListener('dragleave', () => {
            this.previewContainer.classList.remove('drag-over');
        });
        this.previewContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            this.previewContainer.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) this.loadImages(e.dataTransfer.files);
        });

        // Preview mode toggle
        this.previewModeToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.preview-mode-btn');
            if (!btn) return;
            const mode = btn.dataset.mode;
            if (mode === this.previewMode) return;
            this.previewMode = mode;
            this.previewModeToggle.querySelectorAll('.preview-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
            this.updatePreviewMode();
        });

        // Download
        this.downloadBtn.addEventListener('click', () => this.download());

        // Canvas navigation arrows
        this.navPrevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigatePrev();
        });
        this.navNextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateNext();
        });

        // Feed navigation arrows
        this.feedNavPrevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigatePrev();
        });
        this.feedNavNextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateNext();
        });

        // Feed image swipe navigation (mobile)
        this.feedImage.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1 && this.hasMultipleImages) {
                this.feedTouchStartX = e.touches[0].clientX;
                this.feedTouchStartY = e.touches[0].clientY;
                this.feedTouchStartTime = Date.now();
            }
        }, { passive: true });
        this.feedImage.addEventListener('touchend', (e) => {
            if (!this.hasMultipleImages) return;
            const touch = e.changedTouches && e.changedTouches[0];
            if (!touch) return;
            const dx = touch.clientX - this.feedTouchStartX;
            const dy = touch.clientY - this.feedTouchStartY;
            const dt = Date.now() - this.feedTouchStartTime;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if (dt < 300 && absDx > 50 && absDx > absDy * 1.5) {
                e.preventDefault();
                if (dx > 0) {
                    this.navigatePrev();
                } else {
                    this.navigateNext();
                }
            }
        });

        // Thumbnail strip events
        this.thumbnailList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.thumbnail-remove');
            if (removeBtn) {
                e.stopPropagation();
                this.removeImageAt(parseInt(removeBtn.dataset.index));
                return;
            }
            const item = e.target.closest('.thumbnail-item');
            if (item) {
                this.selectImage(parseInt(item.dataset.index));
            }
        });

        this.thumbnailAddBtn.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Resize: recalculate preview container size
        window.addEventListener('resize', () => this.updatePreviewContainerSize());
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

    getDrawDimensions(img) {
        const image = img || (this.currentImage && this.currentImage.image);
        if (!image) return { width: 0, height: 0 };
        const photoArea = this.getPhotoArea();
        if (photoArea.width === 0 || photoArea.height === 0) return { width: 0, height: 0 };

        const imgRatio = image.naturalWidth / image.naturalHeight;
        const areaRatio = photoArea.width / photoArea.height;

        // Cover mode: fill entire photo area, allowing drag to reposition
        let drawWidth, drawHeight;
        if (imgRatio > areaRatio) {
            drawHeight = photoArea.height;
            drawWidth = drawHeight * imgRatio;
        } else {
            drawWidth = photoArea.width;
            drawHeight = drawWidth / imgRatio;
        }
        return { width: drawWidth, height: drawHeight };
    }

    // --- Canvas size update ---

    updateCanvasSize() {
        const dims = this.getCanvasDimensions();
        this.canvas.width = dims.width;
        this.canvas.height = dims.height;
        this.updatePreviewContainerSize();
    }

    updatePreviewContainerSize() {
        const [w, h] = this.canvasRatio;
        const ratio = w / h;

        const parent = this.previewContainer.parentElement;
        const parentWidth = parent.clientWidth;
        if (parentWidth <= 0) return;

        const cs = getComputedStyle(this.previewContainer);
        const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);

        const isMobile = window.innerWidth <= 900;

        let maxH;
        if (isMobile) {
            const parentCS = getComputedStyle(parent);
            const parentPadY = parseFloat(parentCS.paddingTop) + parseFloat(parentCS.paddingBottom);
            const contentH = parent.clientHeight - parentPadY;
            const toolbarH = this.previewToolbar.offsetHeight || 0;
            const stripH = this.thumbnailStrip.offsetHeight || 0;
            const gap = parseFloat(parentCS.gap) || 0;
            maxH = contentH - toolbarH - stripH - gap * 2;
        } else {
            maxH = window.innerHeight * 0.75;
        }

        const availW = parentWidth - padX;
        const availH = maxH - padY;

        if (availW <= 0 || availH <= 0) return;

        let cw, ch;
        if (availW / availH > ratio) {
            ch = availH;
            cw = ch * ratio;
        } else {
            cw = availW;
            ch = cw / ratio;
        }

        this.previewContainer.style.width = Math.round(cw + padX) + 'px';
        this.previewContainer.style.height = Math.round(ch + padY) + 'px';

        if (isMobile) {
            this.previewContainer.style.marginLeft = 'auto';
            this.previewContainer.style.marginRight = 'auto';
        } else {
            this.previewContainer.style.marginLeft = '';
            this.previewContainer.style.marginRight = '';
        }
    }

    // --- Rendering ---

    render() {
        const dims = this.getCanvasDimensions();
        this.ctx.clearRect(0, 0, dims.width, dims.height);

        // Draw frame (background color)
        this.ctx.fillStyle = this.frameColor;
        this.ctx.fillRect(0, 0, dims.width, dims.height);

        // Draw image or placeholder
        if (this.currentImage) {
            this.drawImage();
        } else {
            this.drawPlaceholder();
        }

        this.updateMockupImages();
    }

    drawImage() {
        const cur = this.currentImage;
        if (!cur) return;

        const photoArea = this.getPhotoArea();
        if (photoArea.width === 0 || photoArea.height === 0) return;

        const draw = this.getDrawDimensions(cur.image);
        if (draw.width === 0 || draw.height === 0) return;

        this.ctx.save();
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Clip to photo area
        this.ctx.beginPath();
        this.ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
        this.ctx.clip();

        const x = photoArea.x + (photoArea.width - draw.width) / 2 + cur.imageOffset.x;
        const y = photoArea.y + (photoArea.height - draw.height) / 2 + cur.imageOffset.y;

        this.ctx.drawImage(cur.image, x, y, draw.width, draw.height);
        this.ctx.restore();
    }

    drawPlaceholder() {
        const photoArea = this.getPhotoArea();
        if (photoArea.width <= 0 || photoArea.height <= 0) return;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        this.ctx.fillRect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
    }

    // --- Preview mode ---

    updatePreviewMode() {
        const isFeed = this.previewMode === 'feed';
        const isProfile = this.previewMode === 'profile';
        this.previewContainer.style.display = (isFeed || isProfile) ? 'none' : '';
        this.feedMockup.style.display = isFeed ? '' : 'none';
        this.profileMockup.style.display = isProfile ? '' : 'none';
        if (isFeed || isProfile) this.updateMockupImages();
    }

    updateMockupImages() {
        if (this.previewMode === 'default') return;
        const dataUrl = this.canvas.toDataURL('image/png');
        if (this.previewMode === 'feed') {
            this.feedImage.src = dataUrl;
        } else if (this.previewMode === 'profile') {
            this.updateProfileGrid();
        }
    }

    updateProfileGrid() {
        const totalCells = 9;
        const loaded = this.loadedImages;
        if (loaded.length <= 1) {
            // Single image: center position (index 4)
            this.profileGrid.innerHTML = '';
            for (let i = 0; i < totalCells; i++) {
                if (i === 4) {
                    const div = document.createElement('div');
                    div.className = 'profile-grid-item target';
                    const img = document.createElement('img');
                    img.className = 'profile-grid-image';
                    img.id = 'profile-grid-image';
                    img.src = this.canvas.toDataURL('image/png');
                    img.alt = '';
                    div.appendChild(img);
                    this.profileGrid.appendChild(div);
                } else {
                    const div = document.createElement('div');
                    div.className = 'profile-grid-item placeholder';
                    this.profileGrid.appendChild(div);
                }
            }
            this.profileGridImage = document.getElementById('profile-grid-image');
        } else {
            // Multiple images: fill from top-left
            this.profileGrid.innerHTML = '';
            const savedIndex = this.currentIndex;
            const savedCanvas = document.createElement('canvas');
            savedCanvas.width = this.canvas.width;
            savedCanvas.height = this.canvas.height;
            savedCanvas.getContext('2d').drawImage(this.canvas, 0, 0);

            for (let i = 0; i < totalCells; i++) {
                const div = document.createElement('div');
                const item = this.images[i];
                if (i < this.images.length && item) {
                    div.className = 'profile-grid-item target' + (i === savedIndex ? ' current' : '');
                    const img = document.createElement('img');
                    img.className = 'profile-grid-image';
                    img.alt = '';
                    if (i === savedIndex) {
                        img.src = savedCanvas.toDataURL('image/png');
                    } else {
                        // Render other images to temp canvas
                        const tempCanvas = document.createElement('canvas');
                        const dims = this.getCanvasDimensions();
                        tempCanvas.width = dims.width;
                        tempCanvas.height = dims.height;
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.fillStyle = this.frameColor;
                        tempCtx.fillRect(0, 0, dims.width, dims.height);

                        const photoArea = this.getPhotoArea();
                        const draw = this.getDrawDimensions(item.image);

                        tempCtx.save();
                        tempCtx.beginPath();
                        tempCtx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
                        tempCtx.clip();
                        const x = photoArea.x + (photoArea.width - draw.width) / 2 + item.imageOffset.x;
                        const y = photoArea.y + (photoArea.height - draw.height) / 2 + item.imageOffset.y;
                        tempCtx.imageSmoothingEnabled = true;
                        tempCtx.imageSmoothingQuality = 'high';
                        tempCtx.drawImage(item.image, x, y, draw.width, draw.height);
                        tempCtx.restore();

                        img.src = tempCanvas.toDataURL('image/png');
                    }
                    div.appendChild(img);
                } else {
                    div.className = 'profile-grid-item placeholder';
                }
                this.profileGrid.appendChild(div);
            }
        }
    }

    // --- Image loading (multi) ---

    loadImages(files) {
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        const available = 10 - this.images.length;
        if (available <= 0) {
            this.showToast('최대 10장까지 가능합니다.');
            return;
        }

        if (imageFiles.length > available) {
            this.showToast(`최대 10장까지 가능합니다. ${available}장만 추가됩니다.`);
        }

        const filesToLoad = imageFiles.slice(0, available);
        const firstNewIndex = this.images.length;

        // Pre-allocate slots to preserve file order
        const slots = filesToLoad.map(() => {
            const placeholder = null;
            this.images.push(placeholder);
            return this.images.length - 1;
        });

        this.currentIndex = firstNewIndex;
        let loadedCount = 0;

        filesToLoad.forEach((file, i) => {
            const slotIndex = slots[i];
            const imageUrl = URL.createObjectURL(file);
            const img = new Image();

            img.onload = () => {
                const item = {
                    image: img,
                    imageUrl: imageUrl,
                    fileName: file.name,
                    fileSize: file.size,
                    imageOffset: { x: 0, y: 0 },
                    exifData: null
                };

                this.images[slotIndex] = item;
                loadedCount++;

                // Parse EXIF async
                this.parseExifForItem(file, item);

                // Remove remaining null placeholders when all loaded
                if (loadedCount === filesToLoad.length) {
                    this.images = this.images.filter(item => item !== null);
                    // Recalculate currentIndex if needed
                    if (this.currentIndex >= this.images.length) {
                        this.currentIndex = Math.max(0, this.images.length - 1);
                    }
                }

                this.onImagesChanged();
            };
            img.onerror = () => {
                URL.revokeObjectURL(imageUrl);
                this.images[slotIndex] = null;
                loadedCount++;

                // Clean up null slots when all done
                if (loadedCount === filesToLoad.length) {
                    this.images = this.images.filter(item => item !== null);
                    if (this.currentIndex >= this.images.length) {
                        this.currentIndex = Math.max(0, this.images.length - 1);
                    }
                    this.onImagesChanged();
                }
            };
            img.src = imageUrl;
        });
    }

    async parseExifForItem(file, item) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            item.exifData = this.readExifFromBuffer(arrayBuffer);
            // If this item is currently selected, update EXIF display
            if (this.currentImage === item) {
                this.displayExif(item.exifData);
            }
        } catch (e) {
            // Ignore EXIF parse errors
        }
    }

    // --- Image selection ---

    selectImage(index) {
        if (index < 0 || index >= this.images.length) return;
        if (index === this.currentIndex) return;
        this.currentIndex = index;

        this.updateThumbnailStrip();
        this.updateNavArrows();
        this.render();
        this.updateInfo();
        this.updateUploadUI();
        this.updateMobilePhotoTab();
        if (this.currentImage) {
            this.displayExif(this.currentImage.exifData);
        }
    }

    // --- Canvas navigation ---

    navigatePrev() {
        if (this.currentIndex > 0) {
            this.selectImage(this.currentIndex - 1);
        }
    }

    navigateNext() {
        if (this.currentIndex < this.images.length - 1) {
            this.selectImage(this.currentIndex + 1);
        }
    }

    updateNavArrows() {
        const show = this.hasMultipleImages;
        const showPrev = show && this.currentIndex > 0;
        const showNext = show && this.currentIndex < this.images.length - 1;
        this.navPrevBtn.classList.toggle('visible', showPrev);
        this.navNextBtn.classList.toggle('visible', showNext);
        this.feedNavPrevBtn.classList.toggle('visible', showPrev);
        this.feedNavNextBtn.classList.toggle('visible', showNext);
        this.updateFeedDots();
    }

    updateFeedDots() {
        if (!this.hasMultipleImages) {
            this.feedDots.style.display = 'none';
            return;
        }
        this.feedDots.style.display = '';
        this.feedDots.innerHTML = this.images.map((item, i) =>
            item ? `<div class="feed-dot${i === this.currentIndex ? ' active' : ''}"></div>` : ''
        ).join('');
    }

    // --- Image removal ---

    removeImage() {
        if (this.images.length === 0) return;
        this.removeImageAt(this.currentIndex);
    }

    removeImageAt(index) {
        if (index < 0 || index >= this.images.length) return;

        const removed = this.images.splice(index, 1)[0];
        URL.revokeObjectURL(removed.imageUrl);

        // Adjust current index
        if (this.images.length === 0) {
            this.currentIndex = 0;
        } else if (this.currentIndex >= this.images.length) {
            this.currentIndex = this.images.length - 1;
        } else if (index < this.currentIndex) {
            this.currentIndex--;
        }

        this.fileInput.value = '';
        this.onImagesChanged();
    }

    // --- Central update after images change ---

    onImagesChanged() {
        const has = this.hasImage;

        this.updateThumbnailStrip();
        this.updateNavArrows();
        this.updateUploadUI();
        this.updateDownloadButton();
        this.render();
        this.updateInfo();
        this.updateMobilePhotoTab();

        this.downloadBtn.disabled = !has;
        this.mobileDownloadBtn.disabled = !has;
        this.previewToolbar.style.display = has ? '' : 'none';
        this.previewContainer.classList.toggle('has-image', has);

        this.updatePreviewContainerSize();

        if (!has) {
            this.exifSection.style.display = 'none';
            this.exifGrid.innerHTML = '';
            this.mobileExifSection.style.display = 'none';
            this.mobileExifGrid.innerHTML = '';

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
        } else {
            this.displayExif(this.currentImage.exifData);
        }

        this.updatePreviewContainerSize();
    }

    // --- Reset all offsets ---

    resetAllOffsets() {
        this.images.forEach(item => {
            if (item) item.imageOffset = { x: 0, y: 0 };
        });
    }

    // --- Thumbnail strip ---

    updateThumbnailStrip() {
        const loaded = this.loadedImages;
        if (loaded.length <= 1) {
            this.thumbnailStrip.style.display = 'none';
            return;
        }

        this.thumbnailStrip.style.display = '';
        this.thumbnailCounter.textContent = `${this.currentIndex + 1}/${this.images.length}`;
        this.thumbnailAddBtn.style.display = this.images.length >= 10 ? 'none' : '';

        this.thumbnailList.innerHTML = this.images.map((item, i) => {
            if (!item) return '';
            return `
            <div class="thumbnail-item ${i === this.currentIndex ? 'active' : ''}" data-index="${i}">
                <img src="${item.imageUrl}" alt="${item.fileName}">
                <button class="thumbnail-remove" data-index="${i}" type="button">&times;</button>
            </div>`;
        }).join('');

        // Scroll active thumbnail into view
        requestAnimationFrame(() => {
            const activeThumb = this.thumbnailList.querySelector('.thumbnail-item.active');
            if (activeThumb) {
                activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        });
    }

    // --- Upload UI ---

    updateUploadUI() {
        const cur = this.currentImage;
        if (!cur) return;

        this.uploadZone.classList.add('has-image');
        const sizeStr = cur.fileSize < 1024 * 1024
            ? (cur.fileSize / 1024).toFixed(1) + ' KB'
            : (cur.fileSize / (1024 * 1024)).toFixed(1) + ' MB';

        const countLabel = this.hasMultipleImages ? ` (${this.currentIndex + 1}/${this.imageCount})` : '';

        this.uploadContent.innerHTML = `
            <img class="upload-thumb" src="${cur.imageUrl}" alt="미리보기">
            <div class="upload-info">
                <div class="upload-filename">${cur.fileName}${countLabel}</div>
                <div class="upload-filesize">${cur.image.naturalWidth} × ${cur.image.naturalHeight} px · ${sizeStr}</div>
                <div class="upload-hint" style="display:block; margin-top:2px;">클릭하여 추가</div>
            </div>
            <span id="upload-remove-btn" title="사진 삭제" style="flex-shrink:0; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:rgba(0,0,0,0.1); color:#6b7280; font-size:18px; cursor:pointer; line-height:1;">&times;</span>
        `;

        document.getElementById('upload-remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeImage();
        });
    }

    // --- Download button label ---

    updateDownloadButton() {
        const label = this.hasMultipleImages
            ? `ZIP 다운로드 (${this.imageCount}장)`
            : 'PNG 다운로드 (무손실)';

        const btnLabel = this.downloadBtn.querySelector('.btn-label');
        if (btnLabel) btnLabel.textContent = label;

        // Mobile tab label
        const mobileLabel = this.mobileTabBar?.querySelector('[data-tab="download"] span');
        if (mobileLabel) {
            mobileLabel.textContent = this.hasMultipleImages ? 'ZIP' : '저장';
        }
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
        if (!this.currentImage) return;
        const coords = this.getCanvasCoords(e);
        if (!this.isInPhotoArea(coords)) return;

        this.isDragging = true;
        this.dragStart = coords;
        this.dragStartOffset = { ...this.currentImage.imageOffset };
        this.canvas.style.cursor = 'grabbing';
    }

    onDragMove(e) {
        if (!this.currentImage) return;

        const coords = this.getCanvasCoords(e);

        if (!this.isDragging) {
            this.canvas.style.cursor = this.isInPhotoArea(coords) ? 'grab' : 'default';
            return;
        }

        const dx = coords.x - this.dragStart.x;
        const dy = coords.y - this.dragStart.y;

        this.currentImage.imageOffset = {
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
        const cur = this.currentImage;
        if (!cur) return;

        const photoArea = this.getPhotoArea();
        const draw = this.getDrawDimensions(cur.image);

        const maxOffsetX = Math.max(0, (draw.width - photoArea.width) / 2);
        const maxOffsetY = Math.max(0, (draw.height - photoArea.height) / 2);

        cur.imageOffset.x = Math.max(-maxOffsetX, Math.min(maxOffsetX, cur.imageOffset.x));
        cur.imageOffset.y = Math.max(-maxOffsetY, Math.min(maxOffsetY, cur.imageOffset.y));
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

        const cur = this.currentImage;
        if (cur) {
            const origText = `${cur.image.naturalWidth} × ${cur.image.naturalHeight} px`;
            this.infoOriginalLabel.style.display = '';
            this.infoOriginal.style.display = '';
            this.infoOriginal.textContent = origText;
            this.mobileInfoOriginalLabel.style.display = '';
            this.mobileInfoOriginal.style.display = '';
            this.mobileInfoOriginal.textContent = origText;

            const draw = this.getDrawDimensions(cur.image);
            const scaleX = draw.width / cur.image.naturalWidth;
            const scaleY = draw.height / cur.image.naturalHeight;
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

    readExifFromBuffer(buffer) {
        const view = new DataView(buffer);
        if (view.getUint16(0) !== 0xFFD8) return null;

        let offset = 2;
        while (offset < view.byteLength - 1) {
            const marker = view.getUint16(offset);
            if (marker === 0xFFE1) {
                const length = view.getUint16(offset + 2);
                const exifStart = offset + 4;
                if (view.getUint32(exifStart) === 0x45786966 && view.getUint16(exifStart + 4) === 0x0000) {
                    return this.parseTiff(view, exifStart + 6);
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

    parseTiff(view, tiffStart) {
        const bigEndian = view.getUint16(tiffStart) === 0x4D4D;
        const get16 = (o) => view.getUint16(o, !bigEndian);
        const get32 = (o) => view.getUint32(o, !bigEndian);

        const ifdOffset = get32(tiffStart + 4);
        const tags = {};
        const exifTags = {};

        this.readIFD(view, tiffStart, tiffStart + ifdOffset, get16, get32, tags);

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

    displayExif(data) {
        if (!data) {
            this.exifSection.style.display = 'none';
            this.mobileExifSection.style.display = 'none';
            return;
        }

        const items = [];

        const make = data[0x010F] || '';
        const model = data[0x0110] || '';
        if (model) {
            const camera = model.startsWith(make) ? model : (make ? `${make} ${model}` : model);
            items.push(['카메라', camera]);
        }

        if (data[0xA434]) {
            items.push(['렌즈', data[0xA434]]);
        }

        if (data[0x920A]) {
            const fl = data[0x920A].value;
            items.push(['초점거리', `${Math.round(fl)}mm`]);
        }

        if (data[0x829D]) {
            const f = data[0x829D].value;
            items.push(['조리개', `f/${f % 1 === 0 ? f.toFixed(0) : f.toFixed(1)}`]);
        }

        if (data[0x829A]) {
            const { num, den } = data[0x829A];
            if (num && den) {
                const ss = num / den;
                items.push(['셔터속도', ss >= 1 ? `${ss}s` : `1/${Math.round(den / num)}s`]);
            }
        }

        if (data[0x8827]) {
            items.push(['ISO', `${data[0x8827]}`]);
        }

        const dateStr = data[0x9003] || data[0x0132];
        if (dateStr) {
            const formatted = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1.$2.$3');
            items.push(['촬영일', formatted]);
        }

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
        const cur = this.currentImage;
        if (cur) {
            this.mobilePhotoInfo.style.display = '';
            this.mobilePhotoThumb.src = cur.imageUrl;
            this.mobilePhotoName.textContent = cur.fileName;
            const sizeStr = cur.fileSize < 1024 * 1024
                ? (cur.fileSize / 1024).toFixed(1) + ' KB'
                : (cur.fileSize / (1024 * 1024)).toFixed(1) + ' MB';
            this.mobilePhotoSize.textContent = `${cur.image.naturalWidth} × ${cur.image.naturalHeight} px · ${sizeStr}`;
            this.mobilePhotoUploadLabel.textContent = '사진 추가';
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

        this.mobileTabBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;

            const tab = btn.dataset.tab;

            if (tab === 'download') {
                this.download();
                return;
            }

            if (this.activeTab === tab) {
                this.closeTabPanel();
            } else {
                this.openTabPanel(tab);
            }
        });

        this.sheetBackdrop.addEventListener('click', () => {
            this.closeTabPanel();
        });

        // Mobile ratio buttons
        document.getElementById('mobile-ratio-buttons').addEventListener('click', (e) => {
            const btn = e.target.closest('.ratio-btn');
            if (!btn) return;
            const ratio = btn.dataset.ratio;
            this.ratioButtons.querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratio));
            document.getElementById('mobile-ratio-buttons').querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratio));
            const [w, h] = ratio.split(':').map(Number);
            this.canvasRatio = [w, h];
            this.resetAllOffsets();
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
                this.resetAllOffsets();
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
            this.resetAllOffsets();
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
            this.resetAllOffsets();
            this.render();
            this.updateInfo();
        });

        // Mobile color presets
        this.mobileColorPresets.addEventListener('click', (e) => {
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
            if (!this.hasImage) this.closeTabPanel();
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

        this.mobileTabBar.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

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

    async download() {
        if (!this.hasImage) return;

        if (this.hasMultipleImages) {
            await this.downloadAsZip();
        } else {
            await this.downloadSingle();
        }
    }

    async downloadSingle() {
        const cur = this.currentImage;
        if (!cur) return;

        const dims = this.getCanvasDimensions();
        const offscreen = document.createElement('canvas');
        offscreen.width = dims.width;
        offscreen.height = dims.height;
        const ctx = offscreen.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.fillStyle = this.frameColor;
        ctx.fillRect(0, 0, dims.width, dims.height);

        const photoArea = this.getPhotoArea();
        const draw = this.getDrawDimensions(cur.image);

        ctx.save();
        ctx.beginPath();
        ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
        ctx.clip();

        const x = photoArea.x + (photoArea.width - draw.width) / 2 + cur.imageOffset.x;
        const y = photoArea.y + (photoArea.height - draw.height) / 2 + cur.imageOffset.y;
        ctx.drawImage(cur.image, x, y, draw.width, draw.height);
        ctx.restore();

        const dataURL = offscreen.toDataURL('image/png');
        const binary = atob(dataURL.split(',')[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([array], { type: 'image/png' });

        const baseName = cur.fileName ? cur.fileName.replace(/\.[^.]+$/, '') : 'photo';
        const fileName = `${baseName}_pfm.png`;

        // 1) Mobile: Try Web Share API, then fallback to save overlay
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            try {
                const file = new File([blob], fileName, { type: 'image/png' });
                if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file] });
                    return;
                }
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
            this.showSaveOverlay(blob);
            return;
        }

        // 2) Desktop download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async downloadAsZip() {
        if (typeof JSZip === 'undefined') {
            this.showToast('ZIP 라이브러리 로딩 중... 잠시 후 다시 시도해주세요.');
            // Try loading JSZip dynamically
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            document.head.appendChild(script);
            return;
        }

        const zip = new JSZip();
        const total = this.images.length;
        const dims = this.getCanvasDimensions();
        const photoArea = this.getPhotoArea();

        this.showProgress(0, total);

        // Track filename duplicates
        const nameCount = {};

        for (let i = 0; i < total; i++) {
            const item = this.images[i];
            this.showProgress(i + 1, total);

            const blob = this.renderItemToBlob(item, dims, photoArea);

            // Generate unique filename
            const baseName = item.fileName ? item.fileName.replace(/\.[^.]+$/, '') : 'photo';
            let zipName = `${baseName}_pfm.png`;
            if (nameCount[zipName]) {
                nameCount[zipName]++;
                zipName = `${baseName}_pfm(${nameCount[zipName]}).png`;
            } else {
                nameCount[zipName] = 1;
            }

            zip.file(zipName, blob);
        }

        this.showProgress(total, total, '압축 중...');

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 1 }
        });

        const fileName = `photoframe_${total}장_pfm.zip`;

        // Mobile: try share for ZIP
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            try {
                const file = new File([zipBlob], fileName, { type: 'application/zip' });
                if (navigator.canShare?.({ files: [file] })) {
                    this.hideProgress();
                    await navigator.share({ files: [file] });
                    return;
                }
            } catch (e) {
                if (e.name === 'AbortError') {
                    this.hideProgress();
                    return;
                }
            }
        }

        // Desktop / fallback download
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.hideProgress();
    }

    renderItemToBlob(item, dims, photoArea) {
        const offscreen = document.createElement('canvas');
        offscreen.width = dims.width;
        offscreen.height = dims.height;
        const ctx = offscreen.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.fillStyle = this.frameColor;
        ctx.fillRect(0, 0, dims.width, dims.height);

        const draw = this.getDrawDimensions(item.image);

        ctx.save();
        ctx.beginPath();
        ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
        ctx.clip();

        const x = photoArea.x + (photoArea.width - draw.width) / 2 + item.imageOffset.x;
        const y = photoArea.y + (photoArea.height - draw.height) / 2 + item.imageOffset.y;
        ctx.drawImage(item.image, x, y, draw.width, draw.height);
        ctx.restore();

        const dataURL = offscreen.toDataURL('image/png');
        const binary = atob(dataURL.split(',')[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return new Blob([array], { type: 'image/png' });
    }

    // --- Progress bar ---

    showProgress(current, total, text) {
        let bar = document.getElementById('download-progress');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'download-progress';
            bar.className = 'download-progress';
            bar.innerHTML = `
                <div class="progress-bar-track">
                    <div class="progress-bar-fill" id="progress-fill"></div>
                </div>
                <span class="progress-text" id="progress-text"></span>
            `;
            this.downloadBtn.parentElement.appendChild(bar);
        }
        bar.style.display = '';
        const pct = Math.round((current / total) * 100);
        document.getElementById('progress-fill').style.width = pct + '%';
        document.getElementById('progress-text').textContent =
            text || `이미지 처리 중... (${current}/${total})`;
    }

    hideProgress() {
        const bar = document.getElementById('download-progress');
        if (bar) bar.style.display = 'none';
    }

    // --- Toast ---

    showToast(message, duration = 3000) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, duration);
    }

    // --- Save overlay (mobile) ---

    showSaveOverlay(blob) {
        const url = URL.createObjectURL(blob);

        const overlay = document.createElement('div');
        overlay.className = 'save-overlay';
        overlay.innerHTML = `
            <div class="save-overlay-header">
                <button class="save-overlay-close" type="button">&times;</button>
            </div>
            <div class="save-overlay-body">
                <img src="${url}" alt="프레임 이미지">
            </div>
            <p class="save-overlay-hint">이미지를 길게 눌러 사진에 저장하세요</p>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        const close = () => {
            overlay.classList.remove('active');
            overlay.addEventListener('transitionend', () => {
                overlay.remove();
                URL.revokeObjectURL(url);
            }, { once: true });
        };

        overlay.querySelector('.save-overlay-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    }
}

// Initialize app (handle case where DOMContentLoaded already fired)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PhotoFrameMaker();
    });
} else {
    new PhotoFrameMaker();
}
