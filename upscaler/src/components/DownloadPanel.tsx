import { Download, RefreshCw } from 'lucide-react';

interface DownloadPanelProps {
  jpegBlob: Blob;
  pngBlob: Blob;
  originalW: number;
  originalH: number;
  upscaledW: number;
  upscaledH: number;
  fileName: string;
  onReset: () => void;
}

export function DownloadPanel({
  jpegBlob, pngBlob, originalW, originalH, upscaledW, upscaledH, fileName, onReset,
}: DownloadPanelProps) {
  function download(blob: Blob, ext: string) {
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `upscaled_4x_${baseName}.${ext}`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const jpegSizeMB = (jpegBlob.size / (1024 * 1024)).toFixed(1);
  const pngSizeMB = (pngBlob.size / (1024 * 1024)).toFixed(1);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto text-center">
      <div className="flex items-center gap-3 text-[12px]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
        <span className="text-[#78706a]">{originalW}×{originalH}</span>
        <span className="text-[#a8a09a]">→ 4×</span>
        <span className="text-[#7c5c3a] font-medium">{upscaledW}×{upscaledH}</span>
      </div>

      <div className="flex gap-2 w-full">
        <button
          onClick={() => download(jpegBlob, 'jpg')}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-lg text-white text-[13px] font-semibold transition-all active:scale-[0.98]"
          style={{ background: '#7c5c3a', boxShadow: '0 2px 8px rgba(124,92,58,0.25)' }}
        >
          <span className="flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            JPEG 95%
          </span>
          <span className="text-[10px] opacity-70">{jpegSizeMB}MB</span>
        </button>
        <button
          onClick={() => download(pngBlob, 'png')}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-lg border border-[#e4dfd8] text-[#78706a] text-[13px] font-semibold hover:border-[#a8a09a] transition-colors bg-white"
        >
          <span className="flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            PNG
          </span>
          <span className="text-[10px] text-[#a8a09a]">{pngSizeMB}MB</span>
        </button>
      </div>

      <button
        onClick={onReset}
        className="flex items-center gap-1.5 text-[12px] text-[#a8a09a] hover:text-[#7c5c3a] transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        새 사진 업스케일
      </button>
    </div>
  );
}
