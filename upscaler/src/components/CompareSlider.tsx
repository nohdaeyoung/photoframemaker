import { useCallback, useRef, useState } from 'react';

interface CompareSliderProps {
  before: string;
  after: string;
}

export function CompareSlider({ before, after }: CompareSliderProps) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updatePos = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    updatePos(e.clientX);
  };
  const onMouseMove = (e: React.MouseEvent) => { if (isDragging.current) updatePos(e.clientX); };
  const onMouseUp = () => { isDragging.current = false; };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    updatePos(e.touches[0]!.clientX);
  };

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden rounded-xl border border-[#e4dfd8] shadow-sm cursor-col-resize"
      style={{ maxHeight: '480px', touchAction: 'none' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchMove={onTouchMove}
    >
      {/* AFTER (전체) */}
      <img src={after} alt="업스케일 결과" className="w-full h-auto block" draggable={false} />

      {/* BEFORE (클립) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img src={before} alt="원본" className="w-full h-auto block" draggable={false} />
      </div>

      {/* 구분선 */}
      <div
        className="absolute inset-y-0 w-[2px] bg-[#7c5c3a]/70"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-md border border-[#e4dfd8] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 7H1M13 7H10M4 4L1 7L4 10M10 4L13 7L10 10" stroke="#7c5c3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* 레이블 */}
      <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/50 text-white text-[10px] font-semibold tracking-wide">
        BEFORE
      </div>
      <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-white text-[10px] font-semibold tracking-wide"
        style={{ background: 'rgba(124,92,58,0.85)' }}>
        AFTER 4×
      </div>
    </div>
  );
}
