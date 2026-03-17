import { forwardRef } from 'react';
import { type AppState } from '../types';
import { Camera, Aperture, Zap, Film, Focus, Calendar, Ratio } from 'lucide-react';

interface FrameCanvasProps {
  state: AppState;
  imageRatio: number;
}

export const FrameCanvas = forwardRef<HTMLDivElement, FrameCanvasProps>(
  ({ state, imageRatio }, ref) => {
    const { styleId, theme, imageSrc, exif, orientation } = state;

    // 1. Fujifilm Recipe
    if (styleId === 'fujifilm') {
      const isDark = theme === 'dark';
      const bg = isDark ? '#1A1A18' : '#FAFAF5';
      const primary = isDark ? '#E8E8E2' : '#2C2C2A';
      const secondary = isDark ? '#6A6A62' : '#8A8A82';
      const tertiary = isDark ? '#6A6A62' : '#A0A098';
      const divider = isDark ? '#333330' : '#E0DDD5';
      return (
        <div ref={ref} className="w-full flex flex-col" style={{ backgroundColor: bg, fontFamily: "'JetBrains Mono', monospace" }}>
          <div className="p-1 pb-0 w-full">
            <div className="w-full relative" style={{ aspectRatio: imageRatio }}>
              <img src={imageSrc} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
            </div>
          </div>
          <div className="w-full" style={{ height: '0.5px', backgroundColor: divider }} />
          <div className="px-4 py-3 flex flex-col justify-center min-h-[48px]">
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold" style={{ color: primary }}>{exif.film || 'STANDARD'}</span>
                <span className="text-[10px] mt-0.5" style={{ color: tertiary }}>{exif.camera} · {exif.lens}</span>
              </div>
              <span className="text-[12px]" style={{ color: secondary }}>'{exif.date.substring(2).replace(/\./g, ' ')}</span>
            </div>
          </div>
        </div>
      );
    }

    // 2. Glassmorphism
    if (styleId === 'glassmorphism') {
      const isDark = theme === 'dark';
      const cardBg = isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.15)';
      const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)';
      const blur = isDark ? 'blur(24px) saturate(1.2)' : 'blur(20px) saturate(1.4)';
      return (
        <div ref={ref} className="w-full relative" style={{ aspectRatio: imageRatio }}>
          <img src={imageSrc} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          <div
            className="absolute bottom-4 left-4 rounded-2xl flex items-center gap-3"
            style={{ padding: '14px 18px', backgroundColor: cardBg, backdropFilter: blur, WebkitBackdropFilter: blur, border: `1px solid ${cardBorder}`, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxWidth: '85%' }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold leading-tight" style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{exif.camera}</span>
              <span className="text-[12px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.85)', wordBreak: 'break-word' }}>
                {exif.lens} <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span> {exif.aperture} <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span> {exif.shutter} <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span> ISO {exif.iso}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // 3. Leica Lux
    if (styleId === 'leica') {
      const isDark = theme === 'dark';
      const bg = isDark ? '#000' : '#FFF';
      const primary = isDark ? '#FFF' : '#000';
      const secondary = isDark ? '#666' : '#888';
      return (
        <div ref={ref} className="w-full flex flex-col" style={{ backgroundColor: bg, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
          <div className="w-full" style={{ aspectRatio: imageRatio }}>
            <img src={imageSrc} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          </div>
          <div className="px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#E60012' }} />
              <span className="text-[11px] font-bold tracking-[3px] uppercase" style={{ color: primary }}>{exif.camera.split(' ')[0]}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[14px] font-light tracking-[0.5px]" style={{ color: primary }}>{exif.focal} &nbsp; {exif.aperture}</span>
              <span className="text-[11px] font-light tracking-[0.5px]" style={{ color: secondary }}>{exif.shutter} &nbsp; ISO {exif.iso}</span>
            </div>
          </div>
        </div>
      );
    }

    // 4. Polaroid
    if (styleId === 'polaroid') {
      return (
        <div ref={ref} className="w-full p-4 flex flex-col" style={{ backgroundColor: '#FAF9F6', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div className="w-full" style={{ border: '0.5px solid rgba(0,0,0,0.05)', aspectRatio: imageRatio }}>
            <img src={imageSrc} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          </div>
          <div className="w-full pt-4 pb-2 px-1 flex flex-col justify-between min-h-[80px]">
            <div className="flex flex-col">
              <span className="text-[#3A3A38] text-[18px]" style={{ fontFamily: "'Caveat', cursive", lineHeight: 1.2 }}>{exif.camera}</span>
              <span className="text-[#6A6A65] text-[15px] mt-1" style={{ fontFamily: "'Caveat', cursive" }}>{exif.focal} &nbsp; {exif.aperture} &nbsp; ISO {exif.iso}</span>
            </div>
            <div className="self-end mt-4">
              <span className="text-[#8A8A82] text-[14px]" style={{ fontFamily: "'Caveat', cursive" }}>{exif.date}</span>
            </div>
          </div>
        </div>
      );
    }

    // 5. Film Strip (negative)
    if (styleId === 'negative') {
      const baseColor = '#2D2419';
      const markingColor = '#D4A853';
      const sprockets = Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="w-[8px] h-[12px] bg-black rounded-sm shrink-0" />
      ));
      return (
        <div ref={ref} className="w-full flex flex-col" style={{ backgroundColor: baseColor, fontFamily: "'Courier New', Courier, monospace" }}>
          <div className="w-full flex flex-col justify-between py-1">
            <div className="flex justify-around items-center w-full px-2 mt-1">{sprockets}</div>
            <div className="flex justify-between items-center px-6 text-[10px] font-bold" style={{ color: markingColor, opacity: 0.85 }}>
              <span>◀ 5 &nbsp;&nbsp;&nbsp; 5A</span>
              <span className="tracking-[4px] text-[8px]">▶ {exif.film || 'KODAK TX 400'}</span>
              <span>6 ▶</span>
            </div>
          </div>
          <div className="w-full bg-black px-2 relative" style={{ aspectRatio: imageRatio }}>
            <img src={imageSrc} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          </div>
          <div className="w-full flex flex-col justify-between py-1">
            <div className="flex justify-between items-center px-6 text-[9px] mt-1" style={{ color: markingColor, opacity: 0.85 }}>
              <span>{exif.camera} &nbsp;&nbsp; {exif.lens}</span>
              <span>{exif.focal} &nbsp; {exif.aperture} &nbsp; {exif.shutter} &nbsp; ISO {exif.iso}</span>
            </div>
            <div className="flex justify-around items-center w-full px-2 mb-1 mt-1">{sprockets}</div>
          </div>
        </div>
      );
    }

    // 6. Shot On
    if (styleId === 'shoton') {
      const isDark = theme === 'dark';
      const bg = isDark ? '#000' : '#FFF';
      const primary = isDark ? '#F0F0F0' : '#1A1A1A';
      const secondary = isDark ? '#777' : '#888';
      const tertiary = isDark ? '#555' : '#AAA';
      const divider = isDark ? '#222' : '#EEE';
      return (
        <div ref={ref} className="w-full flex flex-col font-sans" style={{ backgroundColor: bg }}>
          <div className="w-full" style={{ borderBottom: `1px solid ${divider}`, aspectRatio: imageRatio }}>
            <img src={imageSrc} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          </div>
          <div className="w-full flex flex-col px-6 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: isDark ? '#222' : '#F5F5F5' }}>
                <Camera className="w-5 h-5" style={{ color: primary }} />
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-semibold leading-tight" style={{ color: primary }}>{exif.camera}</span>
                <span className="text-[12px] mt-0.5" style={{ color: secondary }}>{exif.lens}</span>
              </div>
            </div>
            <div className="flex justify-between items-center w-full">
              <div className="flex-1 flex flex-col items-center border-r" style={{ borderColor: divider }}>
                <span className="text-[16px] font-semibold" style={{ color: primary }}>{exif.aperture}</span>
                <span className="text-[10px] uppercase mt-0.5" style={{ color: tertiary }}>Aperture</span>
              </div>
              <div className="flex-1 flex flex-col items-center border-r" style={{ borderColor: divider }}>
                <span className="text-[16px] font-semibold" style={{ color: primary }}>{exif.shutter}</span>
                <span className="text-[10px] uppercase mt-0.5" style={{ color: tertiary }}>Shutter Speed</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <span className="text-[16px] font-semibold" style={{ color: primary }}>ISO {exif.iso}</span>
                <span className="text-[10px] uppercase mt-0.5" style={{ color: tertiary }}>ISO</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 7. Magazine / Editorial
    if (styleId === 'magazine') {
      const isDark = theme === 'dark';
      const bg = isDark ? '#111' : '#FFF';
      const primary = isDark ? '#E8E8E8' : '#1A1A1A';
      const secondary = isDark ? '#999' : '#555';
      const tertiary = isDark ? '#666' : '#888';
      const dateText = isDark ? '#444' : '#AAA';
      const upperRule = isDark ? '#E0E0E0' : '#1A1A1A';
      const lowerRule = isDark ? '#444' : '#CCC';
      return (
        <div ref={ref} className="w-full flex flex-col p-8" style={{ backgroundColor: bg }}>
          <div className="w-full" style={{ aspectRatio: imageRatio }}>
            <img src={imageSrc} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          </div>
          <div className="w-full flex flex-col mt-6">
            <div className="w-full" style={{ height: '1.5px', backgroundColor: upperRule, marginBottom: '16px' }} />
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-[16px] font-bold" style={{ fontFamily: "'Playfair Display', serif", color: primary }}>{exif.camera}</span>
              <span className="text-[13px] italic" style={{ fontFamily: "'Playfair Display', serif", color: secondary }}>{exif.lens}</span>
            </div>
            <div className="flex items-center gap-2 mb-1 text-[11px]" style={{ color: tertiary }}>
              <span>Aperture {exif.aperture}</span><span style={{ color: lowerRule }}>·</span>
              <span>Shutter {exif.shutter}</span><span style={{ color: lowerRule }}>·</span>
              <span>ISO {exif.iso}</span><span style={{ color: lowerRule }}>·</span>
              <span>Focal {exif.focal}</span>
            </div>
            <div className="text-[10px] font-light mt-2" style={{ color: dateText }}>{exif.date}</div>
            <div className="w-full mt-4" style={{ height: '0.5px', backgroundColor: lowerRule }} />
          </div>
        </div>
      );
    }

    // 8. HUD / Dashboard
    if (styleId === 'dashboard') {
      const isDark = theme === 'dark';
      const bg = isDark ? '#0A0A0A' : '#F8F8F8';
      const valColor = isDark ? '#FFF' : '#1A1A1A';
      const labelColor = isDark ? '#555' : '#AAA';
      const infoColor = '#666';
      const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
      return (
        <div ref={ref} className="w-full flex flex-col p-6 relative" style={{ backgroundColor: bg }}>
          <div className="flex justify-between w-full mb-4 px-2">
            <div className="flex flex-col">
              <span className="text-[20px] font-bold leading-none" style={{ color: valColor, fontFamily: "'JetBrains Mono', monospace" }}>{exif.aperture}</span>
              <span className="text-[8px] font-medium tracking-[2px] mt-1" style={{ color: labelColor }}>APERTURE</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[20px] font-bold leading-none" style={{ color: valColor, fontFamily: "'JetBrains Mono', monospace" }}>{exif.iso}</span>
              <span className="text-[8px] font-medium tracking-[2px] mt-1" style={{ color: labelColor }}>ISO</span>
            </div>
          </div>
          <div className="w-full p-1" style={{ border: `1px solid ${borderColor}`, aspectRatio: imageRatio }}>
            <img src={imageSrc} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          </div>
          <div className="flex justify-between w-full mt-4 px-2 mb-8">
            <div className="flex flex-col">
              <span className="text-[20px] font-bold leading-none" style={{ color: valColor, fontFamily: "'JetBrains Mono', monospace" }}>{exif.focal}</span>
              <span className="text-[8px] font-medium tracking-[2px] mt-1" style={{ color: labelColor }}>FOCAL LENGTH</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[20px] font-bold leading-none" style={{ color: valColor, fontFamily: "'JetBrains Mono', monospace" }}>{exif.shutter}</span>
              <span className="text-[8px] font-medium tracking-[2px] mt-1" style={{ color: labelColor }}>SHUTTER SPEED</span>
            </div>
          </div>
          <div className="absolute bottom-3 left-8 right-8 flex justify-between text-[10px]" style={{ color: infoColor }}>
            <span>{exif.camera} · {exif.lens}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{exif.date}</span>
          </div>
        </div>
      );
    }

    // 9. Minimal Line
    if (styleId === 'minimal') {
      const isDark = theme === 'dark';
      const bg = isDark ? '#111' : '#FFF';
      const textColor = isDark ? '#666' : '#999';
      const divider = isDark ? '#333' : '#E0E0E0';
      return (
        <div ref={ref} className="w-full flex flex-col font-sans" style={{ backgroundColor: bg }}>
          <div className="w-full" style={{ borderBottom: `0.5px solid ${divider}`, aspectRatio: imageRatio }}>
            <img src={imageSrc} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          </div>
          <div className="w-full px-4 py-2.5 flex items-center justify-center min-h-[40px]">
            <span className="text-[11px] font-normal tracking-wide" style={{ color: textColor, wordBreak: 'break-word' }}>
              {exif.camera} <span style={{ opacity: 0.5 }}>·</span> {exif.focal} <span style={{ opacity: 0.5 }}>·</span> {exif.aperture} <span style={{ opacity: 0.5 }}>·</span> {exif.shutter} <span style={{ opacity: 0.5 }}>·</span> ISO {exif.iso}
            </span>
          </div>
        </div>
      );
    }

    // 10. Card Grid
    if (styleId === 'grid') {
      const isDark = theme === 'dark';
      const panelBg = isDark ? '#1A1A1A' : '#FFF';
      const cardBg = isDark ? '#242424' : '#F8F8F6';
      const cardBorder = isDark ? '#333' : 'transparent';
      const primary = isDark ? '#E8E8E8' : '#1A1A1A';
      const secondary = isDark ? '#777' : '#888';
      const iconColor = isDark ? '#555' : '#AAA';
      return (
        <div ref={ref} className="w-full flex flex-col font-sans" style={{ backgroundColor: panelBg }}>
          <div className="w-full" style={{ borderBottom: '0.5px solid rgba(150,150,150,0.15)', aspectRatio: imageRatio }}>
            <img src={imageSrc} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          </div>
          <div className="w-full flex flex-col p-5" style={{ minHeight: '180px' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5' }}>
                <Camera className="w-4 h-4" style={{ color: primary }} />
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold leading-tight" style={{ color: primary }}>{exif.camera}</span>
                <span className="text-[11px] mt-0.5" style={{ color: secondary }}>{exif.lens}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 grid-rows-2 gap-2 flex-1">
              {[
                { icon: <Aperture className="w-4 h-4" style={{ color: iconColor }} strokeWidth={1.5} />, val: exif.aperture, label: 'Aperture' },
                { icon: <Zap className="w-4 h-4" style={{ color: iconColor }} strokeWidth={1.5} />, val: exif.shutter, label: 'Shutter' },
                { icon: <Film className="w-4 h-4" style={{ color: iconColor }} strokeWidth={1.5} />, val: `ISO ${exif.iso}`, label: 'ISO' },
                { icon: <Focus className="w-4 h-4" style={{ color: iconColor }} strokeWidth={1.5} />, val: exif.focal, label: 'Focal' },
                { icon: <Calendar className="w-4 h-4" style={{ color: iconColor }} strokeWidth={1.5} />, val: exif.date.slice(5).replace('.', ' '), label: 'Date' },
                { icon: <Ratio className="w-4 h-4" style={{ color: iconColor }} strokeWidth={1.5} />, val: orientation === 'landscape' ? '3:2' : '2:3', label: 'Ratio' },
              ].map((item, i) => (
                <div key={i} className="rounded-xl p-2.5 flex flex-col justify-between" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
                  <div className="mb-1">{item.icon}</div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold" style={{ color: primary }}>{item.val}</span>
                    <span className="text-[9px]" style={{ color: secondary }}>{item.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className="w-full bg-black text-white flex items-center justify-center p-8">
        Unsupported Style
      </div>
    );
  }
);

FrameCanvas.displayName = 'FrameCanvas';
