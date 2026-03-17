export interface Tile {
  srcX: number;   // 원본 이미지 내 시작 x
  srcY: number;   // 원본 이미지 내 시작 y
  w: number;      // 타일 너비 (패딩 포함)
  h: number;      // 타일 높이 (패딩 포함)
  data: Float32Array;  // NCHW [1, 3, h, w] 0.0–1.0
}

/**
 * ImageData → Tile[] 분할
 * stride = tileSize - overlap * 2
 */
export function splitTiles(
  imageData: ImageData,
  tileSize: number = 256,
  overlap: number = 12,
): Tile[] {
  const { width, height, data } = imageData;
  const stride = tileSize - overlap * 2;
  const tiles: Tile[] = [];

  const tilesX = Math.ceil(width / stride);
  const tilesY = Math.ceil(height / stride);

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      // 타일 소스 영역 (원본 좌표)
      const x0 = Math.max(0, tx * stride - overlap);
      const y0 = Math.max(0, ty * stride - overlap);
      const x1 = Math.min(width, x0 + tileSize);
      const y1 = Math.min(height, y0 + tileSize);
      const tw = x1 - x0;
      const th = y1 - y0;

      // RGBA → Float32 NCHW [1, 3, th, tw]
      const float = new Float32Array(3 * th * tw);
      for (let py = 0; py < th; py++) {
        for (let px = 0; px < tw; px++) {
          const si = ((y0 + py) * width + (x0 + px)) * 4;
          const di = py * tw + px;
          float[di]                  = data[si]!   / 255;  // R
          float[th * tw + di]        = data[si + 1]! / 255;  // G
          float[2 * th * tw + di]    = data[si + 2]! / 255;  // B
        }
      }

      tiles.push({ srcX: x0, srcY: y0, w: tw, h: th, data: float });
    }
  }

  return tiles;
}

/**
 * 추론 결과 타일 → 최종 ImageData 병합
 * overlap 영역을 크롭하여 이음새 방지
 */
export function mergeTiles(
  results: Array<{ tile: Tile; output: Float32Array; outW: number; outH: number }>,
  originalW: number,
  originalH: number,
  overlap: number = 12,
  scale: number = 4,
): ImageData {
  const outW = originalW * scale;
  const outH = originalH * scale;
  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(outW, outH);
  const buf = imgData.data;

  for (const { tile, output, outW: tw, outH: th } of results) {
    // 실제 타일의 원본 위치
    const srcX = tile.srcX;
    const srcY = tile.srcY;

    // overlap 크롭 범위 (출력 좌표계)
    const cropX = srcX === 0 ? 0 : overlap * scale;
    const cropY = srcY === 0 ? 0 : overlap * scale;
    const cropX2 = tw - (srcX + tile.w < originalW ? overlap * scale : 0);
    const cropY2 = th - (srcY + tile.h < originalH ? overlap * scale : 0);

    // 붙여넣을 출력 위치
    const dstX = srcX * scale + cropX;
    const dstY = srcY * scale + cropY;

    for (let py = cropY; py < cropY2; py++) {
      for (let px = cropX; px < cropX2; px++) {
        const si = py * tw + px;
        const di = ((dstY + py - cropY) * outW + (dstX + px - cropX)) * 4;
        buf[di]     = Math.round(output[si]!                * 255);
        buf[di + 1] = Math.round(output[th * tw + si]!      * 255);
        buf[di + 2] = Math.round(output[2 * th * tw + si]!  * 255);
        buf[di + 3] = 255;
      }
    }
  }

  return imgData;
}

/** ImageData → dataURL (미리보기용) */
export function imageDataToDataURL(imageData: ImageData, quality = 0.95): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d')!.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

/** ImageData → { dataURL, jpegBlob, pngBlob } 한 번에 생성 */
export async function imageDataToDownloadReady(
  imageData: ImageData,
): Promise<{ dataURL: string; jpegBlob: Blob; pngBlob: Blob }> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d')!.putImageData(imageData, 0, 0);

  const dataURL = canvas.toDataURL('image/jpeg', 0.95);

  const [jpegBlob, pngBlob] = await Promise.all([
    new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95),
    ),
    new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png'),
    ),
  ]);

  return { dataURL, jpegBlob, pngBlob };
}

/** File → ImageData */
export async function fileToImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

/** File → dataURL */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
