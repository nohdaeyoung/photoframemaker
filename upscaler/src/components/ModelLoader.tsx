interface ModelLoaderProps {
  progress: number;
}

export function ModelLoader({ progress }: ModelLoaderProps) {
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#ece8e2] flex items-center justify-center">
        <span className="text-2xl">🧠</span>
      </div>
      <div>
        <p className="text-[14px] text-[#1c1917] font-medium mb-0.5">AI 모델 로딩 중</p>
        <p className="text-[11px] text-[#a8a09a]">최초 방문 시 4.6MB 다운로드 (이후 캐시)</p>
      </div>
      <div className="w-full bg-[#ece8e2] rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${progress}%`, background: '#7c5c3a' }}
        />
      </div>
      <p className="text-[11px] text-[#a8a09a]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
        {progress}%
      </p>
    </div>
  );
}
