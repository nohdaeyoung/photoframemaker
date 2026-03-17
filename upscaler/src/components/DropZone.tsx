import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface DropZoneProps {
  onFile: (file: File) => void;
  isModelLoading?: boolean;
}

const MAX_SIZE_MB = 20;
const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function DropZone({ onFile, isModelLoading }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(file: File): string | null {
    if (!ACCEPT_TYPES.includes(file.type)) return 'JPG, PNG, WebP 파일만 지원합니다';
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `파일 크기가 ${MAX_SIZE_MB}MB를 초과합니다`;
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    onFile(file);
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      <div
        onClick={() => !isModelLoading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={`w-full py-16 px-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all duration-200 ${
          isModelLoading
            ? 'opacity-50 cursor-not-allowed border-[#d5cfc7]'
            : isDragging
              ? 'border-[#7c5c3a] bg-[rgba(124,92,58,0.06)] cursor-copy'
              : 'border-[#d5cfc7] hover:border-[#a8a09a] cursor-pointer bg-[#f8f6f3] hover:bg-[#f0ede8]'
        }`}
      >
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
          isDragging ? 'bg-[rgba(124,92,58,0.12)]' : 'bg-[#ece8e2]'
        }`}>
          <Upload className={`w-6 h-6 ${isDragging ? 'text-[#7c5c3a]' : 'text-[#a8a09a]'}`} />
        </div>

        <div className="text-center">
          <p className="text-[15px] text-[#1c1917] font-medium mb-1">
            {isDragging ? '여기에 놓으세요' : '사진을 드래그하거나 클릭해서 업로드'}
          </p>
          <p className="text-[12px] text-[#a8a09a]">JPG, PNG, WebP — 최대 20MB</p>
        </div>
      </div>

      {error && (
        <p className="text-[13px] text-[#b05a5a]">{error}</p>
      )}

      <div className="text-center text-[11px] text-[#a8a09a] space-y-0.5">
        <p>모든 처리는 브라우저 내에서 수행됩니다 — 서버 전송 없음</p>
        <p>내 디바이스 GPU를 사용합니다 (WebGPU / WebGL / CPU)</p>
      </div>
    </div>
  );
}
