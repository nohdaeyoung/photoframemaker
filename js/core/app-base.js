/**
 * app-base.js — 공통 AppBase 클래스
 *
 * 이미지 로드·캔버스 관리·드래그&드롭·설정 저장 등
 * 모든 모드가 공유하는 상태와 메서드를 담는다.
 *
 * 서브클래스는 다음 메서드를 override 해야 한다:
 *   bindModeElements()            모드 전용 DOM 요소 바인딩
 *   setupModeEventListeners()     모드 전용 이벤트 바인딩
 *   renderMode()                  모드별 캔버스 렌더링
 */

import { roundRect, rgbToHsl, hslToRgb, extractDominantColor } from '../utils/canvas.js';
import {
    escapeHtml,
    readExifFromBuffer, parseTiff, readIFD,
    detectBrand,
    getExifFontPx, resolveExifTextColor, resolveExifBarColor,
} from '../utils/exif-utils.js';
import { download } from '../utils/download.js';

export class AppBase {
    constructor() {
        // --- 이미지 배열 (최대 10장) ---
        this.images = [];
        this.currentIndex = 0;

        // --- 공통 캔버스/프레임 설정 ---
        this.canvasRatio     = [1, 1];
        this.canvasSize      = 1000;
        this.frameRatio      = 5;
        this.frameColor      = '#FFFFFF';
        this.blurIntensity   = 50;
        this.pixelateIntensity = 50;

        // --- UI 상태 ---
        this.isDragging      = false;
        this.isDownloading   = false;
        this.dragStart       = { x: 0, y: 0 };
        this.dragStartOffset = { x: 0, y: 0 };
        this.previewMode     = 'default';
        this.activeTab       = 'frame';

        // 스와이프 추적
        this.touchStartX = 0; this.touchStartY = 0;
        this.touchStartTime = 0; this.touchMoved = false;
        this.feedTouchStartX = 0; this.feedTouchStartY = 0;
        this.feedTouchStartTime = 0;

        // --- 분할 모드 ---
        this.splitCount        = 2;
        this.splitDirection    = 'horizontal';
        this.splitCurrentPanel = 0;

        // --- 변환 모드 ---
        this.outputFormat  = 'jpeg';
        this.outputQuality = 92;

        // --- EXIF 모드 ---
        this.exifStyle     = 'filmstrip';
        this.exifFields    = { camera: false, lens: false, focalLength: true, aperture: true, shutter: true, iso: true, date: false };
        this.exifFontSize  = 'medium';
        this.exifTextColor = 'white';
        this.exifSeparator = '│';
        this.exifBarColor  = 'black';

        // --- EXIF 스타일별 전용 옵션 ---
        this.filmBrand     = 'auto';        // 'auto'|'kodak'|'fujifilm'|'ilford'|'cinestill'|'agfa'
        this.glassPosition = 'bottom-left'; // 'bottom-left'|'bottom-right'|'top-left'|'top-right'
        this.glassTheme    = 'light';       // 'light'|'dark'
        this.hudAccent     = 'default';     // 'default'|'green'|'red'|'amber'|'cyan'
        this.cardVariant   = 6;             // 2|3|4|6
        this.polaroidFont  = 'clean';       // 'clean'|'handwriting'

        // --- 앱 모드 (각 페이지별 독립 인스턴스 — 서브클래스에서 설정) ---
        this.appMode = 'frame';   // 'frame' | 'split' | 'convert' | 'exif'

        // --- 캔버스 DOM ---
        this.canvas = document.getElementById('preview-canvas');
        this.ctx    = this.canvas.getContext('2d');
        this.previewContainer = document.getElementById('preview-container');

        this.init();
    }

    // =========================================================
    // 편의 getter
    // =========================================================

    get currentImage()     { return this.images[this.currentIndex] || null; }
    get imageCount()       { return this.images.length; }
    get loadedImages()     { return this.images.filter(i => i !== null); }
    get hasImage()         { return this.loadedImages.length > 0; }
    get hasMultipleImages(){ return this.loadedImages.length > 1; }
    get isStyleFrame()     { return ['blur', 'gradient', 'pixelate', 'mirror'].includes(this.frameColor); }

    // =========================================================
    // 초기화
    // =========================================================

    init() {
        this.bindElements();
        this.bindModeElements();
        this.setupEventListeners();
        this.setupModeEventListeners();
        if (this.checkWebPSupport) this.checkWebPSupport();
        this.loadLastSettings();
        if (this.syncExifUI) this.syncExifUI();
        this.syncFramePxInputs();
        this.updateCanvasSize();
        this.render();
        this.updateInfo();
        this.renderFavoritesUI();

        this.previewToolbar.style.display = 'none';
        this.thumbnailStrip.style.display = 'none';
        this.downloadBtn.disabled = true;
        if (this.mobileDownloadBtn) this.mobileDownloadBtn.disabled = true;
        this.previewContainer.classList.remove('has-image');
        document.body.classList.add('ready');

        // sessionStorage에서 이전 페이지의 이미지 복원
        this.restoreImagesFromSession();
    }

    /** 공통 DOM 요소 바인딩. 서브클래스는 bindModeElements()로 추가. */
    bindElements() {
        const $ = id => document.getElementById(id);
        const $q = sel => document.querySelector(sel);

        this.uploadZone         = $('upload-zone');
        this.fileInput          = $('file-input');
        this.uploadContent      = $('upload-content');
        this.ratioButtons       = $('ratio-buttons');
        this.ratioSection       = $('ratio-section');
        this.mobileRatioButtons = $('mobile-ratio-buttons');
        this.mobileRatioHeader  = $('mobile-ratio-header');
        this.canvasSizeInput    = $('canvas-size');
        this.frameRatioSlider   = $('frame-ratio-slider');
        this.frameRatioInput    = $('frame-ratio');
        this.frameRatioPxInput  = $('frame-ratio-px');
        this.colorPresets       = $('color-presets');
        this.customColorInput   = $('custom-color');
        this.blurControls       = $('blur-controls');
        this.blurSlider         = $('blur-slider');
        this.blurValueLabel     = $('blur-value');
        this.pixelateControls   = $('pixelate-controls');
        this.pixelateSlider     = $('pixelate-slider');
        this.pixelateValueLabel = $('pixelate-value');
        this.downloadBtn        = $('download-btn');
        this.previewHint        = $('preview-hint');

        this.infoCanvas            = $('info-canvas');
        this.infoFrame             = $('info-frame');
        this.infoPhoto             = $('info-photo');
        this.infoOriginal          = $('info-original');
        this.infoOriginalLabel     = $('info-original-label');
        this.upscaleWarning        = $('upscale-warning');
        this.exifSection           = $('exif-section');
        this.exifGrid              = $('exif-grid');

        this.previewToolbar        = $('preview-toolbar');
        this.previewRemoveBtn      = $('preview-remove-btn');
        this.previewModeToggle     = $('preview-mode-toggle');
        this.feedMockup            = $('feed-mockup');
        this.feedImage             = $('feed-image');
        this.feedNavPrevBtn        = $('feed-nav-prev');
        this.feedNavNextBtn        = $('feed-nav-next');
        this.feedDots              = $('feed-dots');
        this.profileMockup         = $('profile-mockup');
        this.profileGrid           = $('profile-grid');
        this.profileGridImage      = $('profile-grid-image');

        this.sidebar               = $('sidebar');
        this.sheetHandle           = $('sheet-handle');
        this.sheetBackdrop         = $('sheet-backdrop');

        this.navPrevBtn            = $('canvas-nav-prev');
        this.navNextBtn            = $('canvas-nav-next');

        this.thumbnailStrip        = $('thumbnail-strip');
        this.thumbnailList         = $('thumbnail-list');
        this.thumbnailAddBtn       = $('thumbnail-add-btn');
        this.thumbnailCounter      = $('thumbnail-counter');
        this.thumbnailStripParent  = this.thumbnailStrip.parentElement;
        this.mobileThumbnailSlot   = $('mobile-thumbnail-slot');

        this.mobileTabBar          = $('mobile-tab-bar');
        this.mobileTabPanels       = $('mobile-tab-panels');
        this.mobileDownloadBtn     = $('mobile-download-btn');
        this.mobileCanvasSizeInput = $('mobile-canvas-size');
        this.mobileFrameRatioSlider = $('mobile-frame-ratio-slider');
        this.mobileFrameRatioInput = $('mobile-frame-ratio');
        this.mobileFrameRatioPxInput = $('mobile-frame-ratio-px');
        this.mobileColorPresets    = $('mobile-color-presets');
        this.mobileCustomColorInput= $('mobile-custom-color');
        this.mobileBlurControls    = $('mobile-blur-controls');
        this.mobileBlurSlider      = $('mobile-blur-slider');
        this.mobileBlurValueLabel  = $('mobile-blur-value');
        this.mobilePixelateControls= $('mobile-pixelate-controls');
        this.mobilePixelateSlider  = $('mobile-pixelate-slider');
        this.mobilePixelateValueLabel = $('mobile-pixelate-value');
        this.mobileInfoCanvas      = $('mobile-info-canvas');
        this.mobileInfoFrame       = $('mobile-info-frame');
        this.mobileInfoPhoto       = $('mobile-info-photo');
        this.mobileInfoOriginal    = $('mobile-info-original');
        this.mobileInfoOriginalLabel = $('mobile-info-original-label');
        this.mobileUpscaleWarning  = $('mobile-upscale-warning');
        this.mobileExifSection     = $('mobile-exif-section');
        this.mobileExifGrid        = $('mobile-exif-grid');
        this.mobilePhotoInfo       = $('mobile-photo-info');
        this.mobilePhotoThumb      = $('mobile-photo-thumb');
        this.mobilePhotoName       = $('mobile-photo-name');
        this.mobilePhotoSize       = $('mobile-photo-size');
        this.mobilePhotoUploadBtn  = $('mobile-photo-upload-btn');
        this.mobilePhotoUploadLabel= $('mobile-photo-upload-label');
        this.mobilePhotoDeleteBtn  = $('mobile-photo-delete-btn');

        this.appModeToggle         = $('app-mode-toggle');
        this.splitSection          = $('split-section');
        this.splitButtons          = $('split-buttons');
        this.mobileSplitSection    = $('mobile-split-section');
        this.mobileSplitButtons    = $('mobile-split-buttons');
        this.splitDirectionButtons = $('split-direction-buttons');
        this.mobileSplitDirectionButtons = $('mobile-split-direction-buttons');
        this.frameRatioSection     = $('frame-ratio-section');
        this.frameColorSection     = $('frame-color-section');
        this.mobileTabBtnFrame     = $q('.tab-btn[data-tab="frame"]');
        this.mobileTabBtnColor     = $q('.tab-btn[data-tab="color"]');
        this.tabPanelFrame         = $('tab-panel-frame');
        this.tabPanelColor         = $('tab-panel-color');

        this.favoritesList         = $('favorites-list');
        this.favoritesEmpty        = $('favorites-empty');
        this.favoriteSaveBtn       = $('favorite-save-btn');
        this.mobileFavoritesList   = $('mobile-favorites-list');
        this.mobileFavoriteSaveBtn = $('mobile-favorite-save-btn');
        this.favoritesSection      = $('favorites-section');

        this.convertSection        = $('convert-section');
        this.formatButtons         = $('format-buttons');
        this.qualitySlider         = $('quality-slider');
        this.qualityValue          = $('quality-value');
        this.qualityControl        = $('quality-control');
        this.mobileFormatButtons   = $('mobile-format-buttons');
        this.mobileQualitySlider   = $('mobile-quality-slider');
        this.mobileQualityValue    = $('mobile-quality-value');
        this.mobileQualityControl  = $('mobile-quality-control');
        this.mobileTabBtnConvert   = $('mobile-tab-btn-convert');
        this.tabPanelConvert       = $('tab-panel-convert');

        this.exifPanel             = $('exif-style-section');
        this.exifStyleSection      = this.exifPanel;
        this.exifStyleButtons      = $('exif-style-buttons');
        this.exifFieldToggles      = $('exif-field-toggles');
        this.exifFontSizeButtons   = $('exif-font-size-buttons');
        this.exifTextColorButtons  = $('exif-text-color-buttons');
        this.exifBarColorButtons   = $('exif-bar-color-buttons');
        this.exifSeparatorButtons  = $('exif-separator-buttons');
        this.mobileExifStyleButtons= $('mobile-exif-style-buttons');
        this.mobileExifFieldToggles= $('mobile-exif-field-toggles');
        this.mobileExifFontSizeButtons  = $('mobile-exif-font-size-buttons');
        this.mobileExifTextColorButtons = $('mobile-exif-text-color-buttons');
        this.mobileExifBarColorButtons  = $('mobile-exif-bar-color-buttons');
        this.mobileExifSeparatorButtons = $('mobile-exif-separator-buttons');
        this.mobileTabBtnExif      = $('mobile-tab-btn-exif');
        this.tabPanelExif          = $('tab-panel-exif');

        // EXIF 스타일별 전용 옵션 요소
        this.exifOptsFilm               = $('exif-opts-film');
        this.exifOptsFont               = $('exif-opts-font');
        this.exifOptsGlass              = $('exif-opts-glass');
        this.exifOptsHud                = $('exif-opts-hud');
        this.exifOptsCardgrid           = $('exif-opts-cardgrid');
        this.exifFilmBrandButtons       = $('exif-film-brand-buttons');
        this.exifPolaroidFontButtons    = $('exif-polaroid-font-buttons');
        this.exifGlassPositionButtons   = $('exif-glass-position-buttons');
        this.exifGlassThemeButtons      = $('exif-glass-theme-buttons');
        this.exifHudAccentButtons       = $('exif-hud-accent-buttons');
        this.exifCardVariantButtons     = $('exif-card-variant-buttons');
        this.mobileExifOptsFilm         = $('mobile-exif-opts-film');
        this.mobileExifOptsFont         = $('mobile-exif-opts-font');
        this.mobileExifOptsGlass        = $('mobile-exif-opts-glass');
        this.mobileExifOptsHud          = $('mobile-exif-opts-hud');
        this.mobileExifOptsCardgrid     = $('mobile-exif-opts-cardgrid');
        this.mobileExifFilmBrandButtons     = $('mobile-exif-film-brand-buttons');
        this.mobileExifPolaroidFontButtons  = $('mobile-exif-polaroid-font-buttons');
        this.mobileExifGlassPositionButtons = $('mobile-exif-glass-position-buttons');
        this.mobileExifGlassThemeButtons    = $('mobile-exif-glass-theme-buttons');
        this.mobileExifHudAccentButtons     = $('mobile-exif-hud-accent-buttons');
        this.mobileExifCardVariantButtons   = $('mobile-exif-card-variant-buttons');
    }

    /** 서브클래스에서 override: 모드 전용 DOM 요소 바인딩 */
    bindModeElements() {}

    // =========================================================
    // 공통 이벤트 바인딩
    // =========================================================

    setupEventListeners() {
        this.previewRemoveBtn.addEventListener('click', e => { e.stopPropagation(); this.removeImage(); });

        this.uploadZone.addEventListener('click', e => {
            if (e.target.closest('.upload-remove-btn')) return;
            this.fileInput.click();
        });
        this.fileInput.addEventListener('change', e => {
            if (e.target.files.length > 0) this.loadImages(e.target.files);
        });
        this.uploadZone.addEventListener('dragover', e => { e.preventDefault(); this.uploadZone.classList.add('drag-over'); });
        this.uploadZone.addEventListener('dragleave', () => this.uploadZone.classList.remove('drag-over'));
        this.uploadZone.addEventListener('drop', e => {
            e.preventDefault(); this.uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) this.loadImages(e.dataTransfer.files);
        });

        document.addEventListener('paste', e => {
            for (const item of e.clipboardData.items) {
                if (item.type.startsWith('image/')) { e.preventDefault(); this.loadImages([item.getAsFile()]); break; }
            }
        });

        if (this.ratioButtons) this.ratioButtons.addEventListener('click', e => {
            const btn = e.target.closest('.ratio-btn');
            if (!btn) return;
            const ratio = btn.dataset.ratio;
            [this.ratioButtons, this.mobileRatioButtons].forEach(c =>
                c?.querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratio))
            );
            const [w, h] = ratio.split(':').map(Number);
            this.canvasRatio = [w, h];
            this.syncFramePxInputs(); this.resetAllOffsets(); this.updateCanvasSize(); this.render(); this.updateInfo();
        });

        if (this.canvasSizeInput) this.canvasSizeInput.addEventListener('input', () => {
            const val = parseInt(this.canvasSizeInput.value);
            if (val >= 100 && val <= 10000) {
                this.canvasSize = val;
                if (this.mobileCanvasSizeInput) this.mobileCanvasSizeInput.value = val;
                this.syncFramePxInputs(); this.resetAllOffsets(); this.updateCanvasSize(); this.render(); this.updateInfo();
            }
        });

        this.frameRatioSlider.addEventListener('input', () => {
            this.frameRatio = parseFloat(this.frameRatioSlider.value);
            if (this.frameRatioInput) this.frameRatioInput.value = this.frameRatio;
            if (this.mobileFrameRatioSlider) this.mobileFrameRatioSlider.value = this.frameRatio;
            if (this.mobileFrameRatioInput) this.mobileFrameRatioInput.value = this.frameRatio;
            this.syncFramePxInputs(); this.resetAllOffsets(); this.render(); this.updateInfo();
        });

        this.frameRatioInput.addEventListener('input', () => {
            let val = parseFloat(this.frameRatioInput.value);
            if (isNaN(val)) return;
            val = Math.max(0, Math.min(25, val));
            this.frameRatio = val;
            this.frameRatioSlider.value = val;
            if (this.mobileFrameRatioSlider) this.mobileFrameRatioSlider.value = val;
            if (this.mobileFrameRatioInput) this.mobileFrameRatioInput.value = val;
            this.syncFramePxInputs(); this.resetAllOffsets(); this.render(); this.updateInfo();
        });

        this.frameRatioPxInput.addEventListener('input', () => {
            let px = parseInt(this.frameRatioPxInput.value, 10);
            if (isNaN(px)) return;
            const maxPx = Math.round(this.canvasSize * 25 / 100);
            px = Math.max(0, Math.min(maxPx, px));
            const pct = this.canvasSize > 0 ? (px / this.canvasSize) * 100 : 0;
            const rounded = Math.round(pct * 2) / 2;
            this.frameRatio = rounded;
            if (this.frameRatioSlider) this.frameRatioSlider.value = rounded;
            if (this.frameRatioInput) this.frameRatioInput.value = rounded;
            if (this.mobileFrameRatioSlider) this.mobileFrameRatioSlider.value = rounded;
            if (this.mobileFrameRatioInput) this.mobileFrameRatioInput.value = rounded;
            if (this.mobileFrameRatioPxInput) this.mobileFrameRatioPxInput.value = px;
            this.resetAllOffsets(); this.render(); this.updateInfo();
        });
        this.frameRatioPxInput.addEventListener('change', () => this.syncFramePxInputs());

        this.colorPresets.addEventListener('click', e => {
            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;
            const color = swatch.dataset.color;
            [this.colorPresets, this.mobileColorPresets].forEach(c =>
                c.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color))
            );
            this.frameColor = color;
            if (!this.isStyleFrame) {
                if (this.customColorInput) this.customColorInput.value = color;
                if (this.mobileCustomColorInput) this.mobileCustomColorInput.value = color;
            }
            this.updateStyleControlsVisibility(); this.render();
        });

        this.customColorInput.addEventListener('input', () => {
            this.frameColor = this.customColorInput.value;
            if (this.mobileCustomColorInput) this.mobileCustomColorInput.value = this.frameColor;
            [this.colorPresets, this.mobileColorPresets].forEach(c =>
                c.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'))
            );
            this.updateStyleControlsVisibility(); this.render();
        });

        this.blurSlider.addEventListener('input', () => {
            this.blurIntensity = parseInt(this.blurSlider.value);
            if (this.mobileBlurSlider) { this.mobileBlurSlider.value = this.blurIntensity; this.mobileBlurValueLabel.textContent = this.blurIntensity; }
            this.blurValueLabel.textContent = this.blurIntensity;
            this.render();
        });

        this.pixelateSlider.addEventListener('input', () => {
            this.pixelateIntensity = parseInt(this.pixelateSlider.value);
            if (this.mobilePixelateSlider) { this.mobilePixelateSlider.value = this.pixelateIntensity; this.mobilePixelateValueLabel.textContent = this.pixelateIntensity; }
            this.pixelateValueLabel.textContent = this.pixelateIntensity;
            this.render();
        });

        if (this.favoriteSaveBtn) this.favoriteSaveBtn.addEventListener('click', () => this.saveFavorite());
        if (this.mobileFavoriteSaveBtn) this.mobileFavoriteSaveBtn.addEventListener('click', () => this.saveFavorite());

        const handleFavClick = e => {
            const removeBtn = e.target.closest('.favorite-remove');
            if (removeBtn) { this.removeFavorite(parseInt(removeBtn.dataset.index)); return; }
            const item = e.target.closest('.favorite-item');
            if (item) this.applyPreset(this.getFavorites()[parseInt(item.dataset.index)]);
        };
        if (this.favoritesList) this.favoritesList.addEventListener('click', handleFavClick);
        if (this.mobileFavoritesList) this.mobileFavoritesList.addEventListener('click', handleFavClick);

        // Canvas drag
        this.canvas.addEventListener('mousedown', e => this.onDragStart(e));
        this.canvas.addEventListener('mousemove', e => this.onDragMove(e));
        document.addEventListener('mouseup', () => this.onDragEnd());

        this.canvas.addEventListener('touchstart', e => {
            if (e.touches.length === 1 && this.hasImage) {
                e.preventDefault();
                this.touchStartX = e.touches[0].clientX; this.touchStartY = e.touches[0].clientY;
                this.touchStartTime = Date.now(); this.touchMoved = false;
                this.onDragStart(e.touches[0]);
            }
        }, { passive: false });
        this.canvas.addEventListener('touchmove', e => {
            if (e.touches.length === 1 && this.hasImage) { e.preventDefault(); this.touchMoved = true; this.onDragMove(e.touches[0]); }
        }, { passive: false });
        document.addEventListener('touchend', e => {
            if (this.isDragging && (this.hasMultipleImages || (this.appMode === 'split' && this.splitCount > 1))) {
                const touch = e.changedTouches && e.changedTouches[0];
                if (touch) {
                    const dx = touch.clientX - this.touchStartX;
                    const dy = touch.clientY - this.touchStartY;
                    const dt = Date.now() - this.touchStartTime;
                    if (dt < 300 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                        if (this.currentImage) { this.currentImage.imageOffset.x = this.dragStartOffset.x; this.currentImage.imageOffset.y = this.dragStartOffset.y; }
                        dx > 0 ? this.navigatePrev() : this.navigateNext();
                        this.isDragging = false; return;
                    }
                }
            }
            this.onDragEnd();
        });

        this.previewContainer.addEventListener('click', e => { if (!this.hasImage) { this.fileInput.style.top = e.clientY + 'px'; this.fileInput.style.left = e.clientX + 'px'; this.fileInput.click(); } });
        this.previewContainer.addEventListener('dragover', e => { e.preventDefault(); this.previewContainer.classList.add('drag-over'); });
        this.previewContainer.addEventListener('dragleave', () => this.previewContainer.classList.remove('drag-over'));
        this.previewContainer.addEventListener('drop', e => {
            e.preventDefault(); this.previewContainer.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) this.loadImages(e.dataTransfer.files);
        });

        if (this.previewModeToggle) {
            this.previewModeToggle.addEventListener('click', e => {
                const btn = e.target.closest('.preview-mode-btn');
                if (!btn || btn.dataset.mode === this.previewMode) return;
                this.previewMode = btn.dataset.mode;
                this.previewModeToggle.querySelectorAll('.preview-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === this.previewMode));
                this.updatePreviewMode();
            });
        }

        this.downloadBtn.addEventListener('click', () => download(this));
        if (this.mobileDownloadBtn) this.mobileDownloadBtn.addEventListener('click', () => download(this));

        this.navPrevBtn.addEventListener('click', e => { e.stopPropagation(); this.navigatePrev(); });
        this.navNextBtn.addEventListener('click', e => { e.stopPropagation(); this.navigateNext(); });
        if (this.feedNavPrevBtn) this.feedNavPrevBtn.addEventListener('click', e => { e.stopPropagation(); this.navigatePrev(); });
        if (this.feedNavNextBtn) this.feedNavNextBtn.addEventListener('click', e => { e.stopPropagation(); this.navigateNext(); });
        if (this.feedMockup) this.feedMockup.addEventListener('click', e => { if (!e.target.closest('.feed-nav-arrow')) this.fileInput.click(); });

        if (this.profileGrid) {
            this.profileGrid.addEventListener('click', e => {
                const cell = e.target.closest('.profile-grid-item');
                if (!cell) return;
                if (cell.classList.contains('placeholder')) { this.fileInput.click(); }
                else if (cell.classList.contains('target')) {
                    const idx = parseInt(cell.dataset.index);
                    if (!isNaN(idx) && idx !== this.currentIndex) this.selectImage(idx);
                }
            });
        }

        if (this.feedImage) {
            this.feedImage.addEventListener('touchstart', e => {
                if (e.touches.length === 1 && this.hasMultipleImages) {
                    this.feedTouchStartX = e.touches[0].clientX; this.feedTouchStartY = e.touches[0].clientY; this.feedTouchStartTime = Date.now();
                }
            }, { passive: true });
            this.feedImage.addEventListener('touchend', e => {
                if (!this.hasMultipleImages) return;
                const touch = e.changedTouches && e.changedTouches[0]; if (!touch) return;
                const dx = touch.clientX - this.feedTouchStartX; const dy = touch.clientY - this.feedTouchStartY;
                const dt = Date.now() - this.feedTouchStartTime;
                if (dt < 300 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { e.preventDefault(); dx > 0 ? this.navigatePrev() : this.navigateNext(); }
            });
        }

        this.thumbnailList.addEventListener('click', e => {
            const removeBtn = e.target.closest('.thumbnail-remove');
            if (removeBtn) { e.stopPropagation(); this.removeImageAt(parseInt(removeBtn.dataset.index)); return; }
            const item = e.target.closest('.thumbnail-item');
            if (item) {
                const idx = parseInt(item.dataset.index);
                if (this.appMode === 'split') {
                    if (idx !== this.splitCurrentPanel) { this.splitCurrentPanel = idx; this.render(); this.updateNavArrows(); if (this.updateSplitThumbnailHighlight) this.updateSplitThumbnailHighlight(); }
                } else { this.selectImage(idx); }
            }
        });
        this.thumbnailAddBtn.addEventListener('click', () => this.fileInput.click());

        window.addEventListener('resize', () => this.updatePreviewContainerSize());

        // App mode toggle — transition 없이 초기 위치 설정 (첫 번째 버튼에서 애니메이션 방지)
        this.modeSlider = document.createElement('div');
        this.modeSlider.className = 'slider';
        this.modeSlider.style.transition = 'none';
        this.appModeToggle.appendChild(this.modeSlider);
        requestAnimationFrame(() => {
            this.updateModeSlider();
            requestAnimationFrame(() => { this.modeSlider.style.transition = ''; });
        });
        this.appModeToggle.addEventListener('click', e => {
            const btn = e.target.closest('.app-mode-btn');
            if (!btn) return;
            // <a> 태그인 경우: 페이지 이동 전 이미지 저장 후 이동
            if (btn.tagName === 'A' && btn.href) {
                this.saveImagesToSession();
                return; // 기본 링크 동작(페이지 이동)은 그대로 진행
            }
            // <button> 태그인 경우: 동일 페이지 내 모드 전환 (index.html 등)
            this.switchAppMode(btn.dataset.mode);
        });

        if (this.splitDirectionButtons) {
            this.splitDirectionButtons.addEventListener('click', e => {
                const btn = e.target.closest('.split-btn');
                if (btn) this.setSplitDirection(btn.dataset.direction);
            });
        }
        if (this.splitButtons) {
            this.splitButtons.addEventListener('click', e => {
                const btn = e.target.closest('.split-btn');
                if (btn) this.setSplitCount(parseInt(btn.dataset.split));
            });
        }

        const handleFormatClick = e => {
            const btn = e.target.closest('.format-btn');
            if (!btn || btn.disabled) return;
            this.outputFormat = btn.dataset.format;
            if (this.syncFormatUI) this.syncFormatUI();
            if (this.updateQualityControlState) this.updateQualityControlState();
            this.updateDownloadButton();
        };
        if (this.formatButtons) this.formatButtons.addEventListener('click', handleFormatClick);
        if (this.mobileFormatButtons) this.mobileFormatButtons.addEventListener('click', handleFormatClick);

        if (this.qualitySlider) {
            this.qualitySlider.addEventListener('input', () => {
                this.outputQuality = parseInt(this.qualitySlider.value);
                if (this.mobileQualitySlider) this.mobileQualitySlider.value = this.outputQuality;
                if (this.qualityValue) this.qualityValue.textContent = this.outputQuality + '%';
                if (this.mobileQualityValue) this.mobileQualityValue.textContent = this.outputQuality + '%';
                this.updateDownloadButton();
            });
        }
        if (this.mobileQualitySlider) {
            this.mobileQualitySlider.addEventListener('input', () => {
                this.outputQuality = parseInt(this.mobileQualitySlider.value);
                if (this.qualitySlider) this.qualitySlider.value = this.outputQuality;
                if (this.qualityValue) this.qualityValue.textContent = this.outputQuality + '%';
                if (this.mobileQualityValue) this.mobileQualityValue.textContent = this.outputQuality + '%';
                this.updateDownloadButton();
            });
        }
    }

    /** 서브클래스에서 override: 모드 전용 이벤트 바인딩 */
    setupModeEventListeners() {}

    // =========================================================
    // 계산 유틸
    // =========================================================

    getCanvasDimensions() {
        const [w, h] = this.canvasRatio;
        return { width: this.canvasSize, height: Math.round(this.canvasSize * h / w) };
    }

    getFrameWidth() {
        if (this.appMode === 'split') return 0;
        return Math.round(this.canvasSize * this.frameRatio / 100);
    }

    syncFramePxInputs() {
        const px = this.getFrameWidth();
        if (this.frameRatioPxInput) this.frameRatioPxInput.value = px;
        if (this.mobileFrameRatioPxInput) this.mobileFrameRatioPxInput.value = px;
    }

    getPhotoArea() {
        const dims = (this.appMode === 'split' && this.canvas.width > 0)
            ? { width: this.canvas.width, height: this.canvas.height }
            : this.getCanvasDimensions();
        const fw = this.getFrameWidth();
        return { x: fw, y: fw, width: Math.max(0, dims.width - 2 * fw), height: Math.max(0, dims.height - 2 * fw) };
    }

    getDrawDimensions(img) {
        const image = img || (this.currentImage && this.currentImage.image);
        if (!image) return { width: 0, height: 0 };
        const photoArea = this.getPhotoArea();
        if (photoArea.width === 0 || photoArea.height === 0) return { width: 0, height: 0 };
        const imgRatio = image.naturalWidth / image.naturalHeight;
        const areaRatio = photoArea.width / photoArea.height;
        let drawWidth, drawHeight;
        if (imgRatio > areaRatio) { drawWidth = photoArea.width; drawHeight = drawWidth / imgRatio; }
        else { drawHeight = photoArea.height; drawWidth = drawHeight * imgRatio; }
        return { width: drawWidth, height: drawHeight };
    }

    // =========================================================
    // 모드 전환
    // =========================================================

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
        this.appMode = mode;

        const isSplit = mode === 'split', isConvert = mode === 'convert', isExif = mode === 'exif';
        this.appModeToggle.querySelectorAll('.app-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        this.updateModeSlider();

        if (this.splitSection) this.splitSection.style.display = isSplit ? '' : 'none';
        if (this.mobileSplitSection) this.mobileSplitSection.style.display = isSplit ? '' : 'none';
        if (this.convertSection) this.convertSection.style.display = isConvert ? '' : 'none';
        if (this.mobileTabBtnConvert) { this.mobileTabBtnConvert.style.display = isConvert ? '' : 'none'; if (!isConvert && this.tabPanelConvert) this.tabPanelConvert.classList.remove('active'); }
        if (this.exifPanel) this.exifPanel.style.display = isExif ? '' : 'none';
        if (this.mobileTabBtnExif) { this.mobileTabBtnExif.style.display = isExif ? '' : 'none'; if (!isExif && this.tabPanelExif) this.tabPanelExif.classList.remove('active'); }

        if (isSplit) {
            this.savedRatioBeforeSplit = [...this.canvasRatio];
            this.canvasRatio = (this.splitDirection || 'horizontal') === 'horizontal' ? [3, 4] : [4, 3];
            if (this.ratioSection) this.ratioSection.style.display = 'none';
            if (this.mobileRatioHeader) this.mobileRatioHeader.style.display = 'none';
            if (this.mobileRatioButtons) this.mobileRatioButtons.style.display = 'none';
        } else if (isConvert || isExif) {
            if (this.savedRatioBeforeSplit) { this.canvasRatio = this.savedRatioBeforeSplit; this.savedRatioBeforeSplit = null; }
            if (this.ratioSection) this.ratioSection.style.display = 'none';
            if (this.mobileRatioHeader) this.mobileRatioHeader.style.display = 'none';
            if (this.mobileRatioButtons) this.mobileRatioButtons.style.display = 'none';
        } else {
            if (this.savedRatioBeforeSplit) { this.canvasRatio = this.savedRatioBeforeSplit; this.savedRatioBeforeSplit = null; }
            if (this.ratioSection) this.ratioSection.style.display = '';
            if (this.mobileRatioHeader) this.mobileRatioHeader.style.display = '';
            if (this.mobileRatioButtons) this.mobileRatioButtons.style.display = '';
            const ratioStr = this.canvasRatio.join(':');
            if (this.ratioButtons) this.ratioButtons.querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratioStr));
            if (this.mobileRatioButtons) this.mobileRatioButtons.querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratioStr));
        }

        this.resetAllOffsets();
        this.updateCanvasSize();

        const hideFrame = isSplit || isConvert;
        if (this.frameRatioSection) this.frameRatioSection.style.display = hideFrame ? 'none' : '';
        if (this.frameColorSection) this.frameColorSection.style.display = hideFrame ? 'none' : '';
        if (this.mobileTabBtnFrame) this.mobileTabBtnFrame.style.display = hideFrame ? 'none' : '';
        if (this.mobileTabBtnColor) this.mobileTabBtnColor.style.display = hideFrame ? 'none' : '';
        if (this.favoritesSection) this.favoritesSection.style.display = (isConvert || isExif) ? 'none' : '';
        if (hideFrame) { if (this.tabPanelFrame) this.tabPanelFrame.classList.remove('active'); if (this.tabPanelColor) this.tabPanelColor.classList.remove('active'); }

        const hidePreview = isSplit || isConvert || isExif;
        if (this.previewModeToggle) this.previewModeToggle.style.display = hidePreview ? 'none' : '';
        if (hidePreview && this.previewMode !== 'default') {
            this.previewMode = 'default';
            if (this.previewModeToggle) this.previewModeToggle.querySelectorAll('.preview-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'default'));
            if (this.updatePreviewMode) this.updatePreviewMode();
        }

        this.splitCurrentPanel = 0;
        this.updateDownloadButton();
        if (isConvert && this.syncFormatUI) this.syncFormatUI();
        if (isExif && this.syncExifUI) this.syncExifUI();
        this.syncFramePxInputs();
        this.onImagesChanged();
    }

    // =========================================================
    // 캔버스 크기 업데이트
    // =========================================================

    updateCanvasSize() {
        const dims = this.getCanvasDimensions();
        this.canvas.width = dims.width; this.canvas.height = dims.height;
        this.canvas.style.aspectRatio = `${dims.width} / ${dims.height}`;
        this.updatePreviewContainerSize();
    }

    updatePreviewContainerSize() {
        let ratio;
        if ((this.appMode === 'convert' || this.appMode === 'exif' || this.appMode === 'split') && this.canvas.width > 0 && this.canvas.height > 0) {
            ratio = this.canvas.width / this.canvas.height;
        } else { const [w, h] = this.canvasRatio; ratio = w / h; }

        const parent = this.previewContainer.parentElement;
        const parentWidth = parent.clientWidth;
        if (parentWidth <= 0) return;

        const cs = getComputedStyle(this.previewContainer);
        const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const isMobile = window.innerWidth <= 900;

        if (isMobile) {
            if (this.previewContainer.style.display === 'none') return;
            const availW = parentWidth - padX;
            this.previewContainer.style.width = ''; this.previewContainer.style.height = ''; this.previewContainer.style.flex = '1';
            const cellRect = this.previewContainer.getBoundingClientRect();
            this.previewContainer.style.flex = '';
            const availH = cellRect.height - padY;
            if (availW <= 0 || availH <= 0) return;
            let cw, ch;
            if (availW / availH > ratio) { ch = availH; cw = ch * ratio; } else { cw = availW; ch = cw / ratio; }
            this.previewContainer.style.width = Math.round(cw + padX) + 'px';
            this.previewContainer.style.height = Math.round(ch + padY) + 'px';
            this.canvas.style.width = Math.round(cw) + 'px'; this.canvas.style.height = Math.round(ch) + 'px';
            this.previewContainer.style.marginLeft = 'auto'; this.previewContainer.style.marginRight = 'auto';
        } else {
            const previewArea = this.previewContainer.closest('.preview-area');
            previewArea.style.width = ''; previewArea.style.marginLeft = ''; previewArea.style.marginRight = '';
            const gridCellWidth = previewArea.parentElement.clientWidth ? previewArea.parentElement.clientWidth - 300 - 24 : parentWidth;
            const actualParentWidth = gridCellWidth > 0 ? gridCellWidth : parentWidth;
            const maxH = window.innerHeight * 0.75;
            const availW = actualParentWidth - padX; const availH = maxH - padY;
            if (availW <= 0 || availH <= 0) return;
            let cw, ch;
            if (availW / availH > ratio) { ch = availH; cw = ch * ratio; } else { cw = availW; ch = cw / ratio; }
            this.previewContainer.style.width = ''; this.previewContainer.style.marginLeft = ''; this.previewContainer.style.marginRight = '';
            this.canvas.style.width = Math.round(cw) + 'px'; this.canvas.style.height = Math.round(ch) + 'px';
            previewArea.style.width = Math.round(cw + padX) + 'px';
            previewArea.style.marginLeft = 'auto'; previewArea.style.marginRight = 'auto';
            this.previewContainer.style.height = Math.round(ch + padY) + 'px';
        }
    }

    // =========================================================
    // 렌더링 (서브클래스에서 renderMode() 또는 render()를 override)
    // =========================================================

    render(keepProfileCache) {
        if (!keepProfileCache) this.invalidateProfileCache();
        this.renderMode();
        if (this.updateMockupImages) this.updateMockupImages();
        clearTimeout(this._saveSettingsTimer);
        this._saveSettingsTimer = setTimeout(() => this.saveLastSettings(), 500);
    }

    /** 서브클래스에서 override: 모드별 캔버스 렌더 구현 */
    renderMode() {}

    drawImage() {
        const cur = this.currentImage;
        if (!cur) return;
        const photoArea = this.getPhotoArea();
        if (photoArea.width === 0 || photoArea.height === 0) return;
        const draw = this.getDrawDimensions(cur.image);
        if (draw.width === 0 || draw.height === 0) return;
        this.ctx.save();
        this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'high';
        this.ctx.beginPath(); this.ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height); this.ctx.clip();
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

    updateStyleControlsVisibility() {
        const isBlur = this.frameColor === 'blur'; const isPixelate = this.frameColor === 'pixelate';
        if (this.blurControls) this.blurControls.style.display = isBlur ? '' : 'none';
        if (this.mobileBlurControls) this.mobileBlurControls.style.display = isBlur ? '' : 'none';
        if (this.pixelateControls) this.pixelateControls.style.display = isPixelate ? '' : 'none';
        if (this.mobilePixelateControls) this.mobilePixelateControls.style.display = isPixelate ? '' : 'none';
    }

    drawFrameBackground(ctx, img, canvasW, canvasH) {
        const placeholderBg = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#E8E8E8';
        if (this.frameColor === 'auto') {
            if (img) {
                if (!this._autoDominantColor) this._autoDominantColor = extractDominantColor(img);
                ctx.fillStyle = this._autoDominantColor;
            } else { ctx.fillStyle = placeholderBg; }
            ctx.fillRect(0, 0, canvasW, canvasH);
        } else if (this.isStyleFrame && img) {
            ctx.fillStyle = '#222'; ctx.fillRect(0, 0, canvasW, canvasH);
            switch (this.frameColor) {
                case 'blur':     this.drawBlurBackground(ctx, img, canvasW, canvasH); break;
                case 'gradient': this.drawGradientBackground(ctx, img, canvasW, canvasH); break;
                case 'pixelate': this.drawPixelateBackground(ctx, img, canvasW, canvasH); break;
                case 'mirror':   this.drawMirrorBackground(ctx, img, canvasW, canvasH); break;
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
        const drawW = img.naturalWidth * coverScale; const drawH = img.naturalHeight * coverScale;
        const drawX = (canvasW - drawW) / 2; const drawY = (canvasH - drawH) / 2;
        if (!this._blurCanvas) this._blurCanvas = document.createElement('canvas');
        const bc = this._blurCanvas;
        bc.width = smallW; bc.height = smallH;
        const bctx = bc.getContext('2d');
        bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = 'medium';
        bctx.clearRect(0, 0, smallW, smallH);
        bctx.drawImage(img, drawX * scale, drawY * scale, drawW * scale, drawH * scale);
        const brightness = 0.95 - 0.12 * t;
        ctx.save();
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.globalAlpha = 0.98;
        ctx.filter = `saturate(1.1) brightness(${brightness.toFixed(2)})`;
        ctx.drawImage(bc, 0, 0, smallW, smallH, 0, 0, canvasW, canvasH);
        ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.restore();
    }

    drawGradientBackground(ctx, img, canvasW, canvasH) {
        if (!this._colorSampleCanvas) this._colorSampleCanvas = document.createElement('canvas');
        const sc = this._colorSampleCanvas; const sz = 32;
        sc.width = sz; sc.height = sz;
        const sctx = sc.getContext('2d', { willReadFrequently: true });
        sctx.drawImage(img, 0, 0, sz, sz);
        const data = sctx.getImageData(0, 0, sz, sz).data;
        let r1 = 0, g1 = 0, b1 = 0, c1 = 0, r2 = 0, g2 = 0, b2 = 0, c2 = 0;
        for (let y = 0; y < sz; y++) { for (let x = 0; x < sz; x++) {
            const i = (y * sz + x) * 4;
            if (x + y < sz) { r1 += data[i]; g1 += data[i+1]; b1 += data[i+2]; c1++; }
            else { r2 += data[i]; g2 += data[i+1]; b2 += data[i+2]; c2++; }
        }}
        const col1 = `rgb(${Math.round(r1/c1)},${Math.round(g1/c1)},${Math.round(b1/c1)})`;
        const col2 = `rgb(${Math.round(r2/c2)},${Math.round(g2/c2)},${Math.round(b2/c2)})`;
        const gradient = ctx.createLinearGradient(0, 0, canvasW, canvasH);
        gradient.addColorStop(0, col1); gradient.addColorStop(1, col2);
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvasW, canvasH);
    }

    drawPixelateBackground(ctx, img, canvasW, canvasH) {
        const t = this.pixelateIntensity / 100;
        const pixelSize = Math.max(4, Math.round(Math.max(canvasW, canvasH) * (0.01 + 0.09 * t)));
        const coverScale = 1.05 * Math.max(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
        const drawW = img.naturalWidth * coverScale; const drawH = img.naturalHeight * coverScale;
        const drawX = (canvasW - drawW) / 2; const drawY = (canvasH - drawH) / 2;
        if (!this._pixCanvas) this._pixCanvas = document.createElement('canvas');
        const pc = this._pixCanvas;
        pc.width = Math.max(1, Math.ceil(canvasW / pixelSize)); pc.height = Math.max(1, Math.ceil(canvasH / pixelSize));
        const pctx = pc.getContext('2d');
        pctx.imageSmoothingEnabled = false;
        pctx.drawImage(img, drawX / pixelSize, drawY / pixelSize, drawW / pixelSize, drawH / pixelSize);
        ctx.save(); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(pc, 0, 0, pc.width, pc.height, 0, 0, canvasW, canvasH);
        ctx.restore();
    }

    drawMirrorBackground(ctx, img, canvasW, canvasH) {
        const coverScale = 1.05 * Math.max(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
        const dw = img.naturalWidth * coverScale; const dh = img.naturalHeight * coverScale;
        const dx = (canvasW - dw) / 2; const dy = (canvasH - dh) / 2;
        ctx.save();
        ctx.translate(canvasW, 0); ctx.scale(-1, 1);
        ctx.drawImage(img, canvasW - dx - dw, dy, dw, dh);
        ctx.restore();
        ctx.drawImage(img, dx, dy, dw, dh);
    }

    invalidateProfileCache() {
        this._profileCache = null;
    }

    // =========================================================
    // 이미지 로드
    // =========================================================

    loadImages(files) {
        if (this.isDownloading) return;
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return;
        const available = 10 - this.images.length;
        if (available <= 0) { this.showToast('최대 10장까지 가능합니다.'); return; }
        if (imageFiles.length > available) this.showToast(`최대 10장까지 가능합니다. ${available}장만 추가됩니다.`);
        const filesToLoad = imageFiles.slice(0, available);
        const firstNewIndex = this.images.length;
        const slots = filesToLoad.map(() => { this.images.push(null); return this.images.length - 1; });
        this.currentIndex = firstNewIndex;
        let loadedCount = 0;
        filesToLoad.forEach((file, i) => {
            const slotIndex = slots[i];
            const imageUrl = URL.createObjectURL(file);
            const img = new Image();
            const onDone = () => {
                loadedCount++;
                if (loadedCount === filesToLoad.length) {
                    this.images = this.images.filter(item => item !== null);
                    if (this.currentIndex >= this.images.length) this.currentIndex = Math.max(0, this.images.length - 1);
                    this.onImagesChanged();
                }
            };
            img.onload = () => {
                const item = { image: img, imageUrl, fileName: file.name, fileSize: file.size, imageOffset: { x: 0, y: 0 }, exifData: null };
                this.images[slotIndex] = item;
                this.parseExifForItem(file, item);
                onDone();
            };
            img.onerror = () => { URL.revokeObjectURL(imageUrl); this.images[slotIndex] = null; onDone(); };
            img.src = imageUrl;
        });
    }

    async parseExifForItem(file, item) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            item.exifData = readExifFromBuffer(arrayBuffer);
            if (this.currentImage === item) {
                this.displayExif(item.exifData);
                if (this.appMode === 'exif') { if (this.syncExifUI) this.syncExifUI(); this.render(); }
            }
        } catch (e) { /* ignore */ }
    }

    // =========================================================
    // 페이지 간 이미지 전달 (sessionStorage)
    // =========================================================

    /** 현재 로드된 이미지를 sessionStorage['pfm_images']에 저장 */
    saveImagesToSession() {
        if (!this.hasImage) return;
        try {
            const offscreen = document.createElement('canvas');
            const serialized = this.images
                .filter(item => item && item.image)
                .map(item => {
                    offscreen.width  = item.image.naturalWidth;
                    offscreen.height = item.image.naturalHeight;
                    const ctx = offscreen.getContext('2d');
                    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
                    ctx.drawImage(item.image, 0, 0);
                    const dataUrl = offscreen.toDataURL('image/jpeg', 0.92);
                    return {
                        dataUrl,
                        fileName:    item.fileName,
                        fileSize:    item.fileSize,
                        imageOffset: item.imageOffset,
                        exifData:    item.exifData || null,
                    };
                });
            sessionStorage.setItem('pfm_images', JSON.stringify(serialized));
            sessionStorage.setItem('pfm_index',  String(this.currentIndex));
        } catch (e) { /* 저장 실패 시 무시 (용량 초과 등) */ }
    }

    /** sessionStorage['pfm_images']에서 이미지를 복원 */
    restoreImagesFromSession() {
        try {
            const raw = sessionStorage.getItem('pfm_images');
            if (!raw) return;
            // 복원 후에는 즉시 삭제 (다음 페이지에서 재복원 방지)
            sessionStorage.removeItem('pfm_images');
            const savedIndex = parseInt(sessionStorage.getItem('pfm_index') || '0', 10);
            sessionStorage.removeItem('pfm_index');

            const items = JSON.parse(raw);
            if (!Array.isArray(items) || items.length === 0) return;

            let loadedCount = 0;
            const total = items.length;
            this.images = new Array(total).fill(null);

            items.forEach((saved, i) => {
                const img = new Image();
                img.onload = () => {
                    this.images[i] = {
                        image:       img,
                        imageUrl:    saved.dataUrl,
                        fileName:    saved.fileName  || 'image.jpg',
                        fileSize:    saved.fileSize  || 0,
                        imageOffset: saved.imageOffset || { x: 0, y: 0 },
                        exifData:    saved.exifData  || null,
                    };
                    loadedCount++;
                    if (loadedCount === total) {
                        this.images = this.images.filter(item => item !== null);
                        this.currentIndex = Math.min(savedIndex, this.images.length - 1);
                        this.onImagesChanged();
                    }
                };
                img.onerror = () => {
                    loadedCount++;
                    if (loadedCount === total) {
                        this.images = this.images.filter(item => item !== null);
                        this.currentIndex = Math.min(savedIndex, this.images.length - 1);
                        if (this.images.length > 0) this.onImagesChanged();
                    }
                };
                img.src = saved.dataUrl;
            });
        } catch (e) { /* 복원 실패 시 무시 */ }
    }

    async renderItemToBlob(item, dims, photoArea) {
        const offscreen = document.createElement('canvas');
        offscreen.width = dims.width; offscreen.height = dims.height;
        const ctx = offscreen.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        this.drawFrameBackground(ctx, item.image, dims.width, dims.height);
        const draw = this.getDrawDimensions(item.image);
        ctx.save();
        ctx.beginPath(); ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height); ctx.clip();
        const x = photoArea.x + (photoArea.width - draw.width) / 2 + item.imageOffset.x;
        const y = photoArea.y + (photoArea.height - draw.height) / 2 + item.imageOffset.y;
        ctx.drawImage(item.image, x, y, draw.width, draw.height);
        ctx.restore();
        return await new Promise((resolve, reject) => {
            offscreen.toBlob(blob => { offscreen.width = 0; offscreen.height = 0; blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')); }, 'image/jpeg', 0.95);
        });
    }

    async renderConvertedBlob(item, mime, quality) {
        const img = item.image;
        const offscreen = document.createElement('canvas');
        offscreen.width = img.naturalWidth; offscreen.height = img.naturalHeight;
        offscreen.getContext('2d').drawImage(img, 0, 0);
        return await new Promise((resolve, reject) => {
            offscreen.toBlob(b => { offscreen.width = 0; offscreen.height = 0; b ? resolve(b) : reject(new Error('toBlob failed')); }, mime, quality);
        });
    }

    // =========================================================
    // 이미지 선택 / 내비게이션
    // =========================================================

    selectImage(index) {
        if (index < 0 || index >= this.images.length || index === this.currentIndex) return;
        const prevIndex = this.currentIndex;
        this.currentIndex = index;
        if (this._profileCache) delete this._profileCache[prevIndex];
        this._autoDominantColor = null;
        this.render(true);
        this.updateNavArrows();
        this.updateThumbnailHighlight();
        requestAnimationFrame(() => {
            this.updateInfo(); this.updateUploadUI(); if (this.updateMobilePhotoTab) this.updateMobilePhotoTab();
            if (this.currentImage) this.displayExif(this.currentImage.exifData);
        });
    }

    navigatePrev() {
        if (this.appMode === 'split') { if (this.splitCurrentPanel > 0) { this.splitCurrentPanel--; this.render(); this.updateNavArrows(); if (this.updateSplitThumbnailHighlight) this.updateSplitThumbnailHighlight(); } return; }
        if (this.currentIndex > 0) this.selectImage(this.currentIndex - 1);
    }

    navigateNext() {
        if (this.appMode === 'split') { if (this.splitCurrentPanel < this.splitCount - 1) { this.splitCurrentPanel++; this.render(); this.updateNavArrows(); if (this.updateSplitThumbnailHighlight) this.updateSplitThumbnailHighlight(); } return; }
        if (this.currentIndex < this.images.length - 1) this.selectImage(this.currentIndex + 1);
    }

    updateNavArrows() {
        if (this.appMode === 'split') {
            const show = this.hasImage && this.splitCount > 1;
            this.navPrevBtn.classList.toggle('visible', show && this.splitCurrentPanel > 0);
            this.navNextBtn.classList.toggle('visible', show && this.splitCurrentPanel < this.splitCount - 1);
            if (this.feedNavPrevBtn) this.feedNavPrevBtn.classList.toggle('visible', false);
            if (this.feedNavNextBtn) this.feedNavNextBtn.classList.toggle('visible', false);
            if (this.feedDots) this.feedDots.style.display = 'none';
            return;
        }
        const show = this.hasMultipleImages;
        this.navPrevBtn.classList.toggle('visible', show && this.currentIndex > 0);
        this.navNextBtn.classList.toggle('visible', show && this.currentIndex < this.images.length - 1);
        if (this.feedNavPrevBtn) this.feedNavPrevBtn.classList.toggle('visible', show && this.currentIndex > 0);
        if (this.feedNavNextBtn) this.feedNavNextBtn.classList.toggle('visible', show && this.currentIndex < this.images.length - 1);
        this.updateFeedDots();
    }

    updateFeedDots() {
        if (!this.feedDots) return;
        if (!this.hasMultipleImages) { this.feedDots.style.display = 'none'; return; }
        this.feedDots.style.display = '';
        this.feedDots.innerHTML = this.images.map((item, i) =>
            item ? `<div class="feed-dot${i === this.currentIndex ? ' active' : ''}"></div>` : ''
        ).join('');
    }

    // =========================================================
    // 이미지 제거
    // =========================================================

    removeImage() { if (this.images.length > 0) this.removeImageAt(this.currentIndex); }

    removeImageAt(index) {
        if (index < 0 || index >= this.images.length) return;
        const removed = this.images.splice(index, 1)[0];
        if (removed && removed.imageUrl) URL.revokeObjectURL(removed.imageUrl);
        if (this.images.length === 0) this.currentIndex = 0;
        else if (this.currentIndex >= this.images.length) this.currentIndex = this.images.length - 1;
        else if (index < this.currentIndex) this.currentIndex--;
        this.fileInput.value = '';
        this.onImagesChanged();
    }

    onImagesChanged() {
        const has = this.hasImage;
        this._autoDominantColor = null;
        this.updateThumbnailStrip(); this.updateNavArrows(); this.updateUploadUI();
        this.updateDownloadButton(); this.render(); this.updateInfo();
        if (this.updateMobilePhotoTab) this.updateMobilePhotoTab();
        this.downloadBtn.disabled = !has;
        if (this.mobileDownloadBtn) this.mobileDownloadBtn.disabled = !has;
        this.previewToolbar.style.display = has ? '' : 'none';
        this.previewContainer.classList.toggle('has-image', has);
        if (this.feedMockup) this.feedMockup.classList.toggle('has-image', has);
        this.updatePreviewContainerSize();
        if (!has) {
            const previewArea = this.previewContainer.closest('.preview-area');
            if (previewArea) { previewArea.style.width = ''; previewArea.style.marginLeft = ''; previewArea.style.marginRight = ''; }
            this.previewContainer.style.width = ''; this.previewContainer.style.height = '';
            if (this.exifSection) { this.exifSection.style.display = 'none'; this.exifGrid.innerHTML = ''; }
            if (this.mobileExifSection) { this.mobileExifSection.style.display = 'none'; this.mobileExifGrid.innerHTML = ''; }
            this.uploadZone.classList.remove('has-image');
            this.uploadContent.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p>클릭하거나 파일을 드래그하세요</p><span class="upload-hint">또는 Ctrl+V로 붙여넣기</span>`;
        } else { if (this.currentImage) this.displayExif(this.currentImage.exifData); }
        this.updatePreviewContainerSize();
    }

    // =========================================================
    // 프리셋 / 설정 저장
    // =========================================================

    getCurrentPreset() {
        return { canvasRatio: [...this.canvasRatio], frameRatio: this.frameRatio, frameColor: this.frameColor, blurIntensity: this.blurIntensity, pixelateIntensity: this.pixelateIntensity, exifStyle: this.exifStyle, exifFields: this.exifFields ? { ...this.exifFields } : undefined, exifFontSize: this.exifFontSize, exifTextColor: this.exifTextColor, exifSeparator: this.exifSeparator, exifBarColor: this.exifBarColor, filmBrand: this.filmBrand, glassPosition: this.glassPosition, glassTheme: this.glassTheme, hudAccent: this.hudAccent, cardVariant: this.cardVariant, polaroidFont: this.polaroidFont };
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
        if (preset.filmBrand !== undefined) this.filmBrand = preset.filmBrand;
        if (preset.glassPosition !== undefined) this.glassPosition = preset.glassPosition;
        if (preset.glassTheme    !== undefined) this.glassTheme    = preset.glassTheme;
        if (preset.hudAccent !== undefined) this.hudAccent = preset.hudAccent;
        if (preset.cardVariant !== undefined) this.cardVariant = preset.cardVariant;
        if (preset.polaroidFont !== undefined) this.polaroidFont = preset.polaroidFont;
        if (!options.skipRender) { this.updateCanvasSize(); this.render(); this.updateInfo(); }
    }

    saveLastSettings() {
        try { localStorage.setItem('pfm-last-settings', JSON.stringify(this.getCurrentPreset())); } catch (e) { /* ignore */ }
    }

    loadLastSettings() {
        try { const saved = localStorage.getItem('pfm-last-settings'); if (saved) this.applyPreset(JSON.parse(saved), { skipRender: true }); } catch (e) { /* ignore */ }
    }

    // =========================================================
    // 즐겨찾기
    // =========================================================

    getFavorites() { try { return JSON.parse(localStorage.getItem('pfm-favorites') || '[]'); } catch (e) { return []; } }

    saveFavorite() {
        const favorites = this.getFavorites();
        if (favorites.length >= 5) return;
        const preset = this.getCurrentPreset(); preset.name = '';
        favorites.push(preset);
        try { localStorage.setItem('pfm-favorites', JSON.stringify(favorites)); } catch (e) { /* ignore */ }
        this.renderFavoritesUI();
    }

    removeFavorite(index) {
        const favorites = this.getFavorites();
        favorites.splice(index, 1);
        try { localStorage.setItem('pfm-favorites', JSON.stringify(favorites)); } catch (e) { /* ignore */ }
        this.renderFavoritesUI();
    }

    renderFavoritesUI() {
        const favorites = this.getFavorites();
        const buildList = (container) => {
            if (!container) return;
            container.textContent = '';
            favorites.forEach((fav, i) => {
                const item = document.createElement('div');
                item.className = 'favorite-item'; item.dataset.index = i;
                const preview = document.createElement('div'); preview.className = 'favorite-preview';
                if (fav.frameColor === 'auto') preview.style.background = 'conic-gradient(from 0deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#9b59b6,#ff6b6b)';
                else if (fav.frameColor?.startsWith('#')) preview.style.background = fav.frameColor;
                if (fav.canvasRatio) preview.style.aspectRatio = fav.canvasRatio[0] + '/' + fav.canvasRatio[1];
                const inner = document.createElement('div'); inner.className = 'favorite-preview-inner'; preview.appendChild(inner);
                const name = document.createElement('span'); name.className = 'favorite-name'; name.textContent = fav.name || (fav.canvasRatio?.[0] + ':' + fav.canvasRatio?.[1] + ' ' + fav.frameRatio + '%');
                const removeBtn = document.createElement('button'); removeBtn.className = 'favorite-remove'; removeBtn.dataset.index = i; removeBtn.textContent = '×'; removeBtn.title = '삭제';
                item.append(preview, name, removeBtn); container.appendChild(item);
            });
        };
        buildList(this.favoritesList); buildList(this.mobileFavoritesList);
        if (this.favoritesEmpty) this.favoritesEmpty.style.display = favorites.length === 0 ? '' : 'none';
        const full = favorites.length >= 5;
        if (this.favoriteSaveBtn) this.favoriteSaveBtn.disabled = full;
        if (this.mobileFavoriteSaveBtn) this.mobileFavoriteSaveBtn.disabled = full;
    }

    resetAllOffsets() { this.images.forEach(item => { if (item) item.imageOffset = { x: 0, y: 0 }; }); }

    // =========================================================
    // 썸네일 스트립
    // =========================================================

    updateThumbnailStrip() {
        if (this.appMode === 'split') { if (this.updateSplitThumbnails) this.updateSplitThumbnails(); return; }
        const loaded = this.loadedImages;
        if (loaded.length <= 1) { this.thumbnailStrip.style.display = 'none'; this.returnThumbnailStrip(); return; }
        this.thumbnailCounter.textContent = `${this.currentIndex + 1}/${this.images.length}`;
        this.thumbnailAddBtn.style.display = this.images.length >= 10 ? 'none' : '';
        this.thumbnailList.innerHTML = this.images.map((item, i) => {
            if (!item) return '';
            return `<div class="thumbnail-item ${i === this.currentIndex ? 'active' : ''}" data-index="${i}"><img src="${item.imageUrl}" alt="${escapeHtml(item.fileName)}"><button class="thumbnail-remove" data-index="${i}" type="button" aria-label="사진 ${i + 1} 삭제">&times;</button></div>`;
        }).join('');
        const isMobile = window.innerWidth <= 900;
        if (isMobile) {
            this.thumbnailList.appendChild(this.thumbnailAddBtn);
            if (this.activeTab === 'photo' && this.mobileThumbnailSlot) this.mobileThumbnailSlot.appendChild(this.thumbnailStrip);
        } else {
            this.thumbnailStrip.style.display = '';
            if (this.thumbnailAddBtn.parentElement === this.thumbnailList) this.thumbnailStrip.insertBefore(this.thumbnailAddBtn, this.thumbnailCounter);
        }
        if (!isMobile) requestAnimationFrame(() => {
            const active = this.thumbnailList.querySelector('.thumbnail-item.active');
            if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        });
    }

    updateThumbnailHighlight() {
        this.thumbnailList.querySelectorAll('.thumbnail-item').forEach(item => item.classList.toggle('active', parseInt(item.dataset.index) === this.currentIndex));
        this.thumbnailCounter.textContent = `${this.currentIndex + 1}/${this.images.length}`;
        if (window.innerWidth > 900) {
            const active = this.thumbnailList.querySelector('.thumbnail-item.active');
            if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }

    returnThumbnailStrip() {
        if (this.thumbnailStripParent && this.thumbnailStrip.parentElement !== this.thumbnailStripParent) {
            this.thumbnailStripParent.appendChild(this.thumbnailStrip);
        }
    }

    // =========================================================
    // 업로드 UI
    // =========================================================

    updateUploadUI() {
        const cur = this.currentImage; if (!cur) return;
        this.uploadZone.classList.add('has-image');
        const sizeStr = cur.fileSize < 1024 * 1024 ? (cur.fileSize / 1024).toFixed(1) + ' KB' : (cur.fileSize / (1024 * 1024)).toFixed(1) + ' MB';
        const countLabel = this.hasMultipleImages ? ` (${this.currentIndex + 1}/${this.imageCount})` : '';
        this.uploadContent.innerHTML = `<img class="upload-thumb" src="${cur.imageUrl}" alt="미리보기"><div class="upload-info"><div class="upload-filename">${escapeHtml(cur.fileName)}${countLabel}</div><div class="upload-filesize">${cur.image.naturalWidth} × ${cur.image.naturalHeight} px · ${sizeStr}</div><div class="upload-hint" style="display:block; margin-top:2px;">클릭하여 추가</div></div><span id="upload-remove-btn" title="사진 삭제" style="flex-shrink:0; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:rgba(0,0,0,0.1); color:#6b7280; font-size:18px; cursor:pointer; line-height:1;">&times;</span>`;
        document.getElementById('upload-remove-btn')?.addEventListener('click', e => { e.stopPropagation(); this.removeImage(); });
    }

    // =========================================================
    // 다운로드 버튼 레이블
    // =========================================================

    updateDownloadButton() {
        let label, mobileText;
        if (this.appMode === 'split' && this.hasImage) { label = `ZIP 다운로드 (${this.splitCount}장 분할)`; mobileText = 'ZIP'; }
        else if (this.hasMultipleImages) { label = `ZIP 다운로드 (${this.imageCount}장)`; mobileText = 'ZIP'; }
        else if (this.appMode === 'exif') { label = 'EXIF 프레임 다운로드'; mobileText = '저장'; }
        else if (this.appMode === 'convert') { const fmt = this.outputFormat.toUpperCase().replace('JPEG', 'JPG'); label = this.outputFormat === 'png' ? `${fmt} 다운로드 (무손실)` : `${fmt} 다운로드 (${this.outputQuality}%)`; mobileText = '저장'; }
        else { label = 'PNG 다운로드 (무손실)'; mobileText = '저장'; }
        const btnLabel = this.downloadBtn.querySelector('.btn-label');
        if (btnLabel) btnLabel.textContent = label;
        const mobileLabel = this.mobileTabBar?.querySelector('[data-tab="download"] span');
        if (mobileLabel) mobileLabel.textContent = mobileText;
    }

    // =========================================================
    // 드래그 처리
    // =========================================================

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: (e.clientX - rect.left) * (this.canvas.width / rect.width), y: (e.clientY - rect.top) * (this.canvas.height / rect.height) };
    }

    isInPhotoArea(coords) {
        const pa = this.getPhotoArea();
        return coords.x >= pa.x && coords.x <= pa.x + pa.width && coords.y >= pa.y && coords.y <= pa.y + pa.height;
    }

    onDragStart(e) {
        if (!this.currentImage) return;
        const coords = this.getCanvasCoords(e);
        if (!this.isInPhotoArea(coords)) return;
        this.isDragging = true;
        this.dragStart = coords;
        this.dragStartOffset = { ...this.currentImage.imageOffset };
    }

    onDragMove(e) {
        if (!this.isDragging || !this.currentImage) return;
        const coords = this.getCanvasCoords(e);
        this.currentImage.imageOffset.x = this.dragStartOffset.x + (coords.x - this.dragStart.x);
        this.currentImage.imageOffset.y = this.dragStartOffset.y + (coords.y - this.dragStart.y);
        this.render(true);
    }

    onDragEnd() { if (this.isDragging) { this.isDragging = false; this.saveLastSettings(); } }

    // =========================================================
    // EXIF 표시
    // =========================================================

    displayExif(data) {
        if (!data) { if (this.exifSection) this.exifSection.style.display = 'none'; if (this.mobileExifSection) this.mobileExifSection.style.display = 'none'; return; }
        const items = [];
        const make = data[0x010F] || '', model = data[0x0110] || '';
        if (model) items.push(['카메라', model.startsWith(make) ? model : (make ? `${make} ${model}` : model)]);
        if (data[0xA434]) items.push(['렌즈', data[0xA434]]);
        if (data[0x920A]) items.push(['초점거리', `${Math.round(data[0x920A].value)}mm`]);
        if (data[0x829D]) { const f = data[0x829D].value; items.push(['조리개', `f/${f % 1 === 0 ? f.toFixed(0) : f.toFixed(1)}`]); }
        if (data[0x829A]) { const { num, den } = data[0x829A]; if (num && den) { const ss = num / den; items.push(['셔터속도', ss >= 1 ? `${ss}s` : `1/${Math.round(den / num)}s`]); } }
        if (data[0x8827]) items.push(['ISO', `${data[0x8827]}`]);
        const dateStr = data[0x9003] || data[0x0132];
        if (dateStr) items.push(['촬영일', dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1.$2.$3')]);
        if (data[0x0131]) items.push(['소프트웨어', data[0x0131]]);
        if (items.length === 0) { if (this.exifSection) this.exifSection.style.display = 'none'; if (this.mobileExifSection) this.mobileExifSection.style.display = 'none'; return; }
        const html = items.map(([label, value]) => `<span class="info-label">${escapeHtml(label)}</span><span class="info-value">${escapeHtml(value)}</span>`).join('');
        if (this.exifGrid) { this.exifGrid.innerHTML = html; this.exifSection.style.display = ''; }
        if (this.mobileExifGrid) { this.mobileExifGrid.innerHTML = html; this.mobileExifSection.style.display = ''; }
    }

    // =========================================================
    // 정보 표시
    // =========================================================

    updateInfo() {
        const dims = this.getCanvasDimensions(); const fw = this.getFrameWidth(); const pa = this.getPhotoArea();
        if (this.infoCanvas) this.infoCanvas.textContent = `${dims.width} × ${dims.height} px`;
        if (this.infoFrame) this.infoFrame.textContent = `${fw} px`;
        if (this.infoPhoto) this.infoPhoto.textContent = `${pa.width} × ${pa.height} px`;
        if (this.mobileInfoCanvas) this.mobileInfoCanvas.textContent = `${dims.width} × ${dims.height} px`;
        if (this.mobileInfoFrame) this.mobileInfoFrame.textContent = `${fw} px`;
        if (this.mobileInfoPhoto) this.mobileInfoPhoto.textContent = `${pa.width} × ${pa.height} px`;
        const cur = this.currentImage;
        if (cur) {
            const origText = this.appMode === 'split'
                ? `${cur.image.naturalWidth} × ${cur.image.naturalHeight} px (패널 ${this.splitCurrentPanel + 1}/${this.splitCount})`
                : `${cur.image.naturalWidth} × ${cur.image.naturalHeight} px`;
            [this.infoOriginalLabel, this.infoOriginal, this.mobileInfoOriginalLabel, this.mobileInfoOriginal].forEach(el => { if (el) el.style.display = ''; });
            if (this.infoOriginal) this.infoOriginal.textContent = origText;
            if (this.mobileInfoOriginal) this.mobileInfoOriginal.textContent = origText;
            const draw = (this.appMode === 'split' && this.getSplitDrawDimensions) ? this.getSplitDrawDimensions(cur.image) : this.getDrawDimensions(cur.image);
            const strip = (this.appMode === 'split' && this.getSplitStripDimensions) ? this.getSplitStripDimensions(cur.image) : null;
            const srcW = strip ? strip.width : cur.image.naturalWidth;
            const srcH = strip ? strip.height : cur.image.naturalHeight;
            const scale = Math.min(draw.width / srcW, draw.height / srcH);
            const showWarn = scale > 1.5 ? '' : 'none';
            if (this.upscaleWarning) this.upscaleWarning.style.display = showWarn;
            if (this.mobileUpscaleWarning) this.mobileUpscaleWarning.style.display = showWarn;
        } else {
            [this.infoOriginalLabel, this.infoOriginal, this.mobileInfoOriginalLabel, this.mobileInfoOriginal, this.upscaleWarning, this.mobileUpscaleWarning].forEach(el => { if (el) el.style.display = 'none'; });
        }
    }

    // =========================================================
    // 다운로드 잠금 / 진행바 / 토스트
    // =========================================================

    setDownloadLock(locked) {
        this.isDownloading = locked;
        this.downloadBtn.disabled = locked || !this.hasImage;
        if (this.mobileDownloadBtn) this.mobileDownloadBtn.disabled = locked || !this.hasImage;
        if (this.thumbnailStrip) this.thumbnailStrip.querySelectorAll('.thumbnail-remove').forEach(btn => { btn.style.pointerEvents = locked ? 'none' : ''; });
    }

    showProgress(current, total, text) {
        let bar = document.getElementById('download-progress');
        if (!bar) {
            bar = document.createElement('div'); bar.id = 'download-progress'; bar.className = 'download-progress';
            bar.innerHTML = `<div class="progress-bar-track"><div class="progress-bar-fill" id="progress-fill"></div></div><span class="progress-text" id="progress-text"></span>`;
            this.downloadBtn.parentElement.appendChild(bar);
        }
        bar.style.display = '';
        const pct = Math.round((current / total) * 100);
        document.getElementById('progress-fill').style.width = pct + '%';
        document.getElementById('progress-text').textContent = text || `이미지 처리 중... (${current}/${total})`;
    }

    hideProgress() { const bar = document.getElementById('download-progress'); if (bar) bar.style.display = 'none'; }

    showToast(message, duration = 3000) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => { requestAnimationFrame(() => { toast.classList.add('show'); }); });
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, duration);
    }

    // =========================================================
    // 프리뷰 모드 (피드/프로필 목업)
    // =========================================================

    updatePreviewMode() {
        const isFeed = this.previewMode === 'feed'; const isProfile = this.previewMode === 'profile';
        if (this.previewContainer) this.previewContainer.style.display = (isFeed || isProfile) ? 'none' : '';
        if (this.feedMockup) this.feedMockup.style.display = isFeed ? '' : 'none';
        if (this.profileMockup) this.profileMockup.style.display = isProfile ? '' : 'none';
        if (isFeed || isProfile) this.updateMockupImages();
    }

    updateMockupImages() {
        if (this.previewMode === 'default' || this.isDragging || !this.hasImage) return;
        const dataUrl = this.canvas.toDataURL('image/jpeg', 0.85);
        if (this.previewMode === 'feed' && this.feedImage) { this.feedImage.src = dataUrl; }
        else if (this.previewMode === 'profile') { this.updateProfileGrid(); }
    }

    renderItemToDataUrl(item) {
        const dims = this.getCanvasDimensions();
        if (!this._profileTempCanvas) this._profileTempCanvas = document.createElement('canvas');
        const tc = this._profileTempCanvas; tc.width = dims.width; tc.height = dims.height;
        const ctx = tc.getContext('2d');
        this.drawFrameBackground(ctx, item.image, dims.width, dims.height);
        const photoArea = this.getPhotoArea(); const draw = this.getDrawDimensions(item.image);
        ctx.save(); ctx.beginPath(); ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height); ctx.clip();
        const x = photoArea.x + (photoArea.width - draw.width) / 2 + item.imageOffset.x;
        const y = photoArea.y + (photoArea.height - draw.height) / 2 + item.imageOffset.y;
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(item.image, x, y, draw.width, draw.height); ctx.restore();
        return tc.toDataURL('image/jpeg', 0.8);
    }

    updateProfileGrid() {
        const totalCells = 9; const loaded = this.loadedImages;
        if (!this.profileGrid) return;
        if (loaded.length <= 1) {
            this._profileCache = null;
            while (this.profileGrid.firstChild) this.profileGrid.removeChild(this.profileGrid.firstChild);
            for (let i = 0; i < totalCells; i++) {
                const div = document.createElement('div');
                if (i === 4 && this.hasImage) {
                    div.className = 'profile-grid-item target'; div.dataset.index = '0';
                    const img = document.createElement('img'); img.className = 'profile-grid-image'; img.id = 'profile-grid-image';
                    img.src = this.canvas.toDataURL('image/jpeg', 0.85); img.alt = ''; div.appendChild(img);
                } else { div.className = 'profile-grid-item placeholder'; }
                this.profileGrid.appendChild(div);
            }
            this.profileGridImage = document.getElementById('profile-grid-image');
        } else {
            if (!this._profileCache) this._profileCache = {};
            const cache = this._profileCache; const curIdx = this.currentIndex;
            cache[curIdx] = this.canvas.toDataURL('image/jpeg', 0.85);
            while (this.profileGrid.firstChild) this.profileGrid.removeChild(this.profileGrid.firstChild);
            for (let i = 0; i < totalCells; i++) {
                const div = document.createElement('div'); const item = this.images[i];
                if (i < this.images.length && item) {
                    div.className = 'profile-grid-item target' + (i === curIdx ? ' current' : ''); div.dataset.index = String(i);
                    const img = document.createElement('img'); img.className = 'profile-grid-image'; img.alt = '';
                    if (!cache[i]) cache[i] = this.renderItemToDataUrl(item);
                    img.src = cache[i]; div.appendChild(img);
                } else { div.className = 'profile-grid-item placeholder'; }
                this.profileGrid.appendChild(div);
            }
        }
    }

    // =========================================================
    // 모바일 탭바 / 바텀시트
    // =========================================================

    updateMobilePhotoTab() {
        const cur = this.currentImage;
        if (!this.mobilePhotoInfo) return;
        if (cur) {
            this.mobilePhotoInfo.style.display = '';
            if (this.mobilePhotoThumb) this.mobilePhotoThumb.src = cur.imageUrl;
            if (this.mobilePhotoName) this.mobilePhotoName.textContent = cur.fileName;
            const sizeStr = cur.fileSize < 1048576 ? (cur.fileSize / 1024).toFixed(1) + ' KB' : (cur.fileSize / 1048576).toFixed(1) + ' MB';
            if (this.mobilePhotoSize) this.mobilePhotoSize.textContent = `${cur.image.naturalWidth} × ${cur.image.naturalHeight} px · ${sizeStr}`;
            if (this.mobilePhotoUploadLabel) this.mobilePhotoUploadLabel.textContent = '사진 추가';
            if (this.mobilePhotoDeleteBtn) this.mobilePhotoDeleteBtn.style.display = '';
        } else {
            this.mobilePhotoInfo.style.display = 'none';
            if (this.mobilePhotoUploadLabel) this.mobilePhotoUploadLabel.textContent = '사진 추가';
            if (this.mobilePhotoDeleteBtn) this.mobilePhotoDeleteBtn.style.display = 'none';
        }
    }

    setupBottomSheet() {
        if (!this.mobileTabBar) return;
        this.activeTab = null;

        this.mobileTabBar.addEventListener('click', e => {
            const btn = e.target.closest('.tab-btn'); if (!btn) return;
            const tab = btn.dataset.tab;
            if (tab === 'download') { download(this); return; }
            if (tab === 'photo' && !this.hasImage) { this.fileInput.click(); return; }
            this.activeTab === tab ? this.closeTabPanel() : this.openTabPanel(tab);
        });

        if (this.sheetBackdrop) this.sheetBackdrop.addEventListener('click', () => this.closeTabPanel());

        // Mobile 입력 동기화 (ratio, frame, color, blur, pixelate, split)
        const mb = id => document.getElementById(id);

        mb('mobile-ratio-buttons')?.addEventListener('click', e => {
            const btn = e.target.closest('.ratio-btn'); if (!btn) return;
            const ratio = btn.dataset.ratio;
            [this.ratioButtons, this.mobileRatioButtons].forEach(c => c?.querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === ratio)));
            const [w, h] = ratio.split(':').map(Number); this.canvasRatio = [w, h];
            this.syncFramePxInputs(); this.resetAllOffsets(); this.updateCanvasSize(); this.render(); this.updateInfo();
        });

        this.mobileCanvasSizeInput?.addEventListener('input', () => {
            const val = parseInt(this.mobileCanvasSizeInput.value);
            if (val >= 100 && val <= 10000) { this.canvasSize = val; if (this.canvasSizeInput) this.canvasSizeInput.value = val; this.syncFramePxInputs(); this.resetAllOffsets(); this.updateCanvasSize(); this.render(); this.updateInfo(); }
        });

        this.mobileFrameRatioSlider?.addEventListener('input', () => {
            this.frameRatio = parseFloat(this.mobileFrameRatioSlider.value);
            if (this.mobileFrameRatioInput) this.mobileFrameRatioInput.value = this.frameRatio;
            if (this.frameRatioSlider) this.frameRatioSlider.value = this.frameRatio;
            if (this.frameRatioInput) this.frameRatioInput.value = this.frameRatio;
            this.syncFramePxInputs(); this.resetAllOffsets(); this.render(); this.updateInfo();
        });

        this.mobileFrameRatioInput?.addEventListener('input', () => {
            let val = parseFloat(this.mobileFrameRatioInput.value); if (isNaN(val)) return;
            val = Math.max(0, Math.min(25, val)); this.frameRatio = val;
            if (this.mobileFrameRatioSlider) this.mobileFrameRatioSlider.value = val;
            if (this.frameRatioSlider) this.frameRatioSlider.value = val;
            if (this.frameRatioInput) this.frameRatioInput.value = val;
            this.syncFramePxInputs(); this.resetAllOffsets(); this.render(); this.updateInfo();
        });

        this.mobileFrameRatioPxInput?.addEventListener('input', () => {
            let px = parseInt(this.mobileFrameRatioPxInput.value, 10); if (isNaN(px)) return;
            const maxPx = Math.round(this.canvasSize * 25 / 100); px = Math.max(0, Math.min(maxPx, px));
            const rounded = Math.round((this.canvasSize > 0 ? (px / this.canvasSize) * 100 : 0) * 2) / 2;
            this.frameRatio = rounded;
            [this.frameRatioSlider, this.frameRatioInput, this.mobileFrameRatioSlider, this.mobileFrameRatioInput].forEach(el => { if (el) el.value = rounded; });
            if (this.frameRatioPxInput) this.frameRatioPxInput.value = px;
            this.resetAllOffsets(); this.render(); this.updateInfo();
        });
        this.mobileFrameRatioPxInput?.addEventListener('change', () => this.syncFramePxInputs());

        this.mobileColorPresets?.addEventListener('click', e => {
            const swatch = e.target.closest('.color-swatch'); if (!swatch) return;
            const color = swatch.dataset.color;
            [this.colorPresets, this.mobileColorPresets].forEach(c => c?.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color)));
            this.frameColor = color;
            if (!this.isStyleFrame) { if (this.customColorInput) this.customColorInput.value = color; if (this.mobileCustomColorInput) this.mobileCustomColorInput.value = color; }
            this.updateStyleControlsVisibility(); this.render();
        });

        this.mobileCustomColorInput?.addEventListener('input', () => {
            this.frameColor = this.mobileCustomColorInput.value;
            if (this.customColorInput) this.customColorInput.value = this.frameColor;
            [this.colorPresets, this.mobileColorPresets].forEach(c => c?.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active')));
            this.updateStyleControlsVisibility(); this.render();
        });

        this.mobileBlurSlider?.addEventListener('input', () => {
            this.blurIntensity = parseInt(this.mobileBlurSlider.value);
            if (this.blurSlider) this.blurSlider.value = this.blurIntensity;
            if (this.blurValueLabel) this.blurValueLabel.textContent = this.blurIntensity;
            if (this.mobileBlurValueLabel) this.mobileBlurValueLabel.textContent = this.blurIntensity;
            this.render();
        });

        this.mobilePixelateSlider?.addEventListener('input', () => {
            this.pixelateIntensity = parseInt(this.mobilePixelateSlider.value);
            if (this.pixelateSlider) this.pixelateSlider.value = this.pixelateIntensity;
            if (this.pixelateValueLabel) this.pixelateValueLabel.textContent = this.pixelateIntensity;
            if (this.mobilePixelateValueLabel) this.mobilePixelateValueLabel.textContent = this.pixelateIntensity;
            this.render();
        });

        this.mobileSplitDirectionButtons?.addEventListener('click', e => { const btn = e.target.closest('.split-btn'); if (btn) this.setSplitDirection(btn.dataset.direction); });
        this.mobileSplitButtons?.addEventListener('click', e => { const btn = e.target.closest('.split-btn'); if (btn) this.setSplitCount(parseInt(btn.dataset.split)); });

        this.mobilePhotoUploadBtn?.addEventListener('click', () => this.fileInput.click());
        this.mobilePhotoDeleteBtn?.addEventListener('click', () => { this.removeImage(); if (!this.hasImage) this.closeTabPanel(); });

        window.addEventListener('resize', () => { if (window.innerWidth > 900) this.closeTabPanel(); });

        // 페이지 이탈 전 이미지 상태를 sessionStorage에 저장 (cross-page 전달)
        window.addEventListener('beforeunload', () => this.saveImagesToSession());
    }

    openTabPanel(tab) {
        this.activeTab = tab;
        if (this.mobileTabBar) this.mobileTabBar.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
        if (this.mobileTabPanels) this.mobileTabPanels.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.tab === tab));
        if (this.sheetBackdrop) this.sheetBackdrop.classList.add('active');
        if (tab === 'photo' && this.hasMultipleImages && this.mobileThumbnailSlot) { this.mobileThumbnailSlot.appendChild(this.thumbnailStrip); }
        else { this.returnThumbnailStrip(); }
    }

    closeTabPanel() {
        this.activeTab = null;
        if (this.mobileTabBar) this.mobileTabBar.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        if (this.mobileTabPanels) this.mobileTabPanels.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        if (this.sheetBackdrop) this.sheetBackdrop.classList.remove('active');
        this.returnThumbnailStrip();
    }

}
