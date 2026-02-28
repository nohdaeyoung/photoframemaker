# 다중 이미지 처리 - 개발 문서

> 기획문서: [PLAN.md](./PLAN.md)
> 이 문서는 구현 방법과 코드 변경 사항을 상세히 기술합니다.

---

## 1. 아키텍처 변경 요약

```
Before                              After
──────                              ─────
this.image          (단일)     →    this.images[]        (배열, 최대 10)
this.imageUrl       (단일)     →    images[i].imageUrl
this.fileName       (단일)     →    images[i].fileName
this.fileSize       (단일)     →    images[i].fileSize
this.imageOffset    (단일)     →    images[i].imageOffset
(없음)                         →    this.currentIndex    (현재 선택 인덱스)
(없음)                         →    this.exifCache[]     (이미지별 EXIF 캐시)
```

---

## 2. 데이터 모델 상세

### 2-1. ImageItem 인터페이스

```js
/**
 * @typedef {Object} ImageItem
 * @property {HTMLImageElement} image      - 로드된 이미지 엘리먼트
 * @property {string}          imageUrl    - Object URL (메모리 관리용)
 * @property {string}          fileName    - 원본 파일명
 * @property {number}          fileSize    - 파일 크기 (bytes)
 * @property {{x:number, y:number}} imageOffset - 드래그 위치 오프셋
 * @property {object|null}     exifData    - 파싱된 EXIF 메타데이터
 * @property {string}          thumbUrl    - 썸네일용 Object URL (원본과 동일)
 */
```

### 2-2. constructor 변경

```js
// Before
constructor() {
    this.image = null;
    this.imageUrl = null;
    this.fileName = '';
    this.fileSize = 0;
    this.imageOffset = { x: 0, y: 0 };
    // ...
}

// After
constructor() {
    this.images = [];        // ImageItem[]
    this.currentIndex = 0;   // 현재 선택된 이미지 인덱스
    // ...
}
```

### 2-3. 편의 getter

```js
get currentImage() {
    return this.images[this.currentIndex] || null;
}

get imageCount() {
    return this.images.length;
}

get hasImage() {
    return this.images.length > 0;
}

get hasMultipleImages() {
    return this.images.length > 1;
}

// 기존 코드 호환용 - this.image 참조를 최소 변경으로 마이그레이션
get image() {
    return this.currentImage?.image || null;
}

get imageOffset() {
    return this.currentImage?.imageOffset || { x: 0, y: 0 };
}

set imageOffset(val) {
    if (this.currentImage) {
        this.currentImage.imageOffset = val;
    }
}
```

---

## 3. 메서드별 변경 상세

### 3-1. loadImage() → loadImages()

**현재 코드** (`app.js:456-484`): 단일 파일 처리

**변경 후**:

```js
/**
 * 하나 이상의 이미지 파일을 로드합니다.
 * @param {File[]} files - 이미지 파일 배열
 */
loadImages(files) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    const available = 10 - this.images.length;

    if (imageFiles.length === 0) return;

    if (imageFiles.length > available) {
        this.showToast(`최대 10장까지 가능합니다. ${available}장만 추가됩니다.`);
    }

    const filesToLoad = imageFiles.slice(0, available);

    filesToLoad.forEach(file => {
        const imageUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            const item = {
                image: img,
                imageUrl: imageUrl,
                fileName: file.name,
                fileSize: file.size,
                imageOffset: { x: 0, y: 0 },
                exifData: null,
                thumbUrl: imageUrl
            };

            this.images.push(item);
            this.currentIndex = this.images.length - 1;

            // EXIF 비동기 파싱
            this.parseExifForItem(file, item);

            this.onImagesChanged();
        };
        img.src = imageUrl;
    });
}

// 단일 파일 호환 래퍼
loadImage(file) {
    this.loadImages([file]);
}
```

### 3-2. removeImage() 변경

**현재 코드** (`app.js:486-524`): 단일 이미지 제거 + UI 리셋

**변경 후**:

```js
/**
 * 현재 선택된 이미지를 제거합니다.
 */
removeImage() {
    if (this.images.length === 0) return;

    const removed = this.images.splice(this.currentIndex, 1)[0];
    URL.revokeObjectURL(removed.imageUrl);

    // 인덱스 보정
    if (this.currentIndex >= this.images.length) {
        this.currentIndex = Math.max(0, this.images.length - 1);
    }

    this.fileInput.value = '';
    this.onImagesChanged();
}

/**
 * 모든 이미지를 제거합니다.
 */
removeAllImages() {
    this.images.forEach(item => URL.revokeObjectURL(item.imageUrl));
    this.images = [];
    this.currentIndex = 0;
    this.fileInput.value = '';
    this.onImagesChanged();
}
```

### 3-3. onImagesChanged() — 신규 메서드

이미지 배열이 변경될 때마다 호출되는 중앙 업데이트 메서드:

```js
onImagesChanged() {
    this.updateThumbnailStrip();
    this.updateUploadUI();
    this.updateDownloadButton();
    this.render();
    this.updateInfo();
    this.updateMobilePhotoTab();

    // 프리뷰 상태 토글
    const has = this.hasImage;
    this.downloadBtn.disabled = !has;
    this.mobileDownloadBtn.disabled = !has;
    this.previewToolbar.style.display = has ? '' : 'none';
    this.previewContainer.classList.toggle('has-image', has);

    if (!has) {
        this.exifSection.style.display = 'none';
        this.mobileExifSection.style.display = 'none';
    } else {
        this.displayExif(this.currentImage.exifData);
    }
}
```

### 3-4. selectImage() — 신규 메서드

```js
/**
 * 특정 인덱스의 이미지를 선택합니다.
 * @param {number} index
 */
selectImage(index) {
    if (index < 0 || index >= this.images.length) return;
    this.currentIndex = index;

    this.updateThumbnailStrip();
    this.render();
    this.updateInfo();
    this.updateUploadUI();
    this.updateMobilePhotoTab();
    this.displayExif(this.currentImage.exifData);
}
```

### 3-5. render() / drawImage() 변경

**변경 최소화**: getter를 활용하여 `this.image`, `this.imageOffset`이 자동으로 현재 이미지를 참조하도록 처리. render/drawImage 함수 자체는 변경 불필요.

단, `drawImage()` 내부에서 `this.imageOffset` 참조 확인:

```js
// app.js:417-420 — 기존 코드에서 offset 적용
// 현재 코드는 offset을 사용하지 않는 것으로 보이나,
// drag 로직에서 render()를 호출하므로 offset이 반영됨
const x = photoArea.x + (photoArea.width - draw.width) / 2 + this.imageOffset.x;
const y = photoArea.y + (photoArea.height - draw.height) / 2 + this.imageOffset.y;
```

### 3-6. 드래그 핸들러 변경

`onDragStart`, `onDragMove`, `onDragEnd` — getter 활용으로 변경 최소화:

```js
onDragStart(e) {
    if (!this.hasImage) return;  // this.image → this.hasImage
    // 나머지 동일 (this.imageOffset getter가 currentImage를 참조)
}
```

### 3-7. 프레임 설정 변경 시 전체 offset 초기화

비율/크기/프레임 두께 변경 이벤트에서:

```js
// Before
this.imageOffset = { x: 0, y: 0 };

// After
this.resetAllOffsets();

// 신규 메서드
resetAllOffsets() {
    this.images.forEach(item => {
        item.imageOffset = { x: 0, y: 0 };
    });
}
```

### 3-8. getDrawDimensions() 변경

```js
getDrawDimensions(targetImage = null) {
    const img = targetImage || this.image;
    if (!img) return { width: 0, height: 0 };
    // ... 나머지 동일, this.image → img 로 변경
}
```

---

## 4. 이벤트 리스너 변경

### 4-1. 파일 입력 (multiple 지원)

```js
// index.html: <input> 에 multiple 속성 추가
// <input type="file" id="file-input" accept="image/*" multiple>

// app.js:106-108
this.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        this.loadImages(e.target.files);
    }
});
```

### 4-2. 드래그 앤 드롭 (다중 파일)

```js
// app.js:118-122
this.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    this.uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        this.loadImages(e.dataTransfer.files);
    }
});

// 프리뷰 영역 드롭도 항상 허용 (이미지 있어도 추가 가능)
this.previewContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    this.previewContainer.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        this.loadImages(e.dataTransfer.files);
    }
});
```

### 4-3. 프리뷰 클릭 (이미지 있어도 업로드 추가 허용 제거)

이미지가 있을 때 프리뷰 클릭은 드래그 위치 조정으로 유지. 추가 업로드는 썸네일 스트립의 `+` 버튼 또는 사이드바를 통해서만 가능.

---

## 5. 썸네일 스트립 구현

### 5-1. HTML 구조

```html
<!-- preview-container 바로 아래에 추가 -->
<div class="thumbnail-strip" id="thumbnail-strip" style="display:none">
    <div class="thumbnail-list" id="thumbnail-list">
        <!-- 동적 생성 -->
    </div>
    <button class="thumbnail-add-btn" id="thumbnail-add-btn" title="사진 추가">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
    </button>
    <span class="thumbnail-counter" id="thumbnail-counter"></span>
</div>
```

### 5-2. CSS

```css
.thumbnail-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    width: 100%;
}

.thumbnail-list {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    flex: 1;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
}

.thumbnail-item {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
    border: 2px solid transparent;
    transition: border-color 0.15s;
}

.thumbnail-item.active {
    border-color: #3b82f6;
}

.thumbnail-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.thumbnail-item .thumbnail-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(0,0,0,0.6);
    color: white;
    font-size: 12px;
    line-height: 18px;
    text-align: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
}

.thumbnail-item:hover .thumbnail-remove {
    opacity: 1;
}

.thumbnail-add-btn {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    border: 2px dashed #d1d5db;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    flex-shrink: 0;
}

.thumbnail-counter {
    font-size: 12px;
    color: #9ca3af;
    white-space: nowrap;
    flex-shrink: 0;
}
```

### 5-3. JS — updateThumbnailStrip()

```js
updateThumbnailStrip() {
    const strip = document.getElementById('thumbnail-strip');
    const list = document.getElementById('thumbnail-list');
    const counter = document.getElementById('thumbnail-counter');
    const addBtn = document.getElementById('thumbnail-add-btn');

    if (this.images.length <= 1) {
        strip.style.display = 'none';
        return;
    }

    strip.style.display = '';
    counter.textContent = `${this.currentIndex + 1}/${this.images.length}`;
    addBtn.style.display = this.images.length >= 10 ? 'none' : '';

    list.innerHTML = this.images.map((item, i) => `
        <div class="thumbnail-item ${i === this.currentIndex ? 'active' : ''}"
             data-index="${i}">
            <img src="${item.thumbUrl}" alt="${item.fileName}">
            <span class="thumbnail-remove" data-index="${i}">&times;</span>
        </div>
    `).join('');

    // 이벤트 위임
    list.onclick = (e) => {
        const removeBtn = e.target.closest('.thumbnail-remove');
        if (removeBtn) {
            e.stopPropagation();
            const idx = parseInt(removeBtn.dataset.index);
            this.removeImageAt(idx);
            return;
        }
        const item = e.target.closest('.thumbnail-item');
        if (item) {
            this.selectImage(parseInt(item.dataset.index));
        }
    };

    // 선택된 썸네일이 보이도록 스크롤
    const activeThumb = list.querySelector('.thumbnail-item.active');
    if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}
```

---

## 6. 다운로드 — ZIP 생성

### 6-1. JSZip CDN 추가

```html
<!-- index.html <head> 또는 </body> 직전 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```

### 6-2. download() 변경

```js
async download() {
    if (!this.hasImage) return;

    if (this.hasMultipleImages) {
        await this.downloadAsZip();
    } else {
        await this.downloadSingle();
    }
}

/**
 * 단일 이미지 다운로드 (기존 로직 유지)
 */
async downloadSingle() {
    // 기존 app.js:996-1066 코드와 동일
    // this.currentImage 기반으로 동작
}

/**
 * 다중 이미지 ZIP 다운로드
 */
async downloadAsZip() {
    const zip = new JSZip();
    const total = this.images.length;
    const dims = this.getCanvasDimensions();
    const photoArea = this.getPhotoArea();

    this.showProgress(0, total);

    // 파일명 중복 처리용 카운터
    const nameCount = {};

    for (let i = 0; i < total; i++) {
        const item = this.images[i];
        this.showProgress(i + 1, total);

        // 오프스크린 캔버스에 개별 렌더링
        const blob = this.renderImageToBlob(item, dims, photoArea);

        // 파일명 생성 (중복 처리)
        const baseName = item.fileName.replace(/\.[^.]+$/, '') || 'photo';
        let zipName = `${baseName}_pfm.png`;
        if (nameCount[zipName]) {
            nameCount[zipName]++;
            zipName = `${baseName}_pfm(${nameCount[zipName]}).png`;
        } else {
            nameCount[zipName] = 1;
        }

        zip.file(zipName, blob);
    }

    // ZIP 생성
    this.showProgress(total, total, '압축 중...');
    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 1 } // PNG는 이미 압축, 빠른 처리 우선
    });

    // 다운로드
    const fileName = `photoframe_${total}장_pfm.zip`;
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
```

### 6-3. renderImageToBlob() — 신규 헬퍼

```js
/**
 * 특정 이미지를 오프스크린 캔버스에 렌더링하여 PNG Blob을 반환합니다.
 * @param {ImageItem} item
 * @param {{width:number, height:number}} dims - 캔버스 크기
 * @param {{x:number, y:number, width:number, height:number}} photoArea
 * @returns {Blob}
 */
renderImageToBlob(item, dims, photoArea) {
    const offscreen = document.createElement('canvas');
    offscreen.width = dims.width;
    offscreen.height = dims.height;
    const ctx = offscreen.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 프레임
    ctx.fillStyle = this.frameColor;
    ctx.fillRect(0, 0, dims.width, dims.height);

    // 이미지
    const draw = this.getDrawDimensions(item.image);

    ctx.save();
    ctx.beginPath();
    ctx.rect(photoArea.x, photoArea.y, photoArea.width, photoArea.height);
    ctx.clip();

    const x = photoArea.x + (photoArea.width - draw.width) / 2 + item.imageOffset.x;
    const y = photoArea.y + (photoArea.height - draw.height) / 2 + item.imageOffset.y;
    ctx.drawImage(item.image, x, y, draw.width, draw.height);
    ctx.restore();

    // toDataURL → Blob (동기)
    const dataURL = offscreen.toDataURL('image/png');
    const binary = atob(dataURL.split(',')[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: 'image/png' });
}
```

### 6-4. 프로그레스 UI

```js
showProgress(current, total, text = null) {
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
        // 다운로드 버튼 아래에 삽입
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
```

### 6-5. 다운로드 버튼 라벨 동적 변경

```js
updateDownloadButton() {
    const label = this.hasMultipleImages
        ? `모두 다운로드 (ZIP)`
        : '다운로드';

    // 데스크톱
    this.downloadBtn.querySelector('.btn-label').textContent = label;
    // 모바일
    const mobileLabel = this.mobileTabBar.querySelector('[data-tab="download"] .tab-label');
    if (mobileLabel) {
        mobileLabel.textContent = this.hasMultipleImages ? 'ZIP' : '저장';
    }
}
```

---

## 7. 프로필 모드 — 실제 이미지 그리드

현재 프로필 모드는 동일 이미지를 9칸에 반복. 변경 후 업로드된 이미지들로 채움:

```js
updateProfileGrid() {
    const cells = this.profileMockup.querySelectorAll('.profile-grid-cell img');

    cells.forEach((img, i) => {
        if (i < this.images.length) {
            // 해당 이미지를 프레임 적용된 상태로 렌더링
            const item = this.images[i];
            const miniCanvas = document.createElement('canvas');
            // ... 축소 렌더링 후 dataURL 설정
            img.src = miniCanvas.toDataURL();
        } else {
            img.src = ''; // 플레이스홀더
        }
    });
}
```

---

## 8. 토스트 알림

10장 초과 등의 경고를 위한 간단한 토스트 컴포넌트:

```js
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
```

```css
.toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: #1f2937;
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    opacity: 0;
    transition: opacity 0.3s, transform 0.3s;
    z-index: 10000;
    pointer-events: none;
}

.toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}
```

---

## 9. 코드 변경 영향 범위

### index.html
| 변경 | 위치 |
|------|------|
| `<input>` 에 `multiple` 추가 | file-input 요소 |
| JSZip CDN `<script>` 추가 | `</body>` 직전 |
| 썸네일 스트립 HTML 추가 | preview-container 아래 |
| 프로그레스 바 HTML (동적 생성이므로 불필요) | — |

### style.css
| 변경 | 상세 |
|------|------|
| `.thumbnail-strip` 계열 추가 | 썸네일 스트립 스타일 |
| `.download-progress` 계열 추가 | 프로그레스 바 스타일 |
| `.toast` 추가 | 토스트 알림 스타일 |
| 모바일 미디어쿼리 내 썸네일 대응 | `@media (max-width: 900px)` |

### app.js
| 변경 | 영향도 |
|------|--------|
| constructor: 데이터 모델 전환 | **높음** |
| getter 추가 (image, imageOffset, currentImage 등) | **높음** |
| loadImage → loadImages | **높음** |
| removeImage 배열 처리 | **중간** |
| 신규: selectImage, onImagesChanged, updateThumbnailStrip | **신규** |
| 신규: downloadAsZip, renderImageToBlob | **신규** |
| 신규: showProgress, hideProgress, showToast | **신규** |
| download → 분기 (single/zip) | **중간** |
| 이벤트 리스너: multiple 파일 처리 | **중간** |
| offset 초기화 → resetAllOffsets | **낮음** |
| render/drawImage: getter 활용으로 변경 최소 | **낮음** |
| 드래그 핸들러: getter 활용으로 변경 최소 | **낮음** |

---

## 10. 테스트 체크리스트

### 기본 기능
- [ ] 단일 이미지 업로드 → 기존과 동일 동작
- [ ] 다중 이미지 업로드 (2~10장)
- [ ] 11장 이상 업로드 시도 → 10장 제한 + 토스트
- [ ] 추가 업로드로 누적
- [ ] 드래그 앤 드롭 다중 파일
- [ ] Ctrl+V 붙여넣기 (단일)

### 썸네일 스트립
- [ ] 2장 이상일 때 표시, 1장 이하일 때 숨김
- [ ] 썸네일 클릭 → 이미지 전환
- [ ] 삭제(×) 버튼 동작
- [ ] 추가(+) 버튼 동작
- [ ] 10장일 때 추가 버튼 숨김
- [ ] 카운터 표시 정확성

### 프레임 적용
- [ ] 비율 변경 → 모든 이미지에 적용
- [ ] 크기 변경 → 모든 이미지에 적용
- [ ] 두께 변경 → 모든 이미지에 적용 + offset 초기화
- [ ] 색상 변경 → 모든 이미지에 적용
- [ ] 개별 이미지 드래그 위치 독립 유지

### 다운로드
- [ ] 1장 → 단일 PNG (기존 동작)
- [ ] 2장+ → ZIP 파일 다운로드
- [ ] ZIP 내 파일명 정확성
- [ ] ZIP 내 각 이미지 프레임 적용 확인
- [ ] 프로그레스 바 표시/숨김
- [ ] 동일 파일명 중복 처리

### 모바일
- [ ] 썸네일 스트립 터치 스크롤
- [ ] 모바일 탭 바 동작
- [ ] ZIP 다운로드 동작
- [ ] Web Share (1장일 때)

### 엣지 케이스
- [ ] 현재 이미지 삭제 → 인덱스 보정
- [ ] 마지막 이미지 삭제 → 이전으로 이동
- [ ] 전체 삭제 → 초기 화면 복귀
- [ ] 대용량 이미지 10장 처리 성능
