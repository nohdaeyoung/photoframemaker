import { useReducer } from 'react';
import { DropZone } from './components/DropZone';
import { ModelLoader } from './components/ModelLoader';
import { ReadyView } from './components/ReadyView';
import { RunningView } from './components/RunningView';
import { PreparingView } from './components/PreparingView';
import { CompareSlider } from './components/CompareSlider';
import { DownloadPanel } from './components/DownloadPanel';
import { useOrtSession } from './hooks/useOrtSession';
import { useUpscaler } from './hooks/useUpscaler';
import { fileToImageData, fileToDataURL } from './utils/tiling';
import type { AppPhase, AppAction } from './types';

function phaseReducer(state: AppPhase, action: AppAction): AppPhase {
  switch (action.type) {
    case 'FILE_SELECTED':
      return { status: 'ready', imageSrc: action.imageSrc, imageData: action.imageData, fileName: action.fileName };

    case 'RUN_START':
      if (state.status !== 'ready') return state;
      return {
        status: 'running',
        imageSrc: state.imageSrc,
        imageData: state.imageData,
        fileName: state.fileName,
        tilesDone: 0,
        tilesTotal: action.tilesTotal,
        etaMs: 0,
      };

    case 'TILE_DONE':
      if (state.status !== 'running') return state;
      return { ...state, tilesDone: action.tilesDone, etaMs: action.etaMs };

    case 'TILES_DONE':
      if (state.status !== 'running') return state;
      return {
        status: 'preparing',
        imageSrc: state.imageSrc,
        fileName: state.fileName,
        originalW: state.imageData.width,
        originalH: state.imageData.height,
      };

    case 'RUN_DONE':
      return {
        status: 'done',
        originalSrc: (state.status === 'preparing') ? state.imageSrc : '',
        upscaledSrc: action.upscaledSrc,
        fileName: (state.status === 'preparing') ? state.fileName : '',
        originalW: (state.status === 'preparing') ? state.originalW : 0,
        originalH: (state.status === 'preparing') ? state.originalH : 0,
        upscaledW: action.upscaledW,
        upscaledH: action.upscaledH,
        jpegBlob: action.jpegBlob,
        pngBlob: action.pngBlob,
      };

    case 'RESET':
      return { status: 'idle' };

    default:
      return state;
  }
}

export default function App() {
  const [phase, dispatch] = useReducer(phaseReducer, { status: 'idle' });

  const { session, ep, isLoading: isModelLoading, loadProgress, error: modelError } = useOrtSession();
  const { run: runUpscale, cancel } = useUpscaler(session);

  const isModelReady = session !== null;

  async function handleFile(file: File) {
    try {
      const [imageSrc, imageData] = await Promise.all([
        fileToDataURL(file),
        fileToImageData(file),
      ]);
      dispatch({ type: 'FILE_SELECTED', imageSrc, imageData, fileName: file.name });
    } catch {
      alert('이미지 로드에 실패했습니다.');
    }
  }

  async function handleStart() {
    if (phase.status !== 'ready' || !session) return;
    const { imageData, imageSrc, fileName } = phase;

    const tileStride = 256 - 12 * 2;
    const tilesX = Math.ceil(imageData.width / tileStride);
    const tilesY = Math.ceil(imageData.height / tileStride);
    dispatch({ type: 'RUN_START', tilesTotal: tilesX * tilesY });

    try {
      const result = await runUpscale(
        imageData,
        (done, _total, etaMs) => dispatch({ type: 'TILE_DONE', tilesDone: done, etaMs }),
        () => dispatch({ type: 'TILES_DONE' }),
      );
      dispatch({
        type: 'RUN_DONE',
        upscaledSrc: result.dataURL,
        jpegBlob: result.jpegBlob,
        pngBlob: result.pngBlob,
        upscaledW: result.width,
        upscaledH: result.height,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg !== '취소됨') alert('업스케일 실패: ' + msg);
      dispatch({ type: 'FILE_SELECTED', imageSrc, imageData, fileName });
    }
  }

  const EP_LABELS: Record<string, { label: string; color: string }> = {
    webgpu: { label: 'WebGPU', color: '#22c55e' },
    webgl: { label: 'WebGL', color: '#d97706' },
    wasm: { label: 'CPU (WASM)', color: '#78706a' },
  };
  const epInfo = EP_LABELS[ep];

  return (
    <div className="min-h-dvh flex flex-col bg-[#f5f0e8] text-[#1c1917]">
      <header className="text-center py-6 pb-5 border-b border-[#e2dfd9] relative">
        <h1 className="text-[2rem] font-bold tracking-[-0.01em] text-[#1c1917]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          AI Upscaler
        </h1>
        <p className="text-[#78716c] mt-1.5 text-[0.9rem] font-light tracking-[0.02em]">
          브라우저에서 AI로 사진을 4배 업스케일 — 서버 전송 없음
        </p>
        <span className="absolute bottom-[-1px] left-1/2 -translate-x-1/2 w-[60px] h-px bg-[#a87a52]" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-3 gap-4">

        {isModelReady && (
          <div className="flex items-center gap-1.5 text-[11px]"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: epInfo.color }} />
            <span style={{ color: epInfo.color }}>{epInfo.label}</span>
          </div>
        )}

        {modelError && (
          <p className="text-[#b05a5a] text-[13px] text-center">
            모델 로드 실패: {modelError}
          </p>
        )}

        {isModelLoading && phase.status === 'idle' && (
          <ModelLoader progress={loadProgress} />
        )}

        {phase.status === 'idle' && !modelError && (
          <DropZone onFile={handleFile} isModelLoading={isModelLoading} />
        )}

        {phase.status === 'ready' && (
          <ReadyView
            imageSrc={phase.imageSrc}
            originalW={phase.imageData.width}
            originalH={phase.imageData.height}
            onStart={handleStart}
            onReset={() => dispatch({ type: 'RESET' })}
            isModelReady={isModelReady}
          />
        )}

        {phase.status === 'running' && (
          <RunningView
            tilesDone={phase.tilesDone}
            tilesTotal={phase.tilesTotal}
            etaMs={phase.etaMs}
            onCancel={cancel}
          />
        )}

        {phase.status === 'preparing' && (
          <PreparingView />
        )}

        {phase.status === 'done' && (
          <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
            <CompareSlider
              before={phase.originalSrc}
              after={phase.upscaledSrc}
            />
            <DownloadPanel
              jpegBlob={phase.jpegBlob}
              pngBlob={phase.pngBlob}
              originalW={phase.originalW}
              originalH={phase.originalH}
              upscaledW={phase.upscaledW}
              upscaledH={phase.upscaledH}
              fileName={phase.fileName}
              onReset={() => dispatch({ type: 'RESET' })}
            />
          </div>
        )}
      </main>
    </div>
  );
}
