import { Zap, RefreshCw } from 'lucide-react';

interface ReadyViewProps {
  imageSrc: string;
  originalW: number;
  originalH: number;
  onStart: () => void;
  onReset: () => void;
  isModelReady: boolean;
}

export function ReadyView({ imageSrc, originalW, originalH, onStart, onReset, isModelReady }: ReadyViewProps) {
  const upW = originalW * 4;
  const upH = originalH * 4;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <div className="relative rounded-xl overflow-hidden border border-[#e4dfd8] shadow-sm"
        style={{ maxHeight: '320px' }}>
        <img src={imageSrc} alt="원본" className="max-h-[320px] w-auto object-contain" />
      </div>

      <div className="flex items-center gap-3 text-[12px]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
        <span className="text-[#78706a]">{originalW} × {originalH}</span>
        <span className="text-[#a8a09a]">→ 4×</span>
        <span className="text-[#7c5c3a] font-medium">{upW} × {upH}</span>
      </div>

      <div className="flex gap-3 w-full">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#e4dfd8] text-[#78706a] text-[13px] hover:border-[#a8a09a] hover:text-[#1c1917] transition-colors bg-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          다른 사진
        </button>
        <button
          onClick={onStart}
          disabled={!isModelReady}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#7c5c3a', boxShadow: '0 2px 8px rgba(124,92,58,0.25)' }}
        >
          <Zap className="w-4 h-4" />
          {isModelReady ? '4× 업스케일 시작' : '모델 로딩 중...'}
        </button>
      </div>

      <p className="text-[11px] text-[#a8a09a]">WASM SIMD 기준 약 10–60초 소요 (이미지 크기에 따라 다름)</p>
    </div>
  );
}
