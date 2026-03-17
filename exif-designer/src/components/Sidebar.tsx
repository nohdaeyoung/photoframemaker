import React, { useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { type AppState, STYLES } from '../types';

interface SidebarProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onDownload?: () => void;
  onImageFile?: (file: File) => void;
}


export function Sidebar({ state, setState, onDownload, onImageFile }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isStyleOpen, setIsStyleOpen] = React.useState(false);
  const [isExifOpen, setIsExifOpen] = React.useState(true);
  const [isDragHover, setIsDragHover] = React.useState(false);

  const currentStyle = STYLES.find(s => s.id === state.styleId) || STYLES[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImageFile?.(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragHover(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onImageFile?.(file);
  };

  return (
    <div className="w-full h-full flex flex-col font-sans" style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Header (Desktop only) */}
      <div className="hidden lg:block pt-6 px-4 pb-4 border-b border-[#222222] shrink-0">
        <div className="font-bold text-[18px] text-white tracking-[-0.02em]">
          f.<span className="text-[#ff6b35]">324</span>.ing
        </div>
        <div className="mt-1 text-[12px] text-[#666666] tracking-[0.05em] uppercase">
          EXIF FRAME DESIGNER
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Frame Style */}
        <section className="p-4 border-b border-[#1a1a1a]">
          <h3 className="text-[11px] font-semibold text-[#888888] uppercase tracking-[0.08em] mb-3">
            FRAME STYLE
          </h3>
          <div className="relative">
            <button
              onClick={() => setIsStyleOpen(!isStyleOpen)}
              className={`w-full flex items-center justify-between pl-3 pr-9 h-10 bg-[rgba(26,26,26,0.6)] backdrop-blur-md border ${isStyleOpen ? 'border-[#ff6b35] shadow-[0_0_0_2px_rgba(255,107,53,0.15)]' : 'border-[#333333] hover:border-[#444444]'} rounded-lg text-left transition-all`}
            >
              <span className="text-[13px] text-[#e0e0e0] truncate">
                {String(STYLES.findIndex(s => s.id === state.styleId) + 1).padStart(2, '0')} · {currentStyle.name}
              </span>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
            </button>
            {isStyleOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-[#1a1a1a]/95 backdrop-blur-xl border border-[#333333] rounded-lg shadow-xl z-20 max-h-[240px] overflow-auto">
                {STYLES.map((style, idx) => (
                  <button
                    key={style.id}
                    onClick={() => { setState(prev => ({ ...prev, styleId: style.id })); setIsStyleOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${state.styleId === style.id ? 'bg-[rgba(255,107,53,0.1)] text-[#ff6b35]' : 'text-[#e0e0e0] hover:bg-[rgba(255,255,255,0.05)]'}`}
                  >
                    {String(idx + 1).padStart(2, '0')} · {style.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2 pl-0.5 text-[11px] text-[#555555] leading-[1.4]">
            {currentStyle.desc}
          </div>
        </section>

        {/* Image Upload */}
        <section className="p-4 border-b border-[#1a1a1a]">
          <h3 className="text-[11px] font-semibold text-[#888888] uppercase tracking-[0.08em] mb-3">
            IMAGE
          </h3>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragHover(true); }}
            onDragLeave={() => setIsDragHover(false)}
            onDrop={handleDrop}
            className={`w-full py-5 rounded-[10px] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
              isDragHover
                ? 'border-[#ff6b35] bg-[rgba(255,107,53,0.05)]'
                : 'border-[#333333] bg-[rgba(15,15,15,0.6)] hover:bg-[rgba(26,26,26,0.6)]'
            }`}
          >
            <div className="text-[28px] mb-2 leading-none">📷</div>
            <div className="text-[13px] text-[#888888] mb-1">클릭 또는 드래그하여 업로드</div>
            <div className="text-[11px] text-[#555555]">JPG, PNG, WebP — Max 20MB</div>
          </div>
        </section>

        {/* EXIF Metadata */}
        <section className="p-4 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold text-[#888888] uppercase tracking-[0.08em]">
              EXIF METADATA
            </h3>
            <button
              onClick={() => setIsExifOpen(!isExifOpen)}
              className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${isExifOpen ? 'bg-[#ff6b35]' : 'bg-[#333333]'}`}
            >
              <div className={`absolute top-0.5 left-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 ${isExifOpen ? 'translate-x-[16px]' : 'translate-x-0'}`} />
            </button>
          </div>
          {isExifOpen && (
            <div className="space-y-1 bg-[rgba(26,26,26,0.4)] border border-[#2a2a2a] rounded-[10px] p-3 backdrop-blur-md">
              {[
                { label: 'Camera', value: state.exif.camera },
                { label: 'Lens',   value: state.exif.lens },
                { label: 'Aperture', value: state.exif.aperture },
                { label: 'Shutter', value: state.exif.shutter },
                { label: 'ISO',    value: `ISO ${state.exif.iso}` },
                { label: 'Focal',  value: state.exif.focal },
                { label: 'Date',   value: state.exif.date },
                ...(state.exif.film ? [{ label: 'Film Sim', value: state.exif.film, accent: true }] : []),
              ].map(({ label, value, accent }) => (
                <div key={label} className="flex justify-between items-center py-1.5 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                  <span className="text-[11px] text-[#666666]">{label}</span>
                  <span
                    className="text-[12px] font-mono tracking-tight truncate ml-2 max-w-[60%] text-right"
                    style={{ fontFamily: '"JetBrains Mono", monospace', color: accent ? '#ff6b35' : '#e0e0e0' }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={onDownload}
            className="mt-4 w-full py-3 bg-[#ff6b35] hover:bg-[#e55a28] active:bg-[#d04e1f] active:scale-[0.98] text-white text-[14px] font-semibold rounded-lg tracking-[-0.01em] transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(255,107,53,0.3)] hover:shadow-[0_6px_20px_rgba(255,107,53,0.4)]"
          >
            📥 Download Frame
          </button>
        </section>
      </div>
    </div>
  );
}
