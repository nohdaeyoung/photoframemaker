import html2canvas from 'html2canvas';

export async function downloadFrame(
  frameEl: HTMLDivElement,
  styleId: string,
  fileName = 'exif-frame'
): Promise<void> {
  if (styleId === 'glassmorphism') {
    // backdrop-filter is not supported by html2canvas — notify user
    const ok = window.confirm(
      'Glassmorphism 스타일은 backdrop-filter 효과가 다운로드 이미지에 반영되지 않습니다.\n계속 다운로드하시겠습니까?'
    );
    if (!ok) return;
  }

  const canvas = await html2canvas(frameEl, {
    useCORS: true,
    allowTaint: true,
    scale: 3,
    backgroundColor: null,
    logging: false,
  });

  const url = canvas.toDataURL('image/jpeg', 0.95);
  const link = document.createElement('a');
  link.download = `${fileName}_${styleId}_${Date.now()}.jpg`;
  link.href = url;
  link.click();
}
