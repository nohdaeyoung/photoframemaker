import { X } from 'lucide-react';

interface RunningViewProps {
  tilesDone: number;
  tilesTotal: number;
  etaMs: number;
  onCancel: () => void;
}

function formatEta(ms: number): string {
  if (ms <= 0) return '완료 중...';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `약 ${s}초 남음`;
  return `약 ${Math.ceil(s / 60)}분 남음`;
}

export function RunningView({ tilesDone, tilesTotal, etaMs, onCancel }: RunningViewProps) {
  const pct = tilesTotal > 0 ? Math.round((tilesDone / tilesTotal) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#ece8e2] flex items-center justify-center">
        <span className="text-3xl animate-pulse">⚡</span>
      </div>

      <div>
        <p className="text-[15px] text-[#1c1917] font-medium mb-1">업스케일 진행 중</p>
        <p className="text-[12px] text-[#a8a09a]">
          타일 {tilesDone} / {tilesTotal}
        </p>
      </div>

      <div className="w-full bg-[#ece8e2] rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c5c3a, #c4ad94)' }}
        />
      </div>

      <div className="flex justify-between w-full text-[11px]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
        <span className="text-[#7c5c3a] font-medium">{pct}%</span>
        <span className="text-[#a8a09a]">{formatEta(etaMs)}</span>
      </div>

      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#e4dfd8] text-[#78706a] text-[13px] hover:border-[#a8a09a] hover:text-[#1c1917] transition-colors bg-white"
      >
        <X className="w-3.5 h-3.5" />
        취소
      </button>
    </div>
  );
}
