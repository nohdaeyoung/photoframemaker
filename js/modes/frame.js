/**
 * frame.js — 프레임 모드 (FrameApp)
 *
 * AppBase를 상속하며 renderMode()에서 테두리+이미지 렌더링을 담당한다.
 */

import { AppBase } from '../core/app-base.js';

export class FrameApp extends AppBase {
    constructor() {
        super();
        this.appMode = 'frame';
    }

    // ---------------------------------------------------------------
    // renderMode() — 프레임 모드 캔버스 렌더링
    // ---------------------------------------------------------------

    renderMode() {
        const dims = this.getCanvasDimensions();

        if (!this.currentImage) {
            this.canvas.width = dims.width;
            this.canvas.height = dims.height;
            this.canvas.style.aspectRatio = `${dims.width} / ${dims.height}`;
            this.ctx.clearRect(0, 0, dims.width, dims.height);
            this.drawPlaceholder();
        } else {
            this.ctx.clearRect(0, 0, dims.width, dims.height);
            this.drawFrameBackground(this.ctx, this.currentImage.image, dims.width, dims.height);
            this.drawImage();
        }

        this.updatePreviewContainerSize();
    }
}
