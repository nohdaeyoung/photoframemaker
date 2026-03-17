import type { ExecutionProvider } from '../types';

interface HeaderProps {
  ep: ExecutionProvider;
  isModelReady: boolean;
}

const EP_LABELS: Record<ExecutionProvider, { label: string; color: string }> = {
  webgpu: { label: 'WebGPU', color: '#22c55e' },
  webgl: { label: 'WebGL', color: '#d97706' },
  wasm:  { label: 'CPU (WASM)', color: '#78706a' },
};

export function Header({ ep, isModelReady }: HeaderProps) {
  const epInfo = EP_LABELS[ep];
  return (
    <header className="shrink-0 border-b border-[#e4dfd8] px-5 py-3 flex items-center justify-between bg-[#f8f6f3]">
      <div className="flex items-baseline gap-2">
        <span className="font-bold text-[17px] text-[#1c1917] tracking-[-0.02em]"
          style={{ fontFamily: '"Inter", sans-serif' }}>
          f.<span style={{ color: '#7c5c3a' }}>324</span>.ing
        </span>
        <span className="text-[10px] text-[#a8a09a] tracking-[0.06em] uppercase"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          AI UPSCALER
        </span>
      </div>
      {isModelReady && (
        <div className="flex items-center gap-1.5 text-[11px]"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: epInfo.color }} />
          <span style={{ color: epInfo.color }}>{epInfo.label}</span>
        </div>
      )}
    </header>
  );
}
