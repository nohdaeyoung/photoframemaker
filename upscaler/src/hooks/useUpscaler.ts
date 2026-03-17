import { useCallback, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';
import { splitTiles, mergeTiles, imageDataToDownloadReady } from '../utils/tiling';
import type { Tile } from '../utils/tiling';

const TILE_SIZE = 256;
const OVERLAP = 12;
const SCALE = 4;

export interface UpscaleResult {
  dataURL: string;
  jpegBlob: Blob;
  pngBlob: Blob;
  width: number;
  height: number;
}

interface UseUpscalerResult {
  run: (
    imageData: ImageData,
    onTile: (done: number, total: number, etaMs: number) => void,
    onPreparing: () => void,
  ) => Promise<UpscaleResult>;
  cancel: () => void;
  isRunning: boolean;
}

export function useUpscaler(session: ort.InferenceSession | null): UseUpscalerResult {
  const [isRunning, setIsRunning] = useState(false);
  const cancelRef = useRef(false);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const run = useCallback(async (
    imageData: ImageData,
    onTile: (done: number, total: number, etaMs: number) => void,
    onPreparing: () => void,
  ): Promise<UpscaleResult> => {
    if (!session) throw new Error('모델이 로드되지 않았습니다');

    setIsRunning(true);
    cancelRef.current = false;

    try {
      const tiles = splitTiles(imageData, TILE_SIZE, OVERLAP);
      const total = tiles.length;
      const results: Array<{ tile: Tile; output: Float32Array; outW: number; outH: number }> = [];
      const startTime = Date.now();

      for (let i = 0; i < tiles.length; i++) {
        if (cancelRef.current) throw new Error('취소됨');

        const tile = tiles[i]!;
        const feeds = {
          input: new ort.Tensor('float32', tile.data, [1, 3, tile.h, tile.w]),
        };

        const output = await session.run(feeds);
        const outTensor = output['output'] ?? Object.values(output)[0];
        if (!outTensor) throw new Error('추론 출력 없음');

        const outH = tile.h * SCALE;
        const outW = tile.w * SCALE;
        results.push({
          tile,
          output: outTensor.data as Float32Array,
          outW,
          outH,
        });

        const done = i + 1;
        const elapsed = Date.now() - startTime;
        const eta = done < total ? Math.round((elapsed / done) * (total - done)) : 0;
        onTile(done, total, eta);

        // 메인 스레드 양보 → React 리렌더링 + 진행 바 업데이트
        await new Promise(r => setTimeout(r, 0));
      }

      // 타일 처리 완료 → 준비 단계 진입
      onPreparing();

      // 타일 병합
      const merged = mergeTiles(results, imageData.width, imageData.height, OVERLAP, SCALE);

      // dataURL + JPEG/PNG Blob 한 번에 생성
      const { dataURL, jpegBlob, pngBlob } = await imageDataToDownloadReady(merged);

      return {
        dataURL,
        jpegBlob,
        pngBlob,
        width: imageData.width * SCALE,
        height: imageData.height * SCALE,
      };
    } finally {
      setIsRunning(false);
    }
  }, [session]);

  return { run, cancel, isRunning };
}
