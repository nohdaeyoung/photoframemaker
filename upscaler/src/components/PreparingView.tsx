export function PreparingView() {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#ece8e2] flex items-center justify-center">
        <span className="text-3xl animate-spin">⏳</span>
      </div>
      <div>
        <p className="text-[15px] text-[#1c1917] font-medium mb-1">다운로드 파일 준비 중</p>
        <p className="text-[12px] text-[#a8a09a]">타일 병합 + JPEG/PNG 생성 중...</p>
      </div>
      <div className="w-full bg-[#ece8e2] rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full animate-pulse"
          style={{ width: '100%', background: 'linear-gradient(90deg, #7c5c3a, #c4ad94)' }}
        />
      </div>
    </div>
  );
}
