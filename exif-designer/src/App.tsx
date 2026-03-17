import { useState, useRef, useEffect } from 'react';
import { LayoutPanelLeft, ImagePlus, Moon, Sun } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Sidebar } from './components/Sidebar';
import { FrameCanvas } from './components/FrameCanvas';
import { type AppState, STYLES, DEFAULT_EXIF } from './types';
import { parseExifFromFile } from './hooks/useExifParser';

const DEFAULT_STATE: AppState = {
  styleId: 'fujifilm',
  theme: 'dark',
  imageSrc: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1600&h=1000&fit=crop',
  imageRatio: 3 / 2,
  orientation: 'landscape',
  exif: DEFAULT_EXIF,
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(DEFAULT_STATE);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasFileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (!event.target?.result) return;
      const imageSrc = event.target.result as string;
      const parsed = await parseExifFromFile(file);
      const img = new Image();
      img.onload = () => {
        const imageRatio = img.naturalWidth / img.naturalHeight;
        setAppState(prev => ({
          ...prev,
          imageSrc,
          imageRatio,
          orientation: imageRatio >= 1 ? 'landscape' : 'portrait',
          exif: { ...prev.exif, ...parsed },
        }));
      };
      img.src = imageSrc;
    };
    reader.readAsDataURL(file);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setAppState(prev => {
          const idx = STYLES.findIndex(s => s.id === prev.styleId);
          const next = e.key === 'ArrowLeft' ? Math.max(0, idx - 1) : Math.min(STYLES.length - 1, idx + 1);
          return { ...prev, styleId: STYLES[next].id };
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleDownload = async () => {
    if (!frameRef.current) return;
    try {
      const rect = frameRef.current.getBoundingClientRect();
      const canvas = await html2canvas(frameRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 3,
        width: rect.width,
        height: rect.height,
        backgroundColor: null,
        logging: false,
        onclone: (doc) => {
          doc.querySelectorAll<HTMLElement>('*').forEach(el => {
            el.style.setProperty('backdrop-filter', 'none', 'important');
            el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
          });
        },
      });
      const url = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.download = `f324ing_${appState.styleId}_${Date.now()}.jpg`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate image', err);
      alert('다운로드에 실패했습니다.');
    }
  };

  const handleToggleOrientation = () => {
    const isLandscape = appState.orientation === 'landscape';
    const newSrc = isLandscape
      ? 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=1000&h=1400&fit=crop'
      : 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1600&h=1000&fit=crop';
    const newRatio = isLandscape ? 2 / 3 : 3 / 2;
    setAppState(prev => ({
      ...prev,
      orientation: isLandscape ? 'portrait' : 'landscape',
      imageSrc: newSrc,
      imageRatio: newRatio,
    }));
  };

  const imageRatio = appState.imageRatio;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const currentIdx = STYLES.findIndex(s => s.id === appState.styleId);

  return (
    <div className="flex flex-col h-screen w-full bg-[#050505] text-[#e0e0e0] overflow-hidden">
      {/* Background dot grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center">
        <div className="w-[800px] h-[800px] bg-[#ff6b35] opacity-[0.03] blur-[120px] rounded-full" />
      </div>

      {/* Mobile header */}
      <div className="flex lg:hidden pt-3 px-4 pb-3 border-b border-[rgba(255,255,255,0.08)] shrink-0 bg-[#0a0a0a]/80 backdrop-blur-2xl items-center justify-between z-20 relative">
        <div className="flex items-baseline gap-2">
          <div className="font-bold text-[16px] text-white tracking-[-0.02em]">
            f.<span className="text-[#ff6b35]">324</span>.ing
          </div>
          <div className="text-[10px] text-[#666666] tracking-[0.05em] uppercase">EXIF DESIGNER</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
        {/* Main canvas area */}
        <main className="w-full h-[55dvh] lg:h-auto lg:flex-1 order-1 lg:order-2 flex flex-col items-center justify-center p-4 lg:p-10 relative z-10 shrink-0">
          {/* Top controls */}
          <div className="absolute top-3 left-3 lg:top-6 lg:left-6 flex items-center gap-2 lg:gap-3 z-20">
            <button
              onClick={handleToggleOrientation}
              className="bg-[rgba(255,255,255,0.08)] backdrop-blur-md border border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.15)] transition-all px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-[12px] lg:text-[13px] font-medium flex items-center gap-2 text-[#aaa]"
            >
              <LayoutPanelLeft className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              <span className="hidden sm:inline">
                {appState.orientation === 'landscape' ? 'Switch to Portrait' : 'Switch to Landscape'}
              </span>
            </button>
            <button
              onClick={() => setAppState(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))}
              className="bg-[rgba(255,255,255,0.08)] backdrop-blur-md border border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.15)] transition-all p-1.5 lg:p-2 rounded-full text-[#aaa]"
            >
              {appState.theme === 'dark' ? <Sun className="w-3.5 h-3.5 lg:w-4 lg:h-4" /> : <Moon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />}
            </button>
          </div>

          {/* Canvas */}
          <div className="w-full h-full flex flex-col items-center justify-center max-w-[800px]">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={canvasFileInputRef}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }}
            />
            <div
              className="relative shadow-[0_20px_60px_rgba(0,0,0,0.6)] transition-all duration-300 shrink-0 hover:-translate-y-[2px] group cursor-pointer"
              style={{
                width: imageRatio >= 1
                  ? `min(100%, calc(${isMobile ? '40dvh' : '85vh'} * ${imageRatio}))`
                  : `min(100%, calc(${isMobile ? '35dvh' : '75vh'} * ${imageRatio}))`,
                maxWidth: '100%',
              }}
              onClick={() => canvasFileInputRef.current?.click()}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-[#ff6b35]/10 to-transparent blur-2xl -z-10 rounded-[10px]" />
              <FrameCanvas ref={frameRef} state={appState} imageRatio={imageRatio} />
              {/* Upload overlay */}
              <div className="absolute inset-0 rounded-[4px] flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" style={{ background: 'rgba(0,0,0,0.45)' }}>
                <ImagePlus className="w-8 h-8 text-white drop-shadow-lg" />
                <span className="text-white text-[13px] font-medium tracking-wide drop-shadow-lg">사진 첨부</span>
              </div>
            </div>

            {/* Style label */}
            <div
              className="mt-3 lg:mt-4 text-[#555] text-[11px] lg:text-[12px] tracking-[0.05em] text-center"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {String(currentIdx + 1).padStart(2, '0')} · {STYLES[currentIdx]?.name} — {appState.styleId}
            </div>

            {/* Navigation dots */}
            <div className="flex items-center gap-1.5 lg:gap-2 mt-3 lg:mt-5">
              {STYLES.map((style) => {
                const isActive = appState.styleId === style.id;
                return (
                  <div
                    key={style.id}
                    onClick={() => setAppState(prev => ({ ...prev, styleId: style.id }))}
                    className={`transition-all duration-300 cursor-pointer rounded-full ${
                      isActive
                        ? 'w-5 lg:w-6 h-1.5 lg:h-2 bg-[#ff6b35]'
                        : 'w-1.5 lg:w-2 h-1.5 lg:h-2 bg-[#333333] hover:bg-[#444]'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Arrow navigation */}
          {currentIdx > 0 && (
            <button
              onClick={() => setAppState(prev => ({ ...prev, styleId: STYLES[currentIdx - 1].id }))}
              className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[rgba(255,255,255,0.08)] backdrop-blur-[8px] border border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.15)] flex items-center justify-center text-[16px] lg:text-[18px] text-[#aaa] transition-all"
            >
              ‹
            </button>
          )}
          {currentIdx < STYLES.length - 1 && (
            <button
              onClick={() => setAppState(prev => ({ ...prev, styleId: STYLES[currentIdx + 1].id }))}
              className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[rgba(255,255,255,0.08)] backdrop-blur-[8px] border border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.15)] flex items-center justify-center text-[16px] lg:text-[18px] text-[#aaa] transition-all"
            >
              ›
            </button>
          )}
        </main>

        {/* Sidebar */}
        <div className="w-full lg:w-[360px] h-[45dvh] lg:h-full order-2 lg:order-1 border-t lg:border-t-0 lg:border-r border-[rgba(255,255,255,0.08)] bg-[#0a0a0a]/80 backdrop-blur-2xl shrink-0 flex flex-col z-20 relative">
          <Sidebar state={appState} setState={setAppState} onDownload={handleDownload} onImageFile={handleImageFile} />
        </div>

        {/* Keyboard hint */}
        <div className="hidden lg:flex fixed bottom-4 right-4 items-center gap-1.5 z-10">
          {['←', '→'].map(key => (
            <div
              key={key}
              className="h-[22px] min-w-[22px] px-1.5 bg-[#1a1a1a] border border-[#333] rounded-[4px] flex items-center justify-center text-[#666] text-[11px]"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {key}
            </div>
          ))}
          <span className="text-[11px] text-[#444] ml-1">to navigate</span>
        </div>
      </div>
    </div>
  );
}
