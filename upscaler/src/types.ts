export type ExecutionProvider = 'webgpu' | 'webgl' | 'wasm';

export type AppPhase =
  | { status: 'idle' }
  | { status: 'ready'; imageSrc: string; imageData: ImageData; fileName: string }
  | { status: 'running'; imageSrc: string; imageData: ImageData; fileName: string; tilesDone: number; tilesTotal: number; etaMs: number }
  | { status: 'preparing'; imageSrc: string; fileName: string; originalW: number; originalH: number }
  | { status: 'done'; originalSrc: string; upscaledSrc: string; fileName: string; originalW: number; originalH: number; upscaledW: number; upscaledH: number; jpegBlob: Blob; pngBlob: Blob };

export type AppAction =
  | { type: 'FILE_SELECTED'; imageSrc: string; imageData: ImageData; fileName: string }
  | { type: 'RUN_START'; tilesTotal: number }
  | { type: 'TILE_DONE'; tilesDone: number; etaMs: number }
  | { type: 'TILES_DONE' }
  | { type: 'RUN_DONE'; upscaledSrc: string; jpegBlob: Blob; pngBlob: Blob; upscaledW: number; upscaledH: number }
  | { type: 'RESET' };
