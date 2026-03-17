function _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const BRAND_THEMES = {
    'sony':     { primary: '#000000', accent: '#F58220', name: 'SONY' },
    'fujifilm': { primary: '#1A1A1A', accent: '#86B817', name: 'FUJIFILM' },
    'canon':    { primary: '#FFFFFF', accent: '#CC0000', name: 'Canon' },
    'nikon':    { primary: '#000000', accent: '#FFD700', name: 'Nikon' },
    'apple':    { primary: '#1D1D1F', accent: '#FFFFFF', name: 'Apple' },
    'leica':    { primary: '#FFFFFF', accent: '#E2001A', name: 'Leica' },
    'ricoh':    { primary: '#1A1A1A', accent: '#DA291C', name: 'RICOH' },
};

const EXIF_FONT_SIZES = {
    small:  0.015,
    medium: 0.020,
    large:  0.028,
};

class PhotoFrameMaker {
    constructor() {
        // Multi-image array (max 10)
        this.images = [];
        this.currentIndex = 0;

        // Per-mode independent image state
        this._modeState = {
            frame:   { images: [], currentIndex: 0 },
            split:   { images: [], currentIndex: 0 },
            convert: { images: [], currentIndex: 0 },
            exif:    { images: [], currentIndex: 0 },
        };

        this.canvasRatio = [1, 1];
        this.canvasSize = 1000;
        this.frameRatio = 5;
        this.frameColor = '#FFFFFF';
        this.blurIntensity = 50; // 0–100
        this.pixelateIntensity = 50; // 0–100
        this.isDragging = false;
        this.isDownloading = false;
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

        // Split mode
        this.appMode = 'frame'; // 'frame' | 'split' | 'convert'
        this.splitCount = 2;
        this.splitDirection = 'horizontal'; // 'horizontal' | 'vertical'
        this.splitCurrentPanel = 0;
        this.savedRatioBeforeSplit = null;

        // Convert mode
        this.outputFormat = 'jpeg';    // 'png' | 'jpeg' | 'webp'
        this.outputQuality = 92;       // 1~100
        this.supportsWebP = false;

        // EXIF frame mode
        this.exifStyle = 'filmstrip'; // 'filmstrip' | 'minimal' | 'magazine' | 'signature'
        this.exifFields = {
            camera: false, lens: false, focalLength: true,
            aperture: true, shutter: true, iso: true, date: false
        };
        this.exifFontSize = 'medium'; // 'small' | 'medium' | 'large'
        this.exifTextColor = 'white'; // 'white' | 'black' | 'auto'
        this.exifSeparator = '│';
        this.exifBarColor = 'black';  // 'black' | 'white' | 'auto' | 'transparent'

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
        this.checkWebPSupport();
        this.setupExifEventListeners();
        this.loadLastSettings();
        this.syncFramePxInputs();
        this.updateCanvasSize();
        this.render();
        this.updateInfo();
        this.setupBottomSheet();
        this.renderFavoritesUI();

        // Ensure correct initial state
        this.previewToolbar.style.display = 'none';
        this.thumbnailStrip.style.display = 'none';
        this.downloadBtn.disabled = true;
        this.mobileDownloadBtn.disabled = true;
        this.previewContainer.classList.remove('has-image');

        // Reveal page after init
        document.body.classList.add('ready');
    }

    bindElements() {
        this.uploadZone = document.getElementById('upload-zone');
        this.fileInput = document.getElementById('file-input');
        this.uploadContent = document.getElementById('upload-content');
        this.ratioButtons = document.getElementById('ratio-buttons');
        this.ratioSection = document.getElementById('ratio-section');
        this.mobileRatioButtons = document.getElementById('mobile-ratio-buttons');
        this.mobileRatioHeader = document.getElementById('mobile-ratio-header');
        this.canvasSizeInput = document.getElementById('canvas-size');
        this.frameRatioSlider = document.getElementById('frame-ratio-slider');
        this.frameRatioInput = document.getElementById('frame-ratio');
        this.frameRatioPxInput = document.getElementById('frame-ratio-px');
        this.colorPresets = document.getElementById('color-presets');
        this.customColorInput = document.getElementById('custom-color');
        this.blurControls = document.getElementById('blur-controls');
        this.blurSlider = document.getElementById('blur-slider');
        this.blurValueLabel = document.getElementById('blur-value');
        this.pixelateControls = document.getElementById('pixelate-controls');
        this.pixelateSlider = document.getElementById('pixelate-slider');
        this.pixelateValueLabel = document.getElementById('pixelate-value');
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
        this.thumbnailStripParent = this.thumbnailStrip.parentElement;
        this.mobileThumbnailSlot = document.getElementById('mobile-thumbnail-slot');

        // Mobile tab bar elements
        this.mobileTabBar = document.getElementById('mobile-tab-bar');
        this.mobileTabPanels = document.getElementById('mobile-tab-panels');
        this.mobileDownloadBtn = document.getElementById('mobile-download-btn');
        this.mobileCanvasSizeInput = document.getElementById('mobile-canvas-size');
        this.mobileFrameRatioSlider = document.getElementById('mobile-frame-ratio-slider');
        this.mobileFrameRatioInput = document.getElementById('mobile-frame-ratio');
        this.mobileFrameRatioPxInput = document.getElementById('mobile-frame-ratio-px');
        this.mobileColorPresets = document.getElementById('mobile-color-presets');
        this.mobileCustomColorInput = document.getElementById('mobile-custom-color');
        this.mobileBlurControls = document.getElementById('mobile-blur-controls');
        this.mobileBlurSlider = document.getElementById('mobile-blur-slider');
        this.mobileBlurValueLabel = document.getElementById('mobile-blur-value');
        this.mobilePixelateControls = document.getElementById('mobile-pixelate-controls');
        this.mobilePixelateSlider = document.getElementById('mobile-pixelate-slider');
        this.mobilePixelateValueLabel = document.getElementById('mobile-pixelate-value');
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

        // App mode toggle & split controls
        this.appModeToggle = document.getElementById('app-mode-toggle');
        this.splitSection = document.getElementById('split-section');
        this.splitButtons = document.getElementById('split-buttons');
        this.mobileSplitSection = document.getElementById('mobile-split-section');
        this.mobileSplitButtons = document.getElementById('mobile-split-buttons');
        this.splitDirectionButtons = document.getElementById('split-direction-buttons');
        this.mobileSplitDirectionButtons = document.getElementById('mobile-split-direction-buttons');
        this.frameRatioSection = document.getElementById('frame-ratio-section');
        this.frameColorSection = document.getElementById('frame-color-section');
        this.mobileTabBtnFrame = document.querySelector('.tab-btn[data-tab="frame"]');
        this.mobileTabBtnColor = document.querySelector('.tab-btn[data-tab="color"]');
        this.tabPanelFrame = document.getElementById('tab-panel-frame');
        this.tabPanelColor = document.getElementById('tab-panel-color');

        // Favorites
        this.favoritesList = document.getElementById('favorites-list');
        this.favoritesEmpty = document.getElementById('favorites-empty');
        this.favoriteSaveBtn = document.getElementById('favorite-save-btn');
        this.mobileFavoritesList = document.getElementById('mobile-favorites-list');
        this.mobileFavoriteSaveBtn = document.getElementById('mobile-favorite-save-btn');
        this.favoritesSection = document.getElementById('favorites-section');

        // Convert mode
        this.convertSection = document.getElementById('convert-section');
        this.formatButtons = document.getElementById('format-buttons');
        this.qualitySlider = document.getElementById('quality-slider');
        this.qualityValue = document.getElementById('quality-value');
        this.qualityControl = document.getElementById('quality-control');
        this.mobileFormatButtons = document.getElementById('mobile-format-buttons');
        this.mobileQualitySlider = document.getElementById('mobile-quality-slider');
        this.mobileQualityValue = document.getElementById('mobile-quality-value');
        this.mobileQualityControl = document.getElementById('mobile-quality-control');
        this.mobileTabBtnConvert = document.getElementById('mobile-tab-btn-convert');
        this.tabPanelConvert = document.getElementById('tab-panel-convert');

        // EXIF frame mode
        this.exifPanel = document.getElementById('exif-style-section');
        this.exifStyleSection = this.exifPanel;
        this.exifStyleButtons = document.getElementById('exif-style-buttons');
        this.exifFieldToggles = document.getElementById('exif-field-toggles');
        this.exifFontSizeButtons = document.getElementById('exif-font-size-buttons');
        this.exifTextColorButtons = document.getElementById('exif-text-color-buttons');
        this.exifBarColorButtons = document.getElementById('exif-bar-color-buttons');
        this.exifSeparatorButtons = document.getElementById('exif-separator-buttons');
        this.mobileExifStyleButtons = document.getElementById('mobile-exif-style-buttons');
        this.mobileExifFieldToggles = document.getElementById('mobile-exif-field-toggles');
        this.mobileExifFontSizeButtons = document.getElementById('mobile-exif-font-size-buttons');
        this.mobileExifTextColorButtons = document.getElementById('mobile-exif-text-color-buttons');
        this.mobileExifBarColorButtons = document.getElementById('mobile-exif-bar-color-buttons');
        this.mobileExifSeparatorButtons = document.getElementById('mobile-exif-separator-buttons');
        this.mobileTabBtnExif = document.getElementById('mobile-tab-btn-exif');
        this.tabPanelExif = document.getElementById('tab-panel-exif');
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

            this.syncFramePxInputs();
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
                this.syncFramePxInputs();
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

            this.syncFramePxInputs();
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
            this.syncFramePxInputs();
            this.resetAllOffsets();
            this.render();
            this.updateInfo();
        });

        // Frame ratio pixel input (desktop)
        this.frameRatioPxInput.addEventListener('input', () => {
            let px = parseInt(this.frameRatioPxInput.value, 10);
            if (isNaN(px)) return;
            const maxPx = Math.round(this.canvasSize * 25 / 100);
            px = Math.max(0, Math.min(maxPx, px));
            const pct = this.canvasSize > 0 ? (px / this.canvasSize) * 100 : 0;
            const rounded = Math.round(pct * 2) / 2;
            this.frameRatio = rounded;
            this.frameRatioSlider.value = rounded;
            this.frameRatioInput.value = rounded;
            this.mobileFrameRatioSlider.value = rounded;
            this.mobileFrameRatioInput.value = rounded;
            this.mobileFrameRatioPxInput.value = px;
            this.resetAllOffsets();
            this.render();
            this.updateInfo();
        });
        this.frameRatioPxInput.addEventListener('change', () => {
            this.syncFramePxInputs();
        });

        // Color presets
        this.colorPresets.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;
            const color = swatch.dataset.color;
            this.colorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
            this.mobileColorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
            this.frameColor = color;
            if (!this.isStyleFrame) {
                this.customColorInput.value = color;
                this.mobileCustomColorInput.value = color;
            }

            this.updateStyleControlsVisibility();
            this.render();
        });

        this.customColorInput.addEventListener('input', () => {
            this.frameColor = this.customColorInput.value;
            this.mobileCustomColorInput.value = this.frameColor;
            this.colorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            this.mobileColorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));

            this.updateStyleControlsVisibility();
            this.render();
        });

        // Blur intensity slider
        this.blurSlider.addEventListener('input', () => {
            this.blurIntensity = parseInt(this.blurSlider.value);
            this.mobileBlurSlider.value = this.blurIntensity;
            this.blurValueLabel.textContent = this.blurIntensity;
            this.mobileBlurValueLabel.textContent = this.blurIntensity;
            this.render();
        });

        // Pixelate intensity slider
        this.pixelateSlider.addEventListener('input', () => {
            this.pixelateIntensity = parseInt(this.pixelateSlider.value);
            this.mobilePixelateSlider.value = this.pixelateIntensity;
            this.pixelateValueLabel.textContent = this.pixelateIntensity;
            this.mobilePixelateValueLabel.textContent = this.pixelateIntensity;
            this.render();
        });

        // Favorites
        this.favoriteSaveBtn.addEventListener('click', () => this.saveFavorite());
        this.mobileFavoriteSaveBtn.addEventListener('click', () => this.saveFavorite());
        const handleFavClick = (e) => {
            const removeBtn = e.target.closest('.favorite-remove');
            if (removeBtn) { this.removeFavorite(parseInt(removeBtn.dataset.index)); return; }
            const item = e.target.closest('.favorite-item');
            if (item) { this.applyPreset(this.getFavorites()[parseInt(item.dataset.index)]); }
        };
        this.favoritesList.addEventListener('click', handleFavClick);
        this.mobileFavoritesList.addEventListener('click', handleFavClick);

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
            if (this.isDragging && (this.hasMultipleImages || (this.appMode === 'split' && this.splitCount > 1))) {
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

        // Feed mockup click to upload
        this.feedMockup.addEventListener('click', (e) => {
            if (e.target.closest('.feed-nav-arrow')) return;
            this.fileInput.click();
        });

        // Profile grid click: placeholder → upload, filled → select
        this.profileGrid.addEventListener('click', (e) => {
            const cell = e.target.closest('.profile-grid-item');
            if (!cell) return;
            if (cell.classList.contains('placeholder')) {
                this.fileInput.click();
            } else if (cell.classList.contains('target')) {
                const idx = parseInt(cell.dataset.index);
                if (!isNaN(idx) && idx !== this.currentIndex) {
                    this.selectImage(idx);
                }
            }
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
                const idx = parseInt(item.dataset.index);
                if (this.appMode === 'split') {
                    if (idx !== this.splitCurrentPanel) {
                        this.splitCurrentPanel = idx;
                        this.render();
                        this.updateNavArrows();
                        this.updateSplitThumbnailHighlight();
                    }
                } else {
                    this.selectImage(idx);
                }
            }
        });

        this.thumbnailAddBtn.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Resize: recalculate preview container size
        window.addEventListener('resize', () => this.updatePreviewContainerSize());

        // App mode toggle (프레임 / 분할) — sliding indicator
        this.modeSlider = document.createElement('div');
        this.modeSlider.className = 'slider';
        this.appModeToggle.appendChild(this.modeSlider);
        this.updateModeSlider();

        this.appModeToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.app-mode-btn');
            if (!btn) return;
            this.switchAppMode(btn.dataset.mode);
        });

        // Split direction buttons (desktop)
        this.splitDirectionButtons.addEventListener('click', (e) => {
            const btn = e.target.closest('.split-btn');
            if (!btn) return;
            this.setSplitDirection(btn.dataset.direction);
        });

        // Split count buttons (desktop)
        this.splitButtons.addEventListener('click', (e) => {
            const btn = e.target.closest('.split-btn');
            if (!btn) return;
            this.setSplitCount(parseInt(btn.dataset.split));
        });

        // Convert mode: format buttons (event delegation)
        const handleFormatClick = (e) => {
            const btn = e.target.closest('.format-btn');
            if (!btn || btn.disabled) return;
            this.outputFormat = btn.dataset.format;
            this.syncFormatUI();
            this.updateQualityControlState();
            this.updateDownloadLabel();
        };
        this.formatButtons.addEventListener('click', handleFormatClick);
        this.mobileFormatButtons.addEventListener('click', handleFormatClick);

        // Convert mode: quality slider
        this.qualitySlider.addEventListener('input', () => {
            this.outputQuality = parseInt(this.qualitySlider.value);
            this.mobileQualitySlider.value = this.outputQuality;
            this.qualityValue.textContent = this.outputQuality + '%';
            this.mobileQualityValue.textContent = this.outputQuality + '%';
            this.updateDownloadLabel();
        });
        this.mobileQualitySlider.addEventListener('input', () => {
            this.outputQuality = parseInt(this.mobileQualitySlider.value);
            this.qualitySlider.value = this.outputQuality;
            this.qualityValue.textContent = this.outputQuality + '%';
            this.mobileQualityValue.textContent = this.outputQuality + '%';
            this.updateDownloadLabel();
        });
    }

    // --- Calculations ---

    getCanvasDimensions() {
        const [w, h] = this.canvasRatio;
        return {
            width: this.canvasSize,
            height: Math.round(this.canvasSize * h / w)
        };
    }

    getFrameWidth() {
        if (this.appMode === 'split') return 0;
        return Math.round(this.canvasSize * this.frameRatio / 100);
    }

    syncFramePxInputs() {
        const px = this.getFrameWidth();
        this.frameRatioPxInput.value = px;
        this.mobileFrameRatioPxInput.value = px;
    }

    getPhotoArea() {
        const dims = (this.appMode === 'split' && this.canvas.width > 0)
            ? { width: this.canvas.width, height: this.canvas.height }
            : this.getCanvasDimensions();
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

        // Contain mode: fit entire image within photo area (no cropping)
        let drawWidth, drawHeight;
        if (imgRatio > areaRatio) {
            drawWidth = photoArea.width;
            drawHeight = drawWidth / imgRatio;
        } else {
            drawHeight = photoArea.height;
            drawWidth = drawHeight * imgRatio;
        }
        return { width: drawWidth, height: drawHeight };
    }

    // --- App mode switching ---

    updateModeSlider() {
        const active = this.appModeToggle.querySelector('.app-mode-btn.active');
        if (!active || !this.modeSlider) return;
        const toggleRect = this.appModeToggle.getBoundingClientRect();
        const btnRect = active.getBoundingClientRect();
        this.modeSlider.style.width = btnRect.width + 'px';
        this.modeSlider.style.transform = `translateX(${btnRect.left - toggleRect.left - 3}px)`;
    }

    switchAppMode(mode) {
        if (mode === this.appMode) return;

        // Save current mode's image state
        this._modeState[this.appMode] = { images: [...this.images], currentIndex: this.currentIndex };

        this.appMode = mode;

        // Restore new mode's image state
        const _saved = this._modeState[mode];
        this.images = [..._saved.images];
        this.currentIndex = _saved.images.length > 0 ? Math.min(_saved.currentIndex, _saved.images.length - 1) : 0;

        const isSplit = mode === 'split';
        const isConvert = mode === 'convert';
        const isExif = mode === 'exif';

        // Toggle mode buttons
        this.appModeToggle.querySelectorAll('.app-mode-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.mode === mode)
        );
        this.updateModeSlider();

        // Toggle split section visibility
        this.splitSection.style.display = isSplit ? '' : 'none';
        this.mobileSplitSection.style.display = isSplit ? '' : 'none';

        // Toggle convert section visibility
        this.convertSection.style.display = isConvert ? '' : 'none';
        this.mobileTabBtnConvert.style.display = isConvert ? '' : 'none';
        if (!isConvert) {
            this.tabPanelConvert.classList.remove('active');
        }

        // Toggle EXIF section visibility
        this.exifPanel.style.display = isExif ? '' : 'none';
        this.mobileTabBtnExif.style.display = isExif ? '' : 'none';
        if (!isExif) {
            this.tabPanelExif.classList.remove('active');
        }

        // In split/convert mode, force ratio based on direction and hide ratio selection
        if (isSplit) {
            this.savedRatioBeforeSplit = [...this.canvasRatio];
            this.canvasRatio = this.splitDirection === 'horizontal' ? [3, 4] : [4, 3];
            this.ratioSection.style.display = 'none';
            this.mobileRatioHeader.style.display = 'none';
            this.mobileRatioButtons.style.display = 'none';
        } else if (isConvert || isExif) {
            if (this.savedRatioBeforeSplit) {
                this.canvasRatio = this.savedRatioBeforeSplit;
                this.savedRatioBeforeSplit = null;
            }
            this.ratioSection.style.display = 'none';
            this.mobileRatioHeader.style.display = 'none';
            this.mobileRatioButtons.style.display = 'none';
        } else {
            // frame mode: show ratio controls
            if (this.savedRatioBeforeSplit) {
                this.canvasRatio = this.savedRatioBeforeSplit;
                this.savedRatioBeforeSplit = null;
            }
            this.ratioSection.style.display = '';
            this.mobileRatioHeader.style.display = '';
            this.mobileRatioButtons.style.display = '';
            const ratioStr = this.canvasRatio.join(':');
            this.ratioButtons.querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratioStr));
            this.mobileRatioButtons.querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratioStr));
        }
        this.resetAllOffsets();
        this.updateCanvasSize();

        // In split/convert mode, hide frame controls (exif keeps them)
        const hideFrame = isSplit || isConvert;
        this.frameRatioSection.style.display = hideFrame ? 'none' : '';
        this.frameColorSection.style.display = hideFrame ? 'none' : '';
        this.mobileTabBtnFrame.style.display = hideFrame ? 'none' : '';
        this.mobileTabBtnColor.style.display = hideFrame ? 'none' : '';
        // Hide favorites in convert/exif mode
        if (this.favoritesSection) this.favoritesSection.style.display = (isConvert || isExif) ? 'none' : '';
        // Close frame/color tab panels if open
        if (hideFrame) {
            this.tabPanelFrame.classList.remove('active');
            this.tabPanelColor.classList.remove('active');
        }

        // In split/convert/exif mode, hide preview mode toggle
        const hidePreview = isSplit || isConvert || isExif;
        this.previewModeToggle.style.display = hidePreview ? 'none' : '';
        if (hidePreview && this.previewMode !== 'default') {
            this.previewMode = 'default';
            this.previewModeToggle.querySelectorAll('.preview-mode-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.mode === 'default')
            );
            this.updatePreviewMode();
        }

        // Reset split panel
        this.splitCurrentPanel = 0;

        // Update download label
        this.updateDownloadLabel();
        if (isConvert) this.syncFormatUI();
        if (isExif) this.syncExifUI();

        // Re-render everything with new mode's image state
        this.syncFramePxInputs();
        this.onImagesChanged();
    }

    setSplitCount(count) {
        if (count === this.splitCount) return;
        this.splitCount = count;
        this.splitCurrentPanel = 0;

        // Update buttons (desktop + mobile)
        [this.splitButtons, this.mobileSplitButtons].forEach(container => {
            container.querySelectorAll('.split-btn').forEach(b =>
                b.classList.toggle('active', parseInt(b.dataset.split) === count)
            );
        });

        this.render();
        this.updateNavArrows();
        this.updateThumbnailStrip();
        this.updateDownloadButton();
        this.updateInfo();
    }

    setSplitDirection(direction) {
        if (direction === this.splitDirection) return;
        this.splitDirection = direction;
        this.splitCurrentPanel = 0;

        // Update buttons (desktop + mobile)
        [this.splitDirectionButtons, this.mobileSplitDirectionButtons].forEach(container => {
            container.querySelectorAll('.split-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.direction === direction)
            );
        });

        // Update forced ratio based on direction
        this.canvasRatio = direction === 'horizontal' ? [3, 4] : [4, 3];

        this.resetAllOffsets();
        this.updateCanvasSize();
        this.syncFramePxInputs();
        this.render();
        this.updateNavArrows();
        this.updateThumbnailStrip();
        this.updateDownloadButton();
        this.updateInfo();
    }

    // --- Split rendering helpers ---

    getSplitStripDimensions(img) {
        if (this.splitDirection === 'vertical') {
            const stripHeight = img.naturalHeight / this.splitCount;
            return { width: img.naturalWidth, height: stripHeight };
        }
        const stripWidth = img.naturalWidth / this.splitCount;
        return { width: stripWidth, height: img.naturalHeight };
    }

    getSplitSourceRect(img, panelIndex) {
        if (this.splitDirection === 'vertical') {
            const stripHeight = img.naturalHeight / this.splitCount;
            return {
                sx: 0,
                sy: stripHeight * panelIndex,
                sw: img.naturalWidth,
                sh: stripHeight
            };
        }
        const stripWidth = img.naturalWidth / this.splitCount;
        return {
            sx: stripWidth * panelIndex,
            sy: 0,
            sw: stripWidth,
            sh: img.naturalHeight
        };
    }

    getSplitDrawDimensions(img) {
        const photoArea = this.getPhotoArea();
        if (photoArea.width === 0 || photoArea.height === 0) return { width: 0, height: 0 };

        const strip = this.getSplitStripDimensions(img);
        const stripRatio = strip.width / strip.height;
        const areaRatio = photoArea.width / photoArea.height;

        let drawWidth, drawHeight;
        if (stripRatio > areaRatio) {
            drawWidth = photoArea.width;
            drawHeight = drawWidth / stripRatio;
        } else {
            drawHeight = photoArea.height;
            drawWidth = drawHeight * stripRatio;
        }
        return { width: drawWidth, height: drawHeight };
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
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.ctx.beginPath();
        this.ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
        this.ctx.clip();
        this.ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, x, y, draw.width, draw.height);
        this.ctx.restore();
    }

    async renderSplitPanelToBlob(item, dims, photoArea, panelIndex) {
        const img = item.image;
        const src = this.getSplitSourceRect(img, panelIndex);

        // Split mode: save only the photo content, no frame
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.round(src.sw);
        offscreen.height = Math.round(src.sh);
        const ctx = offscreen.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, offscreen.width, offscreen.height);

        return await new Promise((resolve, reject) => {
            offscreen.toBlob(blob => {
                offscreen.width = 0;
                offscreen.height = 0;
                blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'));
            }, 'image/png');
        });
    }

    // --- Canvas size update ---

    updateCanvasSize() {
        const dims = this.getCanvasDimensions();
        this.canvas.width = dims.width;
        this.canvas.height = dims.height;
        // Set aspect-ratio fallback so canvas never distorts
        this.canvas.style.aspectRatio = `${dims.width} / ${dims.height}`;
        this.updatePreviewContainerSize();
    }

    updatePreviewContainerSize() {
        let ratio;
        if ((this.appMode === 'convert' || this.appMode === 'exif' || this.appMode === 'split') && this.canvas.width > 0 && this.canvas.height > 0) {
            ratio = this.canvas.width / this.canvas.height;
        } else {
            const [w, h] = this.canvasRatio;
            ratio = w / h;
        }

        const parent = this.previewContainer.parentElement;
        const parentWidth = parent.clientWidth;
        if (parentWidth <= 0) return;

        const cs = getComputedStyle(this.previewContainer);
        const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);

        const isMobile = window.innerWidth <= 900;

        if (isMobile) {
            if (this.previewContainer.style.display === 'none') return;

            // Use parent width for horizontal space (container may not stretch due to align-items: center)
            const availW = parentWidth - padX;

            // Temporarily let flex: 1 measure available vertical space
            this.previewContainer.style.width = '';
            this.previewContainer.style.height = '';
            this.previewContainer.style.flex = '1';

            const cellRect = this.previewContainer.getBoundingClientRect();

            // Restore flex after measurement
            this.previewContainer.style.flex = '';

            const availH = cellRect.height - padY;

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
            this.canvas.style.width = Math.round(cw) + 'px';
            this.canvas.style.height = Math.round(ch) + 'px';
            this.previewContainer.style.marginLeft = 'auto';
            this.previewContainer.style.marginRight = 'auto';
        } else {
            // Use .main grid cell width, not .preview-area (which we resize)
            const previewArea = this.previewContainer.closest('.preview-area');
            previewArea.style.width = '';
            previewArea.style.marginLeft = '';
            previewArea.style.marginRight = '';
            const gridCellWidth = previewArea.parentElement.clientWidth
                ? previewArea.parentElement.clientWidth - 300 - 24
                : parentWidth;
            const actualParentWidth = gridCellWidth > 0 ? gridCellWidth : parentWidth;

            const maxH = window.innerHeight * 0.75;
            const availW = actualParentWidth - padX;
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

            const cardWidth = Math.round(cw + padX);
            this.previewContainer.style.width = '';
            this.previewContainer.style.marginLeft = '';
            this.previewContainer.style.marginRight = '';
            this.canvas.style.width = Math.round(cw) + 'px';
            this.canvas.style.height = Math.round(ch) + 'px';

            // Size the entire preview-area card to match canvas width
            previewArea.style.width = cardWidth + 'px';
            previewArea.style.marginLeft = 'auto';
            previewArea.style.marginRight = 'auto';

            this.previewContainer.style.height = Math.round(ch + padY) + 'px';
        }
    }

    // --- Rendering ---

    render(keepProfileCache) {
        if (!keepProfileCache) this.invalidateProfileCache();

        // Convert mode: show original image without frame
        if (this.appMode === 'convert') {
            this.renderConvertPreview();
            this.updateMockupImages();
            return;
        }

        // EXIF mode
        if (this.appMode === 'exif') {
            this.renderExifFrame();
            this.updateMockupImages();
            clearTimeout(this._saveSettingsTimer);
            this._saveSettingsTimer = setTimeout(() => this.saveLastSettings(), 500);
            return;
        }

        // For split mode with image, use image natural dimensions
        let dims;
        if (this.appMode === 'split' && this.currentImage) {
            const img = this.currentImage.image;
            const fw = this.getFrameWidth();
            dims = { width: img.naturalWidth + fw * 2, height: img.naturalHeight + fw * 2 };
            this.canvas.width = dims.width;
            this.canvas.height = dims.height;
            this.canvas.style.aspectRatio = `${dims.width} / ${dims.height}`;
        } else {
            dims = this.getCanvasDimensions();
        }

        // When no image, hide canvas and let CSS background show
        if (!this.currentImage) {
            this.canvas.width = dims.width;
            this.canvas.height = dims.height;
            this.canvas.style.aspectRatio = `${dims.width} / ${dims.height}`;
            this.ctx.clearRect(0, 0, dims.width, dims.height);
            this.drawPlaceholder();
        } else {
            this.ctx.clearRect(0, 0, dims.width, dims.height);

            // Draw frame background
            this.drawFrameBackground(this.ctx, this.currentImage.image, dims.width, dims.height);

            // Draw image
            if (this.appMode === 'split') {
                this.drawSplitImage();
            } else {
                this.drawImage();
            }
        }

        this.updateMockupImages();

        // Debounce save settings to localStorage
        clearTimeout(this._saveSettingsTimer);
        this._saveSettingsTimer = setTimeout(() => this.saveLastSettings(), 500);
    }

    renderConvertPreview() {
        const cur = this.currentImage;
        if (!cur) {
            const dims = this.getCanvasDimensions();
            this.canvas.width = dims.width;
            this.canvas.height = dims.height;
            this.ctx.clearRect(0, 0, dims.width, dims.height);
            this.drawPlaceholder();
            return;
        }
        const img = cur.image;
        // Use original image dimensions (capped at 2000 for preview performance)
        const MAX_PREVIEW = 2000;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > MAX_PREVIEW || h > MAX_PREVIEW) {
            if (w >= h) {
                h = Math.round(MAX_PREVIEW * h / w);
                w = MAX_PREVIEW;
            } else {
                w = Math.round(MAX_PREVIEW * w / h);
                h = MAX_PREVIEW;
            }
        }
        this.canvas.width = w;
        this.canvas.height = h;
        this.canvas.style.aspectRatio = `${w} / ${h}`;
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.ctx.drawImage(img, 0, 0, w, h);
        this.updatePreviewContainerSize();
    }

    // --- EXIF frame rendering ---

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
                const barH = Math.round(baseH * 0.52);
                return { canvasWidth: baseW, canvasHeight: baseH + barH, imageX: 0, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: baseH, barW: baseW, barH };
            }
            default:
                return { canvasWidth: baseW, canvasHeight: baseH, imageX: 0, imageY: 0, imageW: baseW, imageH: baseH, barX: 0, barY: 0, barW: 0, barH: 0 };
        }
    }

    renderExifFrame() {
        const cur = this.currentImage;

        if (!cur) {
            const dims = this.getCanvasDimensions();
            this.canvas.width = dims.width;
            this.canvas.height = dims.height;
            this.canvas.style.aspectRatio = `${dims.width} / ${dims.height}`;
            this.ctx.clearRect(0, 0, dims.width, dims.height);
            this.drawPlaceholder();
            return;
        }

        const imgNW = cur.image.naturalWidth;
        const imgNH = cur.image.naturalHeight;
        const innerDims = { width: imgNW, height: imgNH };
        const overlay = this.getExifOverlayDimensions(innerDims);
        const fw = this.getFrameWidth();
        const totalW = overlay.canvasWidth + fw * 2;
        const totalH = overlay.canvasHeight + fw * 2;

        this.canvas.width = totalW;
        this.canvas.height = totalH;
        this.canvas.style.aspectRatio = `${totalW} / ${totalH}`;
        this.ctx.clearRect(0, 0, totalW, totalH);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Draw frame background
        this.drawFrameBackground(this.ctx, cur.image, totalW, totalH);

        // Offset overlay positions by frame width
        const ox = { ...overlay, imageX: overlay.imageX + fw, imageY: overlay.imageY + fw, barX: overlay.barX + fw, barY: overlay.barY + fw };

        // Draw image at original ratio (no crop)
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(ox.imageX, ox.imageY, ox.imageW, ox.imageH);
        this.ctx.clip();
        this.ctx.drawImage(cur.image, ox.imageX, ox.imageY, ox.imageW, ox.imageH);
        this.ctx.restore();

        // EXIF overlay
        if (this.hasExifData()) {
            this.drawExifOverlay(this.ctx, totalW, totalH, ox);
        } else {
            this.drawNoExifMessage(this.ctx, totalW, totalH, ox);
        }

        this.updatePreviewContainerSize();
    }

    drawExifOverlay(ctx, canvasW, canvasH, overlay) {
        const values = this.getActiveExifValues();
        if (values.length === 0) return;
        switch (this.exifStyle) {
            case 'filmstrip': this.drawFilmStripOverlay(ctx, overlay, values); break;
            case 'minimal':   this.drawMinimalOverlay(ctx, overlay, values); break;
            case 'magazine':  this.drawMagazineOverlay(ctx, overlay, values); break;
            case 'signature': this.drawSignatureOverlay(ctx, overlay, values); break;
            case 'letterbox': this.drawLetterboxOverlay(ctx, overlay, values); break;
            case 'polaroid':  this.drawPolaroidOverlay(ctx, overlay, values); break;
            case 'leica':     this.drawLeicaOverlay(ctx, overlay, values); break;
            case 'fujistyle':   this.drawFujistyleOverlay(ctx, overlay, values); break;
            case 'fujirecipe':  this.drawFujirecipeOverlay(ctx, overlay, values); break;
            case 'glass':       this.drawGlassOverlay(ctx, overlay, values); break;
            case 'leicalux':    this.drawLeicaluxOverlay(ctx, overlay, values); break;
            case 'instax':      this.drawInstaxOverlay(ctx, overlay, values); break;
            case 'filmstock':   this.drawFilmstockOverlay(ctx, overlay, values); break;
            case 'shoton':      this.drawShotonOverlay(ctx, overlay, values); break;
            case 'editorial':   this.drawEditorialOverlay(ctx, overlay, values); break;
            case 'hud':         this.drawHudOverlay(ctx, overlay, values); break;
            case 'minimalbar':  this.drawMinimalbarOverlay(ctx, overlay, values); break;
            case 'cardgrid':    this.drawCardgridOverlay(ctx, overlay, values); break;
        }
    }

    drawFilmStripOverlay(ctx, overlay, values) {
        // fw = frame width (imageX offset = 0 + fw for filmstrip)
        const fw = overlay.imageX;
        const stripH = overlay.imageY - fw; // actual film strip height
        if (stripH <= 0) return;

        const stripX = overlay.barX;   // left edge of inner area
        const stripW = overlay.barW;   // inner canvas width
        const topStripY = fw;          // top strip starts after frame
        const botStripY = overlay.barY;

        const FILM_BG    = '#1c1c1c';
        const TEXT_COLOR = '#c8bfa8'; // warm cream, like film annotation ink

        // Sprocket hole proportions (based on 35mm KS/BH perforation)
        const holeW = Math.round(stripH * 0.42);
        const holeH = Math.round(stripH * 0.62);
        const holeR = Math.round(holeW * 0.28);
        const pitch  = Math.round(stripH * 0.88); // center-to-center
        const holeVY = Math.round((stripH - holeH) / 2);
        const nHoles = Math.max(3, Math.floor((stripW + pitch) / pitch));
        const totalHW = (nHoles - 1) * pitch + holeW;
        const holeStartX = Math.round((stripW - totalHW) / 2);

        // Rounded rect path helper
        const rrPath = (c, x, y, w, h, r) => {
            c.beginPath();
            c.moveTo(x + r, y);
            c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
            c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
            c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
            c.closePath();
        };

        // Draw one film strip band with punched sprocket holes
        const drawStrip = (destY) => {
            const oc = document.createElement('canvas');
            oc.width = stripW; oc.height = stripH;
            const oc_ctx = oc.getContext('2d');

            // Film base
            oc_ctx.fillStyle = FILM_BG;
            oc_ctx.fillRect(0, 0, stripW, stripH);

            // Subtle horizontal grain lines
            oc_ctx.globalAlpha = 0.035;
            oc_ctx.fillStyle = '#ffffff';
            for (let gy = 0; gy < stripH; gy += 2) oc_ctx.fillRect(0, gy, stripW, 1);
            oc_ctx.globalAlpha = 1;

            // Punch sprocket holes (destination-out = real transparency)
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

        const fontPx  = this.getExifFontPx(overlay.imageH);
        const annotPx = Math.max(8, Math.round(stripH * 0.30));
        const pad     = Math.round(holeW * 0.55);
        const midTopY = topStripY + stripH / 2;
        const midBotY = botStripY + stripH / 2;

        // Top strip: frame number annotation (right side)
        ctx.save();
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = `400 ${annotPx}px "Courier New", monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u25C6 1A', stripX + stripW - pad, midTopY);
        ctx.restore();

        // Bottom strip: camera name (left) + exposure data (right)
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

    drawMinimalOverlay(ctx, overlay, values) {
        const fontPx = this.getExifFontPx(overlay.canvasHeight);
        const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
        const padding = fontPx * 1.5;

        ctx.fillStyle = textColor;
        ctx.font = `300 ${fontPx}px "DM Sans", sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = fontPx * 0.4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;

        const text = values.map(v => v.value).join(` ${this.exifSeparator} `);
        ctx.fillText(text, overlay.imageX + overlay.imageW - padding, overlay.imageY + overlay.imageH - padding);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }

    drawMagazineOverlay(ctx, overlay, values) {
        const { barX, barY, barW, barH } = overlay;
        const fontPx = this.getExifFontPx(overlay.canvasHeight);
        const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
        const barBgColor = this.resolveExifBarColor(textColor);

        if (barBgColor !== 'transparent') {
            ctx.fillStyle = barBgColor;
            ctx.fillRect(barX, barY, barW, barH);
        }

        const brand = this.detectBrand(this.currentImage.exifData);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = barX + barW / 2;
        const lineHeight = fontPx * 1.8;
        let curY = barY + barH * 0.12;

        // Brand name vertically
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

        // EXIF values
        ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
        ctx.fillStyle = textColor;
        values.forEach((v) => {
            ctx.fillText(v.value, centerX, curY, barW * 0.85);
            curY += lineHeight;
        });
    }

    drawSignatureOverlay(ctx, overlay, values) {
        const { barX, barY, barW, barH } = overlay;
        const fontPx = this.getExifFontPx(overlay.canvasHeight);
        const brand = this.detectBrand(this.currentImage.exifData);
        const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
        const barBgColor = this.resolveExifBarColor(textColor);

        if (barBgColor !== 'transparent') {
            ctx.fillStyle = barBgColor;
            ctx.fillRect(barX, barY, barW, barH);
        }

        // Line 1: Brand name or camera
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

        // Line 2: Settings
        const settingsValues = values.filter(v => v.key !== 'camera');
        if (settingsValues.length > 0) {
            const settingsY = barY + barH * 0.70;
            ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const text = settingsValues.map(v => v.value).join(` ${this.exifSeparator} `);
            ctx.fillText(text, barX + barW / 2, settingsY, barW * 0.9);
        }
    }

    drawLetterboxOverlay(ctx, overlay, values) {
        const fw   = overlay.imageX;
        const barH = overlay.imageY - fw;
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

        // Subtle separator line at top of bottom bar
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(barX, botY); ctx.lineTo(barX + barW, botY);
        ctx.stroke();

        const fontPx    = this.getExifFontPx(overlay.imageH);
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

    drawPolaroidOverlay(ctx, overlay, values) {
        const fw  = overlay.imageX;
        const topH = overlay.imageY - fw;
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

        const fontPx    = this.getExifFontPx(overlay.imageH);
        const camVal    = values.find(v => v.key === 'camera');
        const otherVals = values.filter(v => v.key !== 'camera');

        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        if (camVal) {
            ctx.fillStyle = TEXT;
            ctx.font = `400 ${Math.round(fontPx * 1.05)}px "DM Sans", sans-serif`;
            ctx.fillText('Shot on ' + camVal.value, barX + barW / 2, barY + barH * (otherVals.length > 0 ? 0.36 : 0.50), barW * 0.82);
        }
        if (otherVals.length > 0) {
            ctx.fillStyle = MUTED;
            ctx.font = `300 ${Math.round(fontPx * 0.82)}px "DM Sans", sans-serif`;
            ctx.fillText(otherVals.map(v => v.value).join('  ·  '), barX + barW / 2, barY + barH * (camVal ? 0.65 : 0.50), barW * 0.80);
        }
        ctx.restore();
    }

    drawLeicaOverlay(ctx, overlay, values) {
        const { barX, barY, barW, barH } = overlay;
        const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
        const isDark    = textColor === '#FFFFFF';

        const BG    = isDark ? '#111111' : '#f8f5f0';
        const MAIN  = isDark ? '#ece8e2' : '#1a1a1a';
        const MUTED = isDark ? '#7a7a7a' : '#9a9a9a';
        const RED   = '#CC1818';

        ctx.fillStyle = BG;
        ctx.fillRect(barX, barY, barW, barH);
        // Leica-red top accent line
        ctx.fillStyle = RED;
        ctx.fillRect(barX, barY, barW, Math.max(1, Math.round(barH * 0.025)));

        const fontPx    = this.getExifFontPx(overlay.imageH);
        const pad       = Math.round(barW * 0.04);
        const dotR      = Math.round(barH * 0.10);
        const camVal    = values.find(v => v.key === 'camera');
        const otherVals = values.filter(v => v.key !== 'camera');

        ctx.save();
        ctx.textBaseline = 'middle';

        // Red dot (left)
        ctx.fillStyle = RED;
        ctx.beginPath();
        ctx.arc(barX + pad + dotR, barY + barH / 2, dotR, 0, Math.PI * 2);
        ctx.fill();

        // Camera name: italic serif, right-aligned
        if (camVal) {
            ctx.fillStyle = MAIN;
            ctx.font = `italic 700 ${Math.round(fontPx * 1.05)}px "Playfair Display", serif`;
            ctx.textAlign = 'right';
            ctx.fillText(camVal.value, barX + barW - pad, barY + barH * (otherVals.length > 0 ? 0.32 : 0.50), barW * 0.65);
        }
        // Settings: light sans, right-aligned
        if (otherVals.length > 0) {
            ctx.fillStyle = MUTED;
            ctx.font = `300 ${Math.round(fontPx * 0.80)}px "DM Sans", sans-serif`;
            ctx.textAlign = 'right';
            ctx.fillText(otherVals.map(v => v.value).join('  ·  '), barX + barW - pad, barY + barH * (camVal ? 0.72 : 0.50), barW * 0.65);
        }
        ctx.restore();
    }

    drawFujistyleOverlay(ctx, overlay, values) {
        const fw  = overlay.imageX;
        const topH = overlay.imageY - fw;
        const { barX, barY, barW, barH } = overlay;

        const brand   = this.detectBrand(this.currentImage?.exifData);
        const ACCENT  = brand?.accent  || '#4a7c59';
        const PRIMARY = brand?.primary || '#1c1c1c';

        // Top bar: accent color + camera name
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

        // Bottom bar: dark + settings
        ctx.fillStyle = PRIMARY;
        ctx.fillRect(barX, barY, barW, barH);
        // Thin accent stripe at top of bottom bar
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

    // ── New EXIF styles ──────────────────────────────────────────────────

    drawFujirecipeOverlay(ctx, overlay, values) {
        const { barX, barY, barW, barH, imageX, imageY } = overlay;
        const fw   = this.getFrameWidth();
        const topM = imageY - fw;
        const BG = '#FAFAF5', DIV = '#E0DDD5', TEXT1 = '#2C2C2A', TEXT2 = '#8A8A82', TEXT3 = '#A0A098';
        if (topM > 0) { ctx.fillStyle = BG; ctx.fillRect(barX, fw, barW, topM); }
        ctx.fillStyle = BG;
        ctx.fillRect(barX, barY, barW, barH);
        ctx.strokeStyle = DIV; ctx.lineWidth = Math.max(1, Math.round(overlay.imageH * 0.0006));
        ctx.beginPath(); ctx.moveTo(barX, barY); ctx.lineTo(barX + barW, barY); ctx.stroke();

        const fp  = this.getExifFontPx(overlay.imageH);
        const pad = Math.round(barW * 0.044);
        const camVal  = values.find(v => v.key === 'camera');
        const lensVal = values.find(v => v.key === 'lens');
        const dateVal = values.find(v => v.key === 'date');
        ctx.save(); ctx.textBaseline = 'middle';

        // Line 1 left: film sim / camera name
        const filmName = camVal ? camVal.value.toUpperCase() : 'STANDARD';
        ctx.fillStyle = TEXT1; ctx.font = `600 ${Math.round(fp * 0.95)}px "Courier New", monospace`;
        ctx.textAlign = 'left'; ctx.fillText(filmName, barX + pad, barY + barH * 0.35, barW * 0.54);

        // Line 1 right: date as '24 06 15
        if (dateVal) {
            const parts = dateVal.value.split('.');
            const short = parts.length >= 3 ? `'${parts[0].slice(2)} ${parts[1]} ${parts[2]}` : dateVal.value;
            ctx.fillStyle = TEXT2; ctx.font = `400 ${Math.round(fp * 0.84)}px "Courier New", monospace`;
            ctx.textAlign = 'right'; ctx.fillText(short, barX + barW - pad, barY + barH * 0.35);
        }

        // Line 2: camera · lens
        const meta = [camVal?.value, lensVal?.value].filter(Boolean).join(' · ');
        if (meta) {
            ctx.fillStyle = TEXT3; ctx.font = `400 ${Math.round(fp * 0.74)}px "Courier New", monospace`;
            ctx.textAlign = 'left'; ctx.fillText(meta, barX + pad, barY + barH * 0.72, barW * 0.85);
        }
        ctx.restore();
    }

    drawGlassOverlay(ctx, overlay, values) {
        const { imageX, imageY, imageW, imageH } = overlay;
        const fp  = this.getExifFontPx(imageH);
        const pad = Math.round(imageW * 0.042);
        const camVal  = values.find(v => v.key === 'camera');
        const lensVal = values.find(v => v.key === 'lens');
        const others  = values.filter(v => v.key !== 'camera' && v.key !== 'lens' && v.key !== 'date');
        const cardH   = Math.round(fp * 5.2);
        const ipad    = Math.round(cardH * 0.18);

        // measure text widths to auto-size card
        const line1 = camVal?.value || '';
        const line2 = [lensVal?.value, ...others.map(v => v.value)].filter(Boolean).join(' · ');
        ctx.font = `600 ${Math.round(fp * 1.05)}px "DM Sans", sans-serif`;
        const w1 = line1 ? ctx.measureText(line1).width : 0;
        ctx.font = `400 ${Math.round(fp * 0.80)}px "DM Sans", sans-serif`;
        const w2 = line2 ? ctx.measureText(line2).width : 0;
        const cardW   = Math.min(Math.round(Math.max(w1, w2) + ipad * 2), imageW - pad * 2);

        const cardX   = imageX + pad;
        const cardY   = imageY + imageH - cardH - pad;
        const r       = Math.round(cardH * 0.22);

        ctx.save();
        // frosted glass base
        ctx.globalAlpha = 0.20; ctx.fillStyle = '#FFFFFF';
        _roundRect(ctx, cardX, cardY, cardW, cardH, r); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.32)';
        ctx.lineWidth = Math.max(1, Math.round(imageH * 0.0008));
        _roundRect(ctx, cardX, cardY, cardW, cardH, r); ctx.stroke();

        const tx = cardX + ipad;
        ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = Math.round(fp * 0.35);
        if (line1) {
            ctx.fillStyle = '#FFFFFF'; ctx.font = `600 ${Math.round(fp * 1.05)}px "DM Sans", sans-serif`;
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(line1, tx, cardY + cardH * 0.36);
        }
        if (line2) {
            ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.font = `400 ${Math.round(fp * 0.80)}px "DM Sans", sans-serif`;
            ctx.shadowBlur = Math.round(fp * 0.18);
            ctx.fillText(line2, tx, cardY + cardH * 0.70);
        }
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
        ctx.restore();
    }

    drawLeicaluxOverlay(ctx, overlay, values) {
        const { barX, barY, barW, barH } = overlay;
        const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
        const isDark = textColor === '#FFFFFF';
        const BG = isDark ? '#000000' : '#FFFFFF';
        const PRIMARY = isDark ? '#FFFFFF' : '#000000';
        const SECONDARY = isDark ? '#666666' : '#888888';
        ctx.fillStyle = BG; ctx.fillRect(barX, barY, barW, barH);

        const fp  = this.getExifFontPx(overlay.imageH);
        const pad = Math.round(barW * 0.044);
        const brand = this.detectBrand(this.currentImage?.exifData);
        const dotColor = { sony: null, nikon: '#FFD100', canon: '#BC0024', fujifilm: '#006C3E', leica: '#E60012' }[brand?.key] || '#E60012';
        const camVal   = values.find(v => v.key === 'camera');
        const apVal    = values.find(v => v.key === 'aperture');
        const focalVal = values.find(v => v.key === 'focalLength');
        const shutVal  = values.find(v => v.key === 'shutter');
        const isoVal   = values.find(v => v.key === 'iso');
        const midY = barY + barH / 2;

        ctx.save(); ctx.textBaseline = 'middle';
        // Red/brand dot (left)
        const dotR = Math.round(barH * 0.085);
        if (brand?.key !== 'sony') {
            ctx.fillStyle = dotColor;
            ctx.beginPath(); ctx.arc(barX + pad + dotR, midY, dotR, 0, Math.PI * 2); ctx.fill();
        }
        // Brand name
        const brandName = (brand ? brand.name : (camVal?.value?.split(' ')[0] || 'CAMERA')).toUpperCase();
        ctx.fillStyle = PRIMARY; ctx.font = `700 ${Math.round(fp * 0.80)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'left';
        const dotGap = brand?.key !== 'sony' ? dotR * 2 + Math.round(barW * 0.016) : 0;
        ctx.fillText(brandName, barX + pad + dotGap, midY, barW * 0.28);
        // Right: focal+aperture / shutter+ISO
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

    drawInstaxOverlay(ctx, overlay, values) {
        const { barX, barY, barW, barH, imageX, imageY, imageW, imageH } = overlay;
        const fw   = this.getFrameWidth();
        const sideM = imageX - fw;
        const CREAM = '#FAF9F6', TEXT = '#3A3A38', MUTED = '#6A6A65', DATE_C = '#8A8A82';
        // Fill outer paper area (four zones around the photo — do NOT cover the photo)
        ctx.fillStyle = CREAM;
        ctx.fillRect(fw, fw, sideM, imageY - fw + imageH + barH);           // left strip
        ctx.fillRect(imageX + imageW, fw, sideM, imageY - fw + imageH + barH); // right strip
        ctx.fillRect(imageX, fw, imageW, sideM);                             // top strip
        ctx.fillRect(barX, barY, barW, barH);                                // bottom bar
        // Very subtle top-of-bar shadow
        const grad = ctx.createLinearGradient(0, barY, 0, barY + Math.round(barH * 0.15));
        grad.addColorStop(0, 'rgba(0,0,0,0.04)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(barX, barY, barW, Math.round(barH * 0.15));
        // Photo subtle border
        ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1;
        ctx.strokeRect(imageX, imageY, imageW, imageH);

        const fp   = this.getExifFontPx(imageH);
        const padL = Math.round(barW * 0.065);
        const camVal   = values.find(v => v.key === 'camera');
        const focalVal = values.find(v => v.key === 'focalLength');
        const apVal    = values.find(v => v.key === 'aperture');
        const isoVal   = values.find(v => v.key === 'iso');
        const dateVal  = values.find(v => v.key === 'date');
        ctx.save();
        if (camVal) {
            ctx.fillStyle = TEXT; ctx.font = `400 ${Math.round(fp * 1.28)}px "Caveat", cursive`;
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillText(camVal.value, barX + padL, barY + Math.round(barH * 0.14), barW * 0.65);
        }
        const exif = [focalVal?.value, apVal?.value, isoVal?.value].filter(Boolean);
        if (exif.length) {
            ctx.fillStyle = MUTED; ctx.font = `400 ${Math.round(fp * 1.02)}px "Caveat", cursive`;
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillText(exif.join('  '), barX + padL, barY + Math.round(barH * 0.44), barW * 0.65);
        }
        if (dateVal) {
            ctx.fillStyle = DATE_C; ctx.font = `400 ${Math.round(fp * 0.94)}px "Caveat", cursive`;
            ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
            ctx.fillText(dateVal.value, barX + barW - padL, barY + barH - Math.round(barH * 0.10));
        }
        ctx.restore();
    }

    drawFilmstockOverlay(ctx, overlay, values) {
        const fw      = this.getFrameWidth();
        const stripH  = overlay.imageY - fw;
        if (stripH <= 0) return;
        const stripW  = overlay.barW;
        const stripX  = overlay.barX;
        const topY    = fw;
        const botY    = overlay.barY;
        const brand   = this.detectBrand(this.currentImage?.exifData);
        // Film stock color schemes
        const schemes = {
            fujifilm: { base: '#1A2420', text: '#6DB38A', accent: '#40A060' },
            canon:    { base: '#1E1418', text: '#E8E0D0', accent: '#BC0024' },
            nikon:    { base: '#1A1A18', text: '#C8C0A8', accent: '#FFD100' },
            default:  { base: '#2D2419', text: '#D4A853', accent: '#E8A020' },
        };
        const sc = schemes[brand?.key] || schemes.default;

        // Draw film base strips
        ctx.fillStyle = sc.base;
        ctx.fillRect(stripX, topY, stripW, stripH);
        ctx.fillRect(stripX, botY, stripW, stripH);

        // Sprocket holes (punch transparent)
        const holeW = Math.round(stripH * 0.55);
        const holeH = Math.round(stripH * 0.72);
        const holeR = Math.round(holeW * 0.38);
        const holeY = (y) => y + (stripH - holeH) / 2;
        const spacing = Math.round(holeW * 2.0);
        const offscreen = document.createElement('canvas');
        offscreen.width = stripW; offscreen.height = stripH;
        const oc = offscreen.getContext('2d');
        oc.fillStyle = sc.base; oc.fillRect(0, 0, stripW, stripH);
        // Subtle grain
        for (let i = 0; i < 1200; i++) {
            const gx = Math.random() * stripW, gy = Math.random() * stripH;
            oc.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
            oc.fillRect(gx, gy, 1, 1);
        }
        oc.globalCompositeOperation = 'destination-out';
        for (let x = Math.round(spacing * 0.4); x < stripW; x += spacing) {
            _roundRect(oc, x - holeW / 2, (stripH - holeH) / 2, holeW, holeH, holeR);
            oc.fill();
        }
        [topY, botY].forEach(sy => ctx.drawImage(offscreen, stripX, sy));
        offscreen.width = 0;

        // Film edge text
        const fp    = Math.max(8, Math.round(stripH * 0.30));
        const midT  = topY + stripH / 2;
        const midB  = botY + stripH / 2;
        const padX  = Math.round(holeW * 0.6);
        ctx.save(); ctx.textBaseline = 'middle'; ctx.fillStyle = sc.text;
        // Top strip: frame numbers + film brand
        ctx.font = `900 ${fp}px "Courier New", monospace`;
        ctx.textAlign = 'left'; ctx.fillText('◀ 5', stripX + padX, midT);
        ctx.textAlign = 'center';
        const brandLabel = (brand ? brand.name.toUpperCase() : 'KODAK') + ' 400';
        ctx.font = `700 ${fp}px "Courier New", monospace`;
        ctx.globalAlpha = 0.78; ctx.fillText('▶ ' + brandLabel, stripX + stripW / 2, midT);
        ctx.globalAlpha = 1; ctx.textAlign = 'right';
        ctx.font = `900 ${fp}px "Courier New", monospace`; ctx.fillText('6 ▶', stripX + stripW - padX, midT);
        // Bottom strip: EXIF data
        ctx.font = `400 ${fp}px "Courier New", monospace`;
        ctx.textAlign = 'center'; ctx.globalAlpha = 0.80;
        const exifLine = values.map(v => v.value).join('  ');
        ctx.fillText(exifLine, stripX + stripW / 2, midB, stripW * 0.88);
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    drawShotonOverlay(ctx, overlay, values) {
        const { barX, barY, barW, barH } = overlay;
        const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
        const isDark = textColor === '#FFFFFF';
        const BG = isDark ? '#000000' : '#FFFFFF';
        const TEXT1 = isDark ? '#F0F0F0' : '#1A1A1A';
        const TEXT2 = isDark ? '#777777' : '#888888';
        const TEXT3 = isDark ? '#555555' : '#AAAAAA';
        const DIV   = isDark ? '#222222' : '#EEEEEE';
        ctx.fillStyle = BG; ctx.fillRect(barX, barY, barW, barH);
        // Top divider
        ctx.strokeStyle = DIV; ctx.lineWidth = Math.max(1, Math.round(overlay.imageH * 0.0005));
        ctx.beginPath(); ctx.moveTo(barX, barY); ctx.lineTo(barX + barW, barY); ctx.stroke();

        const fp   = this.getExifFontPx(overlay.imageH);
        const pad  = Math.round(barW * 0.044);
        const brand = this.detectBrand(this.currentImage?.exifData);
        const camVal  = values.find(v => v.key === 'camera');
        const lensVal = values.find(v => v.key === 'lens');
        const apVal   = values.find(v => v.key === 'aperture');
        const shutVal = values.find(v => v.key === 'shutter');
        const isoVal  = values.find(v => v.key === 'iso');

        // Row 1: Logo circle + camera/lens
        const logoR = Math.round(fp * 1.6);
        const logoX = barX + pad + logoR;
        const logoY = barY + barH * 0.30;
        ctx.save();
        ctx.fillStyle = isDark ? '#2A2A2A' : '#F5F5F5';
        ctx.beginPath(); ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2); ctx.fill();
        // Brand initial in circle
        const initial = brand ? brand.name[0].toUpperCase() : (camVal?.value?.[0] || '?');
        ctx.fillStyle = brand?.accent || TEXT1;
        ctx.font = `700 ${Math.round(fp * 0.88)}px "DM Sans", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(initial, logoX, logoY);
        // Camera name + lens
        const textStartX = barX + pad + logoR * 2 + Math.round(barW * 0.02);
        ctx.fillStyle = TEXT1; ctx.font = `600 ${Math.round(fp * 1.06)}px "DM Sans", sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(camVal?.value || 'Camera', textStartX, barY + barH * 0.24, barW * 0.55);
        ctx.fillStyle = TEXT2; ctx.font = `400 ${Math.round(fp * 0.80)}px "DM Sans", sans-serif`;
        ctx.fillText(lensVal?.value || '', textStartX, barY + barH * 0.38, barW * 0.55);

        // Dashed row divider
        const divY = Math.round(barY + barH * 0.52);
        ctx.setLineDash([Math.round(fp * 0.4), Math.round(fp * 0.4)]);
        ctx.strokeStyle = DIV; ctx.lineWidth = Math.max(1, Math.round(barH * 0.008));
        ctx.beginPath(); ctx.moveTo(barX + pad, divY); ctx.lineTo(barX + barW - pad, divY); ctx.stroke();
        ctx.setLineDash([]);

        // Row 2: 3-column EXIF grid
        const cols = [
            { val: apVal?.value || '—',   label: 'APERTURE' },
            { val: shutVal?.value || '—', label: 'SHUTTER' },
            { val: isoVal?.value || '—',  label: 'ISO' },
        ];
        const colW = barW / 3;
        cols.forEach((col, i) => {
            const cx = barX + colW * i + colW / 2;
            // Column divider
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

    drawEditorialOverlay(ctx, overlay, values) {
        const { barX, barY, barW, barH, imageX, imageY } = overlay;
        const fw   = this.getFrameWidth();
        const margin = imageX - fw;
        const BG = '#FFFFFF', RULE1 = '#1A1A1A', RULE2 = '#CCCCCC';
        const C1 = '#1A1A1A', C2 = '#555555', C3 = '#888888', C4 = '#AAAAAA';
        // Fill margin areas
        ctx.fillStyle = BG;
        ctx.fillRect(fw, fw, imageX - fw, overlay.imageH + margin); // left margin
        ctx.fillRect(imageX + barW, fw, margin, overlay.imageH + margin); // right margin
        ctx.fillRect(barX, barY, barW, barH + fw); // text area

        const fp = this.getExifFontPx(overlay.imageH);
        const camVal   = values.find(v => v.key === 'camera');
        const lensVal  = values.find(v => v.key === 'lens');
        const apVal    = values.find(v => v.key === 'aperture');
        const shutVal  = values.find(v => v.key === 'shutter');
        const isoVal   = values.find(v => v.key === 'iso');
        const focalVal = values.find(v => v.key === 'focalLength');
        const dateVal  = values.find(v => v.key === 'date');

        const ruleX = barX, ruleW = barW;
        let y = barY + Math.round(barH * 0.06);
        // Upper thick rule
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
        // Lower thin rule
        ctx.fillStyle = RULE2; ctx.fillRect(ruleX, y, ruleW, Math.max(1, Math.round(barH * 0.007)));
        ctx.restore();
    }

    drawHudOverlay(ctx, overlay, values) {
        const { barX, barY, barW, barH, imageX, imageY, imageW, imageH } = overlay;
        const fw   = this.getFrameWidth();
        const topH = imageY - fw;
        const BG   = '#0A0A0A';
        const VAL  = '#FFFFFF', LABEL = '#555555', INFO = '#666666';
        // Background strips
        ctx.fillStyle = BG;
        ctx.fillRect(fw, fw, barW, topH);
        ctx.fillRect(barX, barY, barW, barH);
        // Photo border
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = Math.max(1, Math.round(imageH * 0.001));
        ctx.strokeRect(imageX, imageY, imageW, imageH);

        const fp   = this.getExifFontPx(imageH);
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
        // Corner helper
        const drawCorner = (tx, ty, alignH, val, label) => {
            ctx.fillStyle = VAL; ctx.font = `700 ${valPx}px "JetBrains Mono", "SF Mono", monospace`;
            ctx.textAlign = alignH; ctx.textBaseline = 'middle';
            ctx.fillText(val, tx, ty - Math.round(fp * 0.55));
            ctx.fillStyle = LABEL; ctx.font = `500 ${lblPx}px "DM Sans", sans-serif`;
            ctx.fillText(label.toUpperCase(), tx, ty + Math.round(fp * 0.55));
        };
        // Top-left: aperture
        if (apVal)    drawCorner(barX + pad, midTopY, 'left',  apVal.value,    'APERTURE');
        // Top-right: ISO
        if (isoVal)   drawCorner(barX + barW - pad, midTopY, 'right', isoVal.value,   'ISO');
        // Bottom-left: focal
        const botCornerY = barY + Math.round(barH * 0.30);
        if (focalVal) drawCorner(barX + pad, botCornerY, 'left', focalVal.value, 'FOCAL LENGTH');
        // Bottom-right: shutter
        if (shutVal)  drawCorner(barX + barW - pad, botCornerY, 'right', shutVal.value,  'SHUTTER SPEED');

        // Bottom info bar (camera · lens — date)
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

    drawMinimalbarOverlay(ctx, overlay, values) {
        const { barX, barY, barW, barH } = overlay;
        const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
        const isDark = textColor === '#FFFFFF';
        const BG  = isDark ? '#111111' : '#FFFFFF';
        const TXT = isDark ? '#666666' : '#999999';
        const DIV = isDark ? '#333333' : '#E0E0E0';
        ctx.fillStyle = BG; ctx.fillRect(barX, barY, barW, barH);
        // Hairline divider
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
        // Check if single line fits
        const fullLine = [main, dateVal?.value].filter(Boolean).join(sep);
        ctx.textAlign = 'left';
        const lineW = ctx.measureText(fullLine).width;
        if (lineW <= barW - pad * 2) {
            ctx.fillText(fullLine, barX + pad, midY, barW - pad * 2);
        } else {
            // Two lines: main left + date right
            ctx.fillText(main, barX + pad, barY + barH * 0.30, barW * 0.72);
            if (dateVal) {
                ctx.textAlign = 'right';
                ctx.fillText(dateVal.value, barX + barW - pad, barY + barH * 0.72);
            }
        }
        ctx.restore();
    }

    drawCardgridOverlay(ctx, overlay, values) {
        const { barX, barY, barW, barH } = overlay;
        const textColor = this.resolveExifTextColor(ctx, overlay.imageW, overlay.imageH);
        const isDark = textColor === '#FFFFFF';
        const BG    = isDark ? '#1A1A1A' : '#FFFFFF';
        const CARD  = isDark ? '#242424' : '#F8F8F6';
        const CBORD = isDark ? '#333333' : 'transparent';
        const TEXT1 = isDark ? '#E8E8E8' : '#1A1A1A';
        const TEXT2 = isDark ? '#777777' : '#888888';
        const ICOL  = isDark ? '#555555' : '#AAAAAA';
        ctx.fillStyle = BG; ctx.fillRect(barX, barY, barW, barH);
        // Subtle top divider
        ctx.strokeStyle = isDark ? '#2A2A2A' : '#F0F0F0';
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(barX, barY); ctx.lineTo(barX + barW, barY); ctx.stroke();

        const fp   = this.getExifFontPx(overlay.imageH);
        const pad  = Math.round(barW * 0.044);
        const brand   = this.detectBrand(this.currentImage?.exifData);
        const camVal  = values.find(v => v.key === 'camera');
        const lensVal = values.find(v => v.key === 'lens');
        const apVal   = values.find(v => v.key === 'aperture');
        const shutVal = values.find(v => v.key === 'shutter');
        const isoVal  = values.find(v => v.key === 'iso');
        const focalVal = values.find(v => v.key === 'focalLength');
        const dateVal  = values.find(v => v.key === 'date');

        // Brand row
        const logoSz = Math.round(fp * 2.2);
        const logoX  = barX + pad;
        const logoY  = barY + Math.round(barH * 0.08);
        const logoR  = Math.round(logoSz * 0.2);
        ctx.save();
        ctx.fillStyle = isDark ? '#2A2A2A' : '#F5F5F5';
        _roundRect(ctx, logoX, logoY, logoSz, logoSz, logoR); ctx.fill();
        if (CBORD !== 'transparent') {
            ctx.strokeStyle = CBORD; ctx.lineWidth = 1;
            _roundRect(ctx, logoX, logoY, logoSz, logoSz, logoR); ctx.stroke();
        }
        const initial = brand ? brand.name[0].toUpperCase() : (camVal?.value?.[0] || '?');
        ctx.fillStyle = brand?.accent || TEXT1;
        ctx.font = `700 ${Math.round(fp * 0.85)}px "DM Sans", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initial, logoX + logoSz / 2, logoY + logoSz / 2);
        // Camera + lens text
        const tx = logoX + logoSz + Math.round(barW * 0.018);
        ctx.fillStyle = TEXT1; ctx.font = `600 ${Math.round(fp * 0.98)}px "DM Sans", sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(camVal?.value || 'Camera', tx, logoY + logoSz * 0.32, barW * 0.55);
        ctx.fillStyle = TEXT2; ctx.font = `400 ${Math.round(fp * 0.72)}px "DM Sans", sans-serif`;
        ctx.fillText(lensVal?.value || '', tx, logoY + logoSz * 0.72, barW * 0.55);

        // Card grid: 3×2
        const gridY      = barY + Math.round(barH * 0.30);
        const gridBotPad = Math.round(barH * 0.04);
        const gapSz      = Math.round(barW * 0.012);
        const cols       = 3;
        const rows       = 2;
        const cardWi = Math.round((barW - pad * 2 - gapSz * (cols - 1)) / cols);
        const cardHi = Math.round((barY + barH - gridBotPad - gridY - gapSz * (rows - 1)) / rows);
        const cardR  = Math.round(cardWi * 0.12);
        const cards  = [
            { val: apVal?.value,    label: 'Aperture', icon: '◎' },
            { val: shutVal?.value,  label: 'Shutter',  icon: '⚡' },
            { val: isoVal?.value,   label: 'ISO',      icon: '▣' },
            { val: focalVal?.value, label: 'Focal',    icon: '⊕' },
            { val: dateVal?.value,  label: 'Date',     icon: '◈' },
            { val: `${Math.round(overlay.imageW / overlay.imageH * 100) / 100}:1`, label: 'Ratio', icon: '⊞' },
        ];
        cards.forEach((card, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const cx = barX + pad + col * (cardWi + gapSz);
            const cy = gridY + row * (cardHi + gapSz);
            ctx.fillStyle = CARD;
            _roundRect(ctx, cx, cy, cardWi, cardHi, cardR); ctx.fill();
            if (CBORD !== 'transparent') {
                ctx.strokeStyle = CBORD; ctx.lineWidth = 1;
                _roundRect(ctx, cx, cy, cardWi, cardHi, cardR); ctx.stroke();
            }
            const iconPx = Math.max(8, Math.round(fp * 0.72));
            const valPx  = Math.max(9, Math.round(fp * 0.96));
            const lblPx  = Math.max(7, Math.round(fp * 0.58));
            // icon
            ctx.fillStyle = ICOL; ctx.font = `${iconPx}px "DM Sans", sans-serif`;
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillText(card.icon, cx + Math.round(cardWi * 0.12), cy + Math.round(cardHi * 0.12));
            // value
            ctx.fillStyle = TEXT1; ctx.font = `700 ${valPx}px "DM Sans", sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(card.val || '—', cx + cardWi / 2, cy + cardHi * 0.60, cardWi * 0.88);
            // label
            ctx.fillStyle = ICOL; ctx.font = `400 ${lblPx}px "DM Sans", sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.fillText(card.label, cx + cardWi / 2, cy + cardHi * 0.83);
        });
        ctx.restore();
    }

    drawNoExifMessage(ctx, canvasW, canvasH, overlay) {
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
            const barColor = this.resolveExifBarColor(this.exifTextColor === 'black' ? '#000000' : '#FFFFFF');
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

    // --- Style frame helpers ---

    get isStyleFrame() {
        return ['blur', 'gradient', 'pixelate', 'mirror'].includes(this.frameColor);
    }

    updateStyleControlsVisibility() {
        const isBlur = this.frameColor === 'blur';
        const isPixelate = this.frameColor === 'pixelate';
        this.blurControls.style.display = isBlur ? '' : 'none';
        this.mobileBlurControls.style.display = isBlur ? '' : 'none';
        this.pixelateControls.style.display = isPixelate ? '' : 'none';
        this.mobilePixelateControls.style.display = isPixelate ? '' : 'none';
    }

    drawFrameBackground(ctx, img, canvasW, canvasH) {
        const placeholderBg = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#E8E8E8';
        if (this.frameColor === 'auto') {
            if (img) {
                if (!this._autoDominantColor) {
                    this._autoDominantColor = this.extractDominantColor(img);
                }
                ctx.fillStyle = this._autoDominantColor;
            } else {
                ctx.fillStyle = placeholderBg;
            }
            ctx.fillRect(0, 0, canvasW, canvasH);
        } else if (this.isStyleFrame && img) {
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 0, canvasW, canvasH);
            switch (this.frameColor) {
                case 'blur': this.drawBlurBackground(ctx, img, canvasW, canvasH); break;
                case 'gradient': this.drawGradientBackground(ctx, img, canvasW, canvasH); break;
                case 'pixelate': this.drawPixelateBackground(ctx, img, canvasW, canvasH); break;
                case 'mirror': this.drawMirrorBackground(ctx, img, canvasW, canvasH); break;
            }
        } else {
            ctx.fillStyle = (this.isStyleFrame && !img) ? placeholderBg : (this.isStyleFrame ? '#222' : this.frameColor);
            ctx.fillRect(0, 0, canvasW, canvasH);
        }
    }

    drawBlurBackground(ctx, img, canvasW, canvasH) {
        const t = this.blurIntensity / 100;
        const scale = Math.max(0.04, 0.25 - 0.21 * t);
        const smallW = Math.max(24, Math.round(canvasW * scale));
        const smallH = Math.max(24, Math.round(canvasH * scale));

        const coverScale = 1.12 * Math.max(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
        const drawW = img.naturalWidth * coverScale;
        const drawH = img.naturalHeight * coverScale;
        const drawX = (canvasW - drawW) / 2;
        const drawY = (canvasH - drawH) / 2;

        if (!this._blurCanvas) this._blurCanvas = document.createElement('canvas');
        const bc = this._blurCanvas;
        bc.width = smallW;
        bc.height = smallH;
        const bctx = bc.getContext('2d');
        bctx.imageSmoothingEnabled = true;
        bctx.imageSmoothingQuality = 'medium';
        bctx.clearRect(0, 0, smallW, smallH);
        bctx.drawImage(img, drawX * scale, drawY * scale, drawW * scale, drawH * scale);

        const brightness = 0.95 - 0.12 * t;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.globalAlpha = 0.98;
        ctx.filter = `saturate(1.1) brightness(${brightness.toFixed(2)})`;
        ctx.drawImage(bc, 0, 0, smallW, smallH, 0, 0, canvasW, canvasH);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    drawGradientBackground(ctx, img, canvasW, canvasH) {
        // Extract dominant colors from image corners
        if (!this._colorSampleCanvas) this._colorSampleCanvas = document.createElement('canvas');
        const sc = this._colorSampleCanvas;
        const sz = 32;
        sc.width = sz;
        sc.height = sz;
        const sctx = sc.getContext('2d', { willReadFrequently: true });
        sctx.drawImage(img, 0, 0, sz, sz);
        const data = sctx.getImageData(0, 0, sz, sz).data;

        // Sample top-left and bottom-right quadrants for two dominant colors
        let r1 = 0, g1 = 0, b1 = 0, c1 = 0;
        let r2 = 0, g2 = 0, b2 = 0, c2 = 0;
        for (let y = 0; y < sz; y++) {
            for (let x = 0; x < sz; x++) {
                const i = (y * sz + x) * 4;
                if (x + y < sz) {
                    r1 += data[i]; g1 += data[i + 1]; b1 += data[i + 2]; c1++;
                } else {
                    r2 += data[i]; g2 += data[i + 1]; b2 += data[i + 2]; c2++;
                }
            }
        }

        const col1 = `rgb(${Math.round(r1 / c1)},${Math.round(g1 / c1)},${Math.round(b1 / c1)})`;
        const col2 = `rgb(${Math.round(r2 / c2)},${Math.round(g2 / c2)},${Math.round(b2 / c2)})`;

        const gradient = ctx.createLinearGradient(0, 0, canvasW, canvasH);
        gradient.addColorStop(0, col1);
        gradient.addColorStop(1, col2);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasW, canvasH);
    }

    extractDominantColor(img) {
        if (!this._colorSampleCanvas) this._colorSampleCanvas = document.createElement('canvas');
        const sc = this._colorSampleCanvas;
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
        const [h, s, l] = this.rgbToHsl(r, g, b);
        const adjS = Math.min(s, 0.35);
        const adjL = Math.max(l, 0.75);
        const [ar, ag, ab] = this.hslToRgb(h, adjS, adjL);

        return '#' + [ar, ag, ab].map(v => v.toString(16).padStart(2, '0')).join('');
    }

    rgbToHsl(r, g, b) {
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

    hslToRgb(h, s, l) {
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

    drawPixelateBackground(ctx, img, canvasW, canvasH) {
        const t = this.pixelateIntensity / 100;
        // At intensity 0 → large pixels (scale 0.15), at 100 → tiny pixels (scale 0.01)
        const scale = Math.max(0.008, 0.15 - 0.142 * t);
        const smallW = Math.max(3, Math.round(canvasW * scale));
        const smallH = Math.max(3, Math.round(canvasH * scale));

        const coverScale = 1.12 * Math.max(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
        const drawW = img.naturalWidth * coverScale;
        const drawH = img.naturalHeight * coverScale;
        const drawX = (canvasW - drawW) / 2;
        const drawY = (canvasH - drawH) / 2;

        if (!this._pixelCanvas) this._pixelCanvas = document.createElement('canvas');
        const pc = this._pixelCanvas;
        pc.width = smallW;
        pc.height = smallH;
        const pctx = pc.getContext('2d');
        pctx.imageSmoothingEnabled = true;
        pctx.clearRect(0, 0, smallW, smallH);
        pctx.drawImage(img, drawX * scale, drawY * scale, drawW * scale, drawH * scale);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(pc, 0, 0, smallW, smallH, 0, 0, canvasW, canvasH);
        ctx.restore();
    }

    drawMirrorBackground(ctx, img, canvasW, canvasH) {
        const coverScale = 1.05 * Math.max(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
        const dw = img.naturalWidth * coverScale;
        const dh = img.naturalHeight * coverScale;
        const dx = (canvasW - dw) / 2;
        const dy = (canvasH - dh) / 2;

        // Normal center image
        ctx.drawImage(img, dx, dy, dw, dh);

        // Flipped horizontal overlay for mirror/kaleidoscope effect
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.translate(canvasW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();

        // Slight vignette overlay
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvasW, canvasH);
        ctx.restore();
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
        if (this.isDragging) return;
        if (!this.hasImage) return;
        const dataUrl = this.canvas.toDataURL('image/jpeg', 0.85);
        if (this.previewMode === 'feed') {
            this.feedImage.src = dataUrl;
        } else if (this.previewMode === 'profile') {
            this.updateProfileGrid();
        }
    }

    renderItemToDataUrl(item) {
        const dims = this.getCanvasDimensions();
        if (!this._profileTempCanvas) {
            this._profileTempCanvas = document.createElement('canvas');
        }
        const tc = this._profileTempCanvas;
        tc.width = dims.width;
        tc.height = dims.height;
        const ctx = tc.getContext('2d');
        this.drawFrameBackground(ctx, item.image, dims.width, dims.height);

        const photoArea = this.getPhotoArea();
        const draw = this.getDrawDimensions(item.image);
        ctx.save();
        ctx.beginPath();
        ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
        ctx.clip();
        const x = photoArea.x + (photoArea.width - draw.width) / 2 + item.imageOffset.x;
        const y = photoArea.y + (photoArea.height - draw.height) / 2 + item.imageOffset.y;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(item.image, x, y, draw.width, draw.height);
        ctx.restore();
        return tc.toDataURL('image/jpeg', 0.8);
    }

    invalidateProfileCache() {
        this._profileCache = null;
    }

    updateProfileGrid() {
        const totalCells = 9;
        const loaded = this.loadedImages;
        if (loaded.length <= 1) {
            this._profileCache = null;
            // Safe DOM construction — no user-supplied HTML
            while (this.profileGrid.firstChild) this.profileGrid.removeChild(this.profileGrid.firstChild);
            for (let i = 0; i < totalCells; i++) {
                const div = document.createElement('div');
                if (i === 4 && this.hasImage) {
                    div.className = 'profile-grid-item target';
                    div.dataset.index = '0';
                    const img = document.createElement('img');
                    img.className = 'profile-grid-image';
                    img.id = 'profile-grid-image';
                    img.src = this.canvas.toDataURL('image/jpeg', 0.85);
                    img.alt = '';
                    div.appendChild(img);
                } else {
                    div.className = 'profile-grid-item placeholder';
                }
                this.profileGrid.appendChild(div);
            }
            this.profileGridImage = document.getElementById('profile-grid-image');
        } else {
            // Use cache: only re-render the current image
            if (!this._profileCache) this._profileCache = {};
            const cache = this._profileCache;
            const curIdx = this.currentIndex;

            // Always update current image from main canvas
            cache[curIdx] = this.canvas.toDataURL('image/jpeg', 0.85);

            // Build grid — render other images only if not cached
            while (this.profileGrid.firstChild) this.profileGrid.removeChild(this.profileGrid.firstChild);
            for (let i = 0; i < totalCells; i++) {
                const div = document.createElement('div');
                const item = this.images[i];
                if (i < this.images.length && item) {
                    div.className = 'profile-grid-item target' + (i === curIdx ? ' current' : '');
                    div.dataset.index = String(i);
                    const img = document.createElement('img');
                    img.className = 'profile-grid-image';
                    img.alt = '';
                    if (!cache[i]) {
                        cache[i] = this.renderItemToDataUrl(item);
                    }
                    img.src = cache[i];
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
        if (this.isDownloading) return;
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

                // Update UI only when all images are loaded
                if (loadedCount === filesToLoad.length) {
                    this.images = this.images.filter(item => item !== null);
                    if (this.currentIndex >= this.images.length) {
                        this.currentIndex = Math.max(0, this.images.length - 1);
                    }
                    this.onImagesChanged();
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(imageUrl);
                this.images[slotIndex] = null;
                loadedCount++;

                // Update UI only when all images are loaded
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
                if (this.appMode === 'exif') {
                    this.syncExifUI();
                    this.render();
                }
            }
        } catch (e) {
            // Ignore EXIF parse errors
        }
    }

    // --- Image selection ---

    selectImage(index) {
        if (index < 0 || index >= this.images.length) return;
        if (index === this.currentIndex) return;
        const prevIndex = this.currentIndex;
        this.currentIndex = index;

        // Critical path: render canvas + nav arrows immediately
        // Only invalidate cache for the previously selected image (it may have been dragged)
        if (this._profileCache) delete this._profileCache[prevIndex];
        this._autoDominantColor = null;
        this.render(true);
        this.updateNavArrows();
        this.updateThumbnailHighlight();

        // Defer non-critical UI updates
        requestAnimationFrame(() => {
            this.updateInfo();
            this.updateUploadUI();
            this.updateMobilePhotoTab();
            if (this.currentImage) {
                this.displayExif(this.currentImage.exifData);
            }
        });
    }

    // --- Canvas navigation ---

    navigatePrev() {
        if (this.appMode === 'split') {
            if (this.splitCurrentPanel > 0) {
                this.splitCurrentPanel--;
                this.render();
                this.updateNavArrows();
                this.updateSplitThumbnailHighlight();
            }
            return;
        }
        if (this.currentIndex > 0) {
            this.selectImage(this.currentIndex - 1);
        }
    }

    navigateNext() {
        if (this.appMode === 'split') {
            if (this.splitCurrentPanel < this.splitCount - 1) {
                this.splitCurrentPanel++;
                this.render();
                this.updateNavArrows();
                this.updateSplitThumbnailHighlight();
            }
            return;
        }
        if (this.currentIndex < this.images.length - 1) {
            this.selectImage(this.currentIndex + 1);
        }
    }

    updateNavArrows() {
        if (this.appMode === 'split') {
            const show = this.hasImage && this.splitCount > 1;
            const showPrev = show && this.splitCurrentPanel > 0;
            const showNext = show && this.splitCurrentPanel < this.splitCount - 1;
            this.navPrevBtn.classList.toggle('visible', showPrev);
            this.navNextBtn.classList.toggle('visible', showNext);
            this.feedNavPrevBtn.classList.toggle('visible', false);
            this.feedNavNextBtn.classList.toggle('visible', false);
            this.feedDots.style.display = 'none';
            return;
        }
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
        if (removed && removed.imageUrl) URL.revokeObjectURL(removed.imageUrl);

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
        this._autoDominantColor = null;

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
        this.feedMockup.classList.toggle('has-image', has);

        this.updatePreviewContainerSize();

        if (!has) {
            // Reset preview-area width when no images
            const previewArea = this.previewContainer.closest('.preview-area');
            if (previewArea) {
                previewArea.style.width = '';
                previewArea.style.marginLeft = '';
                previewArea.style.marginRight = '';
            }
            this.previewContainer.style.width = '';
            this.previewContainer.style.height = '';

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
            const cur = this.currentImage;
            if (cur) {
                this.displayExif(cur.exifData);
            }
        }

        this.updatePreviewContainerSize();
    }

    // --- Preset system ---

    getCurrentPreset() {
        return {
            canvasRatio: [...this.canvasRatio],
            frameRatio: this.frameRatio,
            frameColor: this.frameColor,
            blurIntensity: this.blurIntensity,
            pixelateIntensity: this.pixelateIntensity,
            exifStyle: this.exifStyle,
            exifFields: { ...this.exifFields },
            exifFontSize: this.exifFontSize,
            exifTextColor: this.exifTextColor,
            exifSeparator: this.exifSeparator,
            exifBarColor: this.exifBarColor
        };
    }

    applyPreset(preset, options = {}) {
        if (preset.canvasRatio) this.canvasRatio = [...preset.canvasRatio];
        if (preset.frameRatio !== undefined) this.frameRatio = preset.frameRatio;
        if (preset.frameColor !== undefined) this.frameColor = preset.frameColor;
        if (preset.blurIntensity !== undefined) this.blurIntensity = preset.blurIntensity;
        if (preset.pixelateIntensity !== undefined) this.pixelateIntensity = preset.pixelateIntensity;
        if (preset.exifStyle !== undefined) this.exifStyle = preset.exifStyle;
        if (preset.exifFields !== undefined) this.exifFields = { ...preset.exifFields };
        if (preset.exifFontSize !== undefined) this.exifFontSize = preset.exifFontSize;
        if (preset.exifTextColor !== undefined) this.exifTextColor = preset.exifTextColor;
        if (preset.exifSeparator !== undefined) this.exifSeparator = preset.exifSeparator;
        if (preset.exifBarColor !== undefined) this.exifBarColor = preset.exifBarColor;

        if (this.frameColor === 'auto') this._autoDominantColor = null;

        this.syncAllUI();

        if (!options.skipRender) {
            this.resetAllOffsets();
            this.updateCanvasSize();
            this.render();
            this.updateInfo();
        }
    }

    syncAllUI() {
        const ratioStr = this.canvasRatio[0] + ':' + this.canvasRatio[1];
        this.ratioButtons.querySelectorAll('.ratio-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.ratio === ratioStr));
        this.mobileRatioButtons.querySelectorAll('.ratio-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.ratio === ratioStr));

        this.frameRatioSlider.value = this.frameRatio;
        this.frameRatioInput.value = this.frameRatio;
        this.mobileFrameRatioSlider.value = this.frameRatio;
        this.mobileFrameRatioInput.value = this.frameRatio;
        this.syncFramePxInputs();

        const color = this.frameColor;
        this.colorPresets.querySelectorAll('.color-swatch').forEach(s =>
            s.classList.toggle('active', s.dataset.color === color));
        this.mobileColorPresets.querySelectorAll('.color-swatch').forEach(s =>
            s.classList.toggle('active', s.dataset.color === color));
        if (!this.isStyleFrame && color !== 'auto') {
            this.customColorInput.value = color;
            this.mobileCustomColorInput.value = color;
        }

        this.blurSlider.value = this.blurIntensity;
        this.mobileBlurSlider.value = this.blurIntensity;
        this.blurValueLabel.textContent = this.blurIntensity;
        this.mobileBlurValueLabel.textContent = this.blurIntensity;
        this.pixelateSlider.value = this.pixelateIntensity;
        this.mobilePixelateSlider.value = this.pixelateIntensity;
        this.pixelateValueLabel.textContent = this.pixelateIntensity;
        this.mobilePixelateValueLabel.textContent = this.pixelateIntensity;

        this.updateStyleControlsVisibility();
    }

    // --- Convert mode helpers ---

    checkWebPSupport() {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        this.supportsWebP = c.toDataURL('image/webp').startsWith('data:image/webp');
        if (!this.supportsWebP) {
            document.querySelectorAll('.format-btn[data-format="webp"]').forEach(b => { b.disabled = true; });
        }
    }

    getMimeType() {
        return { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[this.outputFormat];
    }

    getExtension() {
        return { png: '.png', jpeg: '.jpg', webp: '.webp' }[this.outputFormat];
    }

    getBlobArgs() {
        const mime = this.getMimeType();
        const quality = this.outputFormat === 'png' ? undefined : this.outputQuality / 100;
        return [mime, quality];
    }

    updateDownloadLabel() {
        let label;
        if (this.appMode === 'exif') {
            label = 'EXIF 프레임 다운로드';
        } else if (this.appMode === 'convert') {
            const fmt = this.outputFormat.toUpperCase().replace('JPEG', 'JPG');
            label = this.outputFormat === 'png'
                ? `${fmt} 다운로드 (무손실)`
                : `${fmt} 다운로드 (${this.outputQuality}%)`;
        } else {
            label = 'PNG 다운로드 (무손실)';
        }
        const btnLabel = this.downloadBtn.querySelector('.btn-label');
        if (btnLabel) btnLabel.textContent = label;
    }

    updateQualityControlState() {
        const disabled = this.outputFormat === 'png';
        [this.qualityControl, this.mobileQualityControl].forEach(el => {
            if (el) el.classList.toggle('disabled', disabled);
        });
        [this.qualitySlider, this.mobileQualitySlider].forEach(el => {
            if (el) el.disabled = disabled;
        });
    }

    syncFormatUI() {
        const fmt = this.outputFormat;
        [this.formatButtons, this.mobileFormatButtons].forEach(container => {
            if (!container) return;
            container.querySelectorAll('.format-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.format === fmt));
        });
        [this.qualitySlider, this.mobileQualitySlider].forEach(el => {
            if (el) el.value = this.outputQuality;
        });
        [this.qualityValue, this.mobileQualityValue].forEach(el => {
            if (el) el.textContent = this.outputQuality + '%';
        });
        this.updateQualityControlState();
        this.updateDownloadLabel();
    }

    syncExifUI() {
        // Style buttons
        [this.exifStyleButtons, this.mobileExifStyleButtons].forEach(c => {
            if (!c) return;
            c.querySelectorAll('.exif-style-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.style === this.exifStyle));
        });
        // Field toggles
        [this.exifFieldToggles, this.mobileExifFieldToggles].forEach(c => {
            if (!c) return;
            c.querySelectorAll('input[data-field]').forEach(cb => {
                cb.checked = this.exifFields[cb.dataset.field];
                if (this.currentImage && this.currentImage.exifData) {
                    const hasValue = this.checkExifFieldAvailable(cb.dataset.field);
                    cb.disabled = !hasValue;
                    cb.closest('.exif-field-toggle').classList.toggle('unavailable', !hasValue);
                } else {
                    cb.disabled = false;
                    cb.closest('.exif-field-toggle').classList.remove('unavailable');
                }
            });
        });
        // Font size
        [this.exifFontSizeButtons, this.mobileExifFontSizeButtons].forEach(c => {
            if (!c) return;
            c.querySelectorAll('.size-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.size === this.exifFontSize));
        });
        // Text color
        [this.exifTextColorButtons, this.mobileExifTextColorButtons].forEach(c => {
            if (!c) return;
            c.querySelectorAll('.color-opt').forEach(b =>
                b.classList.toggle('active', b.dataset.color === this.exifTextColor));
        });
        // Bar color
        [this.exifBarColorButtons, this.mobileExifBarColorButtons].forEach(c => {
            if (!c) return;
            c.querySelectorAll('.color-opt').forEach(b =>
                b.classList.toggle('active', b.dataset.color === this.exifBarColor));
        });
        // Separator
        [this.exifSeparatorButtons, this.mobileExifSeparatorButtons].forEach(c => {
            if (!c) return;
            c.querySelectorAll('.sep-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.sep === this.exifSeparator));
        });
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

        // Style
        bindBtns(this.exifStyleButtons, this.mobileExifStyleButtons, 'style', v => { this.exifStyle = v; });
        // Font size
        bindBtns(this.exifFontSizeButtons, this.mobileExifFontSizeButtons, 'size', v => { this.exifFontSize = v; });
        // Text color
        bindBtns(this.exifTextColorButtons, this.mobileExifTextColorButtons, 'color', v => { this.exifTextColor = v; });
        // Bar color
        bindBtns(this.exifBarColorButtons, this.mobileExifBarColorButtons, 'color', v => { this.exifBarColor = v; });
        // Separator
        bindBtns(this.exifSeparatorButtons, this.mobileExifSeparatorButtons, 'sep', v => { this.exifSeparator = v; });

        // Field toggles
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
    }

    // --- Settings persistence ---

    saveLastSettings() {
        try {
            localStorage.setItem('pfm-last-settings', JSON.stringify(this.getCurrentPreset()));
        } catch (e) { /* ignore */ }
    }

    loadLastSettings() {
        try {
            const saved = localStorage.getItem('pfm-last-settings');
            if (saved) this.applyPreset(JSON.parse(saved), { skipRender: true });
        } catch (e) { /* ignore */ }
    }

    // --- Favorites ---

    getFavorites() {
        try {
            return JSON.parse(localStorage.getItem('pfm-favorites') || '[]');
        } catch (e) { return []; }
    }

    saveFavorite() {
        const favorites = this.getFavorites();
        if (favorites.length >= 5) return;
        const preset = this.getCurrentPreset();
        preset.name = '';
        favorites.push(preset);
        try {
            localStorage.setItem('pfm-favorites', JSON.stringify(favorites));
        } catch (e) { /* ignore */ }
        this.renderFavoritesUI();
    }

    removeFavorite(index) {
        const favorites = this.getFavorites();
        favorites.splice(index, 1);
        try {
            localStorage.setItem('pfm-favorites', JSON.stringify(favorites));
        } catch (e) { /* ignore */ }
        this.renderFavoritesUI();
    }

    renderFavoritesUI() {
        const favorites = this.getFavorites();
        const buildList = (container) => {
            container.textContent = '';
            favorites.forEach((fav, i) => {
                const item = document.createElement('div');
                item.className = 'favorite-item';
                item.dataset.index = i;

                const preview = document.createElement('div');
                preview.className = 'favorite-preview';
                if (fav.frameColor === 'auto') {
                    preview.style.background = 'conic-gradient(from 0deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#9b59b6,#ff6b6b)';
                } else if (fav.frameColor.startsWith('#')) {
                    preview.style.background = fav.frameColor;
                }
                preview.style.aspectRatio = fav.canvasRatio[0] + '/' + fav.canvasRatio[1];
                const inner = document.createElement('div');
                inner.className = 'favorite-preview-inner';
                preview.appendChild(inner);

                const name = document.createElement('span');
                name.className = 'favorite-name';
                name.textContent = fav.name || (fav.canvasRatio[0] + ':' + fav.canvasRatio[1] + ' ' + fav.frameRatio + '%');

                const removeBtn = document.createElement('button');
                removeBtn.className = 'favorite-remove';
                removeBtn.dataset.index = i;
                removeBtn.textContent = '\u00d7';
                removeBtn.title = '삭제';

                item.append(preview, name, removeBtn);
                container.appendChild(item);
            });
        };
        buildList(this.favoritesList);
        buildList(this.mobileFavoritesList);

        this.favoritesEmpty.style.display = favorites.length === 0 ? '' : 'none';
        const full = favorites.length >= 5;
        this.favoriteSaveBtn.disabled = full;
        this.mobileFavoriteSaveBtn.disabled = full;
    }

    // --- Reset all offsets ---

    resetAllOffsets() {
        this.images.forEach(item => {
            if (item) item.imageOffset = { x: 0, y: 0 };
        });
    }

    // --- Thumbnail strip ---

    updateThumbnailStrip() {
        if (this.appMode === 'split') {
            this.updateSplitThumbnails();
            return;
        }
        const loaded = this.loadedImages;
        if (loaded.length <= 1) {
            this.thumbnailStrip.style.display = 'none';
            this.returnThumbnailStrip();
            return;
        }

        this.thumbnailCounter.textContent = `${this.currentIndex + 1}/${this.images.length}`;
        this.thumbnailAddBtn.style.display = this.images.length >= 10 ? 'none' : '';

        this.thumbnailList.innerHTML = this.images.map((item, i) => {
            if (!item) return '';
            return `
            <div class="thumbnail-item ${i === this.currentIndex ? 'active' : ''}" data-index="${i}">
                <img src="${item.imageUrl}" alt="${escapeHtml(item.fileName)}">
                <button class="thumbnail-remove" data-index="${i}" type="button" aria-label="사진 ${i + 1} 삭제">&times;</button>
            </div>`;
        }).join('');

        const isMobile = window.innerWidth <= 900;
        if (isMobile) {
            this.thumbnailList.appendChild(this.thumbnailAddBtn);
            // Move strip into photo panel slot if photo tab is open
            if (this.activeTab === 'photo') {
                this.mobileThumbnailSlot.appendChild(this.thumbnailStrip);
            }
        } else {
            this.thumbnailStrip.style.display = '';
            if (this.thumbnailAddBtn.parentElement === this.thumbnailList) {
                this.thumbnailStrip.insertBefore(this.thumbnailAddBtn, this.thumbnailCounter);
            }
        }

        // Scroll active thumbnail into view (desktop only, mobile uses grid)
        if (!isMobile) {
            requestAnimationFrame(() => {
                const activeThumb = this.thumbnailList.querySelector('.thumbnail-item.active');
                if (activeThumb) {
                    activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            });
        }
    }

    updateThumbnailHighlight() {
        const items = this.thumbnailList.querySelectorAll('.thumbnail-item');
        items.forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.index) === this.currentIndex);
        });
        const label = `${this.currentIndex + 1}/${this.images.length}`;
        this.thumbnailCounter.textContent = label;

        if (window.innerWidth > 900) {
            const activeThumb = this.thumbnailList.querySelector('.thumbnail-item.active');
            if (activeThumb) {
                activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }
    }

    updateSplitThumbnails() {
        const cur = this.currentImage;
        if (!cur || this.splitCount <= 1) {
            this.thumbnailStrip.style.display = 'none';
            this.returnThumbnailStrip();
            return;
        }

        this.thumbnailCounter.textContent = `${this.splitCurrentPanel + 1}/${this.splitCount}`;
        this.thumbnailAddBtn.style.display = 'none';

        const img = cur.image;
        const strip = this.getSplitStripDimensions(img);

        this.thumbnailList.innerHTML = '';

        for (let i = 0; i < this.splitCount; i++) {
            const div = document.createElement('div');
            div.className = `thumbnail-item${i === this.splitCurrentPanel ? ' active' : ''}`;
            div.dataset.index = i;

            const canvas = document.createElement('canvas');
            canvas.width = 130;
            canvas.height = 130;
            const ctx = canvas.getContext('2d');

            // Draw strip fitted in thumbnail
            const src = this.getSplitSourceRect(img, i);
            const stripAspect = strip.width / strip.height;
            let dx, dy, dw, dh;
            if (stripAspect > 1) {
                dw = 130;
                dh = dw / stripAspect;
                dx = 0;
                dy = (130 - dh) / 2;
            } else {
                dh = 130;
                dw = dh * stripAspect;
                dx = (130 - dw) / 2;
                dy = 0;
            }

            ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, dx, dy, dw, dh);
            div.appendChild(canvas);
            this.thumbnailList.appendChild(div);
        }

        const isMobile = window.innerWidth <= 900;
        if (isMobile && this.activeTab === 'photo') {
            this.mobileThumbnailSlot.appendChild(this.thumbnailStrip);
        }

        this.thumbnailStrip.style.display = '';
    }

    updateSplitThumbnailHighlight() {
        const items = this.thumbnailList.querySelectorAll('.thumbnail-item');
        items.forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.index) === this.splitCurrentPanel);
        });
        this.thumbnailCounter.textContent = `${this.splitCurrentPanel + 1}/${this.splitCount}`;
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
                <div class="upload-filename">${escapeHtml(cur.fileName)}${countLabel}</div>
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
        let label;
        let mobileText;

        if (this.appMode === 'split' && this.hasImage) {
            label = `ZIP 다운로드 (${this.splitCount}장 분할)`;
            mobileText = 'ZIP';
        } else if (this.hasMultipleImages) {
            label = `ZIP 다운로드 (${this.imageCount}장)`;
            mobileText = 'ZIP';
        } else if (this.appMode === 'exif') {
            label = 'EXIF 프레임 다운로드';
            mobileText = '저장';
        } else if (this.appMode === 'convert') {
            const fmt = this.outputFormat.toUpperCase().replace('JPEG', 'JPG');
            label = this.outputFormat === 'png'
                ? `${fmt} 다운로드 (무손실)`
                : `${fmt} 다운로드 (${this.outputQuality}%)`;
            mobileText = '저장';
        } else {
            label = 'PNG 다운로드 (무손실)';
            mobileText = '저장';
        }

        const btnLabel = this.downloadBtn.querySelector('.btn-label');
        if (btnLabel) btnLabel.textContent = label;

        const mobileLabel = this.mobileTabBar?.querySelector('[data-tab="download"] span');
        if (mobileLabel) {
            mobileLabel.textContent = mobileText;
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
        this.dragStartOffset = this.appMode === 'split'
            ? { x: 0, y: 0 }
            : { ...this.currentImage.imageOffset };
        this.canvas.style.cursor = this.appMode === 'split' ? 'default' : 'grabbing';
    }

    onDragMove(e) {
        if (!this.currentImage) return;

        const coords = this.getCanvasCoords(e);

        if (!this.isDragging) {
            this.canvas.style.cursor = 'default';
            return;
        }

        // In split mode, don't allow dragging (only swipe for navigation)
        if (this.appMode === 'split') return;

        const dx = coords.x - this.dragStart.x;
        const dy = coords.y - this.dragStart.y;

        this.currentImage.imageOffset = {
            x: this.dragStartOffset.x + dx,
            y: this.dragStartOffset.y + dy
        };

        this.clampOffset();
        if (!this._dragRafPending) {
            this._dragRafPending = true;
            requestAnimationFrame(() => {
                this._dragRafPending = false;
                this.render();
            });
        }
    }

    onDragEnd() {
        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
            this.render(); // Final render with mockup update
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
            let origText;
            if (this.appMode === 'split') {
                const strip = this.getSplitStripDimensions(cur.image);
                origText = `${cur.image.naturalWidth} × ${cur.image.naturalHeight} px (패널 ${this.splitCurrentPanel + 1}/${this.splitCount})`;
            } else {
                origText = `${cur.image.naturalWidth} × ${cur.image.naturalHeight} px`;
            }
            this.infoOriginalLabel.style.display = '';
            this.infoOriginal.style.display = '';
            this.infoOriginal.textContent = origText;
            this.mobileInfoOriginalLabel.style.display = '';
            this.mobileInfoOriginal.style.display = '';
            this.mobileInfoOriginal.textContent = origText;

            const draw = this.appMode === 'split'
                ? this.getSplitDrawDimensions(cur.image)
                : this.getDrawDimensions(cur.image);
            let sourceWidth, sourceHeight;
            if (this.appMode === 'split') {
                const strip = this.getSplitStripDimensions(cur.image);
                sourceWidth = strip.width;
                sourceHeight = strip.height;
            } else {
                sourceWidth = cur.image.naturalWidth;
                sourceHeight = cur.image.naturalHeight;
            }
            const scaleX = draw.width / sourceWidth;
            const scaleY = draw.height / sourceHeight;
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
            `<span class="info-label">${escapeHtml(label)}</span><span class="info-value">${escapeHtml(value)}</span>`
        ).join('');
        this.exifGrid.innerHTML = html;
        this.exifSection.style.display = '';
        this.mobileExifGrid.innerHTML = html;
        this.mobileExifSection.style.display = '';
    }

    // --- EXIF frame helpers ---

    getActiveExifValues() {
        const cur = this.currentImage;
        if (!cur || !cur.exifData) return [];
        const data = cur.exifData;
        const result = [];
        for (const [key, enabled] of Object.entries(this.exifFields)) {
            if (!enabled) continue;
            let value = null;
            switch (key) {
                case 'camera': {
                    const make = data[0x010F] || '';
                    const model = data[0x0110] || '';
                    if (model) value = model.startsWith(make) ? model : (make ? `${make} ${model}` : model);
                    break;
                }
                case 'lens': value = data[0xA434] || null; break;
                case 'focalLength':
                    if (data[0x920A]) value = `${Math.round(data[0x920A].value)}mm`;
                    break;
                case 'aperture':
                    if (data[0x829D]) { const f = data[0x829D].value; value = `f/${f % 1 === 0 ? f.toFixed(0) : f.toFixed(1)}`; }
                    break;
                case 'shutter':
                    if (data[0x829A]) { const { num, den } = data[0x829A]; if (num && den) { const ss = num / den; value = ss >= 1 ? `${ss}s` : `1/${Math.round(den / num)}s`; } }
                    break;
                case 'iso':
                    if (data[0x8827]) value = `ISO ${data[0x8827]}`;
                    break;
                case 'date': {
                    const dateStr = data[0x9003] || data[0x0132];
                    if (dateStr) value = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1.$2.$3');
                    break;
                }
            }
            if (value) result.push({ key, value });
        }
        return result;
    }

    detectBrand(exifData) {
        if (!exifData) return null;
        const make = (exifData[0x010F] || '').toLowerCase();
        for (const [key, theme] of Object.entries(BRAND_THEMES)) {
            if (make.includes(key)) return { key, ...theme };
        }
        return null;
    }

    getExifFontPx(canvasHeight) {
        return Math.round(canvasHeight * (EXIF_FONT_SIZES[this.exifFontSize] || 0.02));
    }

    resolveExifTextColor(ctx, canvasW, canvasH) {
        if (this.exifTextColor !== 'auto') return this.exifTextColor === 'white' ? '#FFFFFF' : '#000000';
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

    resolveExifBarColor(textColor) {
        if (this.exifBarColor === 'transparent') return 'transparent';
        if (this.exifBarColor === 'auto') return textColor === '#FFFFFF' ? '#000000' : '#FFFFFF';
        return this.exifBarColor === 'white' ? '#FFFFFF' : '#000000';
    }

    hasExifData() {
        return !!(this.currentImage && this.currentImage.exifData);
    }

    checkExifFieldAvailable(field) {
        const data = this.currentImage?.exifData;
        if (!data) return false;
        switch (field) {
            case 'camera': return !!(data[0x010F] || data[0x0110]);
            case 'lens': return !!data[0xA434];
            case 'focalLength': return !!data[0x920A];
            case 'aperture': return !!data[0x829D];
            case 'shutter': return !!data[0x829A];
            case 'iso': return !!data[0x8827];
            case 'date': return !!(data[0x9003] || data[0x0132]);
            default: return false;
        }
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

            if (tab === 'photo' && !this.hasImage) {
                this.fileInput.click();
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

            this.syncFramePxInputs();
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
                this.syncFramePxInputs();
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

            this.syncFramePxInputs();
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
            this.syncFramePxInputs();
            this.resetAllOffsets();
            this.render();
            this.updateInfo();
        });

        // Mobile frame ratio pixel input
        this.mobileFrameRatioPxInput.addEventListener('input', () => {
            let px = parseInt(this.mobileFrameRatioPxInput.value, 10);
            if (isNaN(px)) return;
            const maxPx = Math.round(this.canvasSize * 25 / 100);
            px = Math.max(0, Math.min(maxPx, px));
            const pct = this.canvasSize > 0 ? (px / this.canvasSize) * 100 : 0;
            const rounded = Math.round(pct * 2) / 2;
            this.frameRatio = rounded;
            this.frameRatioSlider.value = rounded;
            this.frameRatioInput.value = rounded;
            this.mobileFrameRatioSlider.value = rounded;
            this.mobileFrameRatioInput.value = rounded;
            this.frameRatioPxInput.value = px;
            this.resetAllOffsets();
            this.render();
            this.updateInfo();
        });
        this.mobileFrameRatioPxInput.addEventListener('change', () => {
            this.syncFramePxInputs();
        });

        // Mobile color presets
        this.mobileColorPresets.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;
            const color = swatch.dataset.color;
            this.colorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
            this.mobileColorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
            this.frameColor = color;
            if (!this.isStyleFrame) {
                this.customColorInput.value = color;
                this.mobileCustomColorInput.value = color;
            }

            this.updateStyleControlsVisibility();
            this.render();
        });

        this.mobileCustomColorInput.addEventListener('input', () => {
            this.frameColor = this.mobileCustomColorInput.value;
            this.customColorInput.value = this.frameColor;
            this.colorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            this.mobileColorPresets.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));

            this.updateStyleControlsVisibility();
            this.render();
        });

        // Mobile blur intensity slider
        this.mobileBlurSlider.addEventListener('input', () => {
            this.blurIntensity = parseInt(this.mobileBlurSlider.value);
            this.blurSlider.value = this.blurIntensity;
            this.blurValueLabel.textContent = this.blurIntensity;
            this.mobileBlurValueLabel.textContent = this.blurIntensity;
            this.render();
        });

        // Mobile pixelate intensity slider
        this.mobilePixelateSlider.addEventListener('input', () => {
            this.pixelateIntensity = parseInt(this.mobilePixelateSlider.value);
            this.pixelateSlider.value = this.pixelateIntensity;
            this.pixelateValueLabel.textContent = this.pixelateIntensity;
            this.mobilePixelateValueLabel.textContent = this.pixelateIntensity;
            this.render();
        });

        // Mobile split direction buttons
        this.mobileSplitDirectionButtons.addEventListener('click', (e) => {
            const btn = e.target.closest('.split-btn');
            if (!btn) return;
            this.setSplitDirection(btn.dataset.direction);
        });

        // Mobile split buttons
        this.mobileSplitButtons.addEventListener('click', (e) => {
            const btn = e.target.closest('.split-btn');
            if (!btn) return;
            this.setSplitCount(parseInt(btn.dataset.split));
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

        // Move thumbnail strip into photo panel when photo tab opens
        if (tab === 'photo' && this.hasMultipleImages) {
            this.mobileThumbnailSlot.appendChild(this.thumbnailStrip);
        } else {
            this.returnThumbnailStrip();
        }
    }

    closeTabPanel() {
        this.activeTab = null;
        this.mobileTabBar.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        this.mobileTabPanels.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        this.sheetBackdrop.classList.remove('active');
        this.returnThumbnailStrip();
    }

    returnThumbnailStrip() {
        if (this.thumbnailStrip.parentElement !== this.thumbnailStripParent) {
            this.thumbnailStripParent.insertBefore(this.thumbnailStrip, this.thumbnailStripParent.querySelector('.preview-toolbar'));
        }
    }

    // --- Download ---

    setDownloadLock(locked) {
        this.isDownloading = locked;
        this.fileInput.disabled = locked;
        this.uploadZone.style.pointerEvents = locked ? 'none' : '';
        this.previewRemoveBtn.style.pointerEvents = locked ? 'none' : '';
        this.thumbnailAddBtn.style.pointerEvents = locked ? 'none' : '';
        // Disable all thumbnail remove buttons
        this.thumbnailList.querySelectorAll('.thumbnail-remove').forEach(btn => {
            btn.style.pointerEvents = locked ? 'none' : '';
        });
    }

    async download() {
        if (!this.hasImage || this.isDownloading) return;

        this.setDownloadLock(true);
        try {
            if (this.appMode === 'convert') {
                await this.downloadConverted();
                return;
            }
            if (this.appMode === 'split') {
                await this.downloadSplit();
                return;
            }

            if (this.hasMultipleImages) {
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) {
                    await this.downloadMultipleAsImages();
                } else {
                    await this.downloadAsZip();
                }
            } else {
                await this.downloadSingle();
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Download failed:', err);
                this.showToast('다운로드에 실패했습니다');
            }
        } finally {
            this.hideProgress();
            this.setDownloadLock(false);
        }
    }

    async downloadConverted() {
        const [mime, quality] = this.getBlobArgs();
        const ext = this.getExtension();
        const items = this.loadedImages;

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
            await this.triggerDownload(blob, baseName + ext);
        } else {
            // Multiple images
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const total = items.length;
            this.showProgress(0, total);

            if (isMobile) {
                const files = [];
                for (let i = 0; i < total; i++) {
                    const item = items[i];
                    const blob = await this.renderConvertedBlob(item, mime, quality);
                    const baseName = item.fileName ? item.fileName.replace(/\.[^.]+$/, '') : `photo_${i + 1}`;
                    files.push(new File([blob], baseName + ext, { type: mime }));
                    this.showProgress(i + 1, total);
                }
                if (navigator.canShare && navigator.canShare({ files })) {
                    await navigator.share({ files });
                } else {
                    for (const file of files) {
                        await this.triggerDownload(file, file.name);
                    }
                }
            } else if (typeof JSZip !== 'undefined') {
                const zip = new JSZip();
                for (let i = 0; i < total; i++) {
                    const item = items[i];
                    const blob = await this.renderConvertedBlob(item, mime, quality);
                    const baseName = item.fileName ? item.fileName.replace(/\.[^.]+$/, '') : `photo_${i + 1}`;
                    zip.file(baseName + ext, blob);
                    this.showProgress(i + 1, total);
                }
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                await this.triggerDownload(zipBlob, 'photos_converted.zip');
            } else {
                for (let i = 0; i < total; i++) {
                    const item = items[i];
                    const blob = await this.renderConvertedBlob(item, mime, quality);
                    const baseName = item.fileName ? item.fileName.replace(/\.[^.]+$/, '') : `photo_${i + 1}`;
                    await this.triggerDownload(blob, baseName + ext);
                    this.showProgress(i + 1, total);
                }
            }
        }
    }

    async renderConvertedBlob(item, mime, quality) {
        const img = item.image;
        const offscreen = document.createElement('canvas');
        offscreen.width = img.naturalWidth;
        offscreen.height = img.naturalHeight;
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return await new Promise((resolve, reject) => {
            offscreen.toBlob(b => {
                offscreen.width = 0; offscreen.height = 0;
                b ? resolve(b) : reject(new Error('toBlob failed'));
            }, mime, quality);
        });
    }

    async downloadMultipleAsImages() {
        const total = this.images.length;
        const dims = this.getCanvasDimensions();
        const photoArea = this.getPhotoArea();

        this.showProgress(0, total);

        const nameCount = {};
        const files = [];

        for (let i = 0; i < total; i++) {
            const item = this.images[i];
            this.showProgress(i + 1, total);

            const blob = await this.renderItemToBlob(item, dims, photoArea);

            const baseName = item.fileName ? item.fileName.replace(/\.[^.]+$/, '') : 'photo';
            let fileName = `${baseName}_pfm.png`;
            if (nameCount[fileName]) {
                nameCount[fileName]++;
                fileName = `${baseName}_pfm(${nameCount[fileName]}).png`;
            } else {
                nameCount[fileName] = 1;
            }

            files.push({ blob, fileName });
        }

        // Try batch share (iOS Safari: one share sheet for all files)
        if (await this.tryBatchShare(files)) {
            this.hideProgress();
            return;
        }

        // Fallback: download one by one
        for (let i = 0; i < files.length; i++) {
            await this.triggerDownload(files[i].blob, files[i].fileName);
            if (i < files.length - 1) await new Promise(r => setTimeout(r, 300));
        }

        this.hideProgress();
    }

    async downloadSplit() {
        const cur = this.currentImage;
        if (!cur) return;

        const dims = this.getCanvasDimensions();
        const photoArea = this.getPhotoArea();
        const total = this.splitCount;
        const baseName = cur.fileName ? cur.fileName.replace(/\.[^.]+$/, '') : 'photo';
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        this.showProgress(0, total);

        if (isMobile) {
            const files = [];
            for (let i = 0; i < total; i++) {
                this.showProgress(i + 1, total);
                const blob = await this.renderSplitPanelToBlob(cur, dims, photoArea, i);
                files.push({ blob, fileName: `${baseName}_split_${i + 1}.png` });
            }

            // Try batch share (iOS Safari: one share sheet for all files)
            if (await this.tryBatchShare(files)) {
                this.hideProgress();
                return;
            }

            // Fallback: download one by one
            for (let i = 0; i < files.length; i++) {
                await this.triggerDownload(files[i].blob, files[i].fileName);
                if (i < files.length - 1) await new Promise(r => setTimeout(r, 300));
            }
            this.hideProgress();
            return;
        }

        // Desktop: ZIP download
        const files = [];
        for (let i = 0; i < total; i++) {
            this.showProgress(i + 1, total);
            const blob = await this.renderSplitPanelToBlob(cur, dims, photoArea, i);
            files.push({ name: `${baseName}_split_${i + 1}.png`, blob });
        }

        if (typeof JSZip === 'undefined') {
            this.hideProgress();
            this.showToast('ZIP 라이브러리 로딩 중... 잠시 후 다시 시도해주세요.');
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            document.head.appendChild(script);
            return;
        }

        const zip = new JSZip();
        for (const f of files) zip.file(f.name, f.blob);

        this.showProgress(total, total, '압축 중...');

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 1 }
        });

        await this.triggerDownload(zipBlob, `${baseName}_split_${total}장.zip`);
        this.hideProgress();
    }

    async downloadSingle() {
        const cur = this.currentImage;
        if (!cur) return;

        if (this.appMode === 'exif') {
            await this.downloadExifFrame();
            return;
        }

        const dims = this.getCanvasDimensions();
        const offscreen = document.createElement('canvas');
        offscreen.width = dims.width;
        offscreen.height = dims.height;
        const ctx = offscreen.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        this.drawFrameBackground(ctx, cur.image, dims.width, dims.height);

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

        const blob = await new Promise((resolve, reject) => {
            offscreen.toBlob(b => {
                offscreen.width = 0;
                offscreen.height = 0;
                b ? resolve(b) : reject(new Error('Canvas toBlob failed'));
            }, 'image/png');
        });

        const baseName = cur.fileName ? cur.fileName.replace(/\.[^.]+$/, '') : 'photo';
        const fileName = `${baseName}_pfm.png`;

        await this.triggerDownload(blob, fileName);
    }

    async downloadExifFrame() {
        const cur = this.currentImage;
        if (!cur) return;

        const imgNW = cur.image.naturalWidth;
        const imgNH = cur.image.naturalHeight;
        const innerDims = { width: imgNW, height: imgNH };
        const overlay = this.getExifOverlayDimensions(innerDims);
        const fw = this.getFrameWidth();
        const totalW = overlay.canvasWidth + fw * 2;
        const totalH = overlay.canvasHeight + fw * 2;

        const offscreen = document.createElement('canvas');
        offscreen.width = totalW;
        offscreen.height = totalH;
        const ctx = offscreen.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw frame background
        this.drawFrameBackground(ctx, cur.image, totalW, totalH);

        // Offset overlay positions by frame width
        const ox = { ...overlay, imageX: overlay.imageX + fw, imageY: overlay.imageY + fw, barX: overlay.barX + fw, barY: overlay.barY + fw };

        // Draw image at original ratio (no crop)
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox.imageX, ox.imageY, ox.imageW, ox.imageH);
        ctx.clip();
        ctx.drawImage(cur.image, ox.imageX, ox.imageY, ox.imageW, ox.imageH);
        ctx.restore();

        // EXIF overlay
        if (this.hasExifData()) {
            this.drawExifOverlay(ctx, totalW, totalH, ox);
        }

        const blob = await new Promise((resolve, reject) => {
            offscreen.toBlob(b => {
                offscreen.width = 0;
                offscreen.height = 0;
                b ? resolve(b) : reject(new Error('Canvas toBlob failed'));
            }, 'image/png');
        });

        const baseName = cur.fileName ? cur.fileName.replace(/\.[^.]+$/, '') : 'photo';
        const fileName = `${baseName}_exif.png`;
        await this.triggerDownload(blob, fileName);
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

            const blob = await this.renderItemToBlob(item, dims, photoArea);

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
        await this.triggerDownload(zipBlob, fileName);
        this.hideProgress();
    }

    /**
     * Try sharing multiple files at once via Web Share API (iOS Safari).
     * Returns true if successful, false if not supported or failed.
     */
    async tryBatchShare(filesArray) {
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
            if (e.name === 'AbortError') return true; // user cancelled, don't fallback
            console.error('Batch share failed:', e);
            return false;
        }
    }

    async triggerDownload(blob, fileName) {
        if (window.Capacitor?.isNativePlatform()) {
            const platform = window.Capacitor.getPlatform();

            // Android: save directly to gallery
            if (platform === 'android') {
                try {
                    const { Media } = await import('@capacitor-community/media');
                    const base64 = await this.blobToBase64(blob);
                    const dataUri = 'data:image/png;base64,' + base64;

                    const albumName = 'Photo Frame Maker';
                    const { albums } = await Media.getAlbums();
                    let album = albums.find(a => a.name === albumName);
                    if (!album) {
                        await Media.createAlbum({ name: albumName });
                        const result = await Media.getAlbums();
                        album = result.albums.find(a => a.name === albumName);
                    }

                    const saveOpts = {
                        path: dataUri,
                        fileName: fileName.replace(/\.[^.]+$/, '')
                    };
                    if (album) {
                        saveOpts.albumIdentifier = album.identifier;
                    }

                    await Media.savePhoto(saveOpts);
                    this.showToast(`갤러리에 저장 완료: ${fileName}`);
                    return;
                } catch (e) {
                    console.error('Media save failed:', e);
                }
            }

            // iOS: show share sheet so user can save to Photos, AirDrop, etc.
            if (platform === 'ios') {
                try {
                    const { Filesystem, Directory } = await import('@capacitor/filesystem');
                    const { Share } = await import('@capacitor/share');
                    const base64 = await this.blobToBase64(blob);

                    // Write to temp file for sharing
                    const tempPath = 'tmp_share_' + fileName;
                    const written = await Filesystem.writeFile({
                        path: tempPath,
                        data: base64,
                        directory: Directory.Cache
                    });

                    await Share.share({
                        title: fileName,
                        files: [written.uri]
                    });

                    // Clean up temp file
                    try {
                        await Filesystem.deleteFile({ path: tempPath, directory: Directory.Cache });
                    } catch (_) { /* ignore cleanup errors */ }
                    return;
                } catch (e) {
                    if (e.message?.includes('canceled') || e.message?.includes('cancelled')) return;
                    console.error('Share failed:', e);
                }
            }
        }

        // iOS Safari: use Web Share API so user can save to Photos
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

        // Web browser: standard <a download>
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async renderItemToBlob(item, dims, photoArea) {
        const offscreen = document.createElement('canvas');
        offscreen.width = dims.width;
        offscreen.height = dims.height;
        const ctx = offscreen.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        this.drawFrameBackground(ctx, item.image, dims.width, dims.height);

        const draw = this.getDrawDimensions(item.image);

        ctx.save();
        ctx.beginPath();
        ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
        ctx.clip();

        const x = photoArea.x + (photoArea.width - draw.width) / 2 + item.imageOffset.x;
        const y = photoArea.y + (photoArea.height - draw.height) / 2 + item.imageOffset.y;
        ctx.drawImage(item.image, x, y, draw.width, draw.height);
        ctx.restore();

        return await new Promise((resolve, reject) => {
            offscreen.toBlob(blob => {
                offscreen.width = 0;
                offscreen.height = 0;
                blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'));
            }, 'image/png');
        });
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
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
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
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.remove();
                    URL.revokeObjectURL(url);
                }
            }, 1000);
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
