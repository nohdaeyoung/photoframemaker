# Plan: newexifframe-migration

## 개요

`newexifframe/` 프로토타입(React + TypeScript + Tailwind CSS)을 완전한 독립 페이지로 구현.
기존 `exif.html`(Canvas 2D / Vanilla JS)은 유지하고, 다크 테마 디자이너 페이지를 신규 추가한다.

## 목표

- URL: `f.324.ing/newexif/`
- 기존 기능 영향 없음 (exif.html, index.html 등 변경 없음)
- 프로토타입 이슈 4가지 수정 후 배포 가능 상태로 구현

## 수정할 이슈

| # | 이슈 | 해결 방법 |
|---|------|----------|
| 1 | `ccomponents/` 타입오류 (import 경로 불일치) | 폴더명 → `components/` 수정 |
| 2 | EXIF 자동 파싱 없음 | `exifr` 라이브러리로 업로드 이미지에서 파싱 |
| 3 | 폰트 미임포트 (JetBrains Mono, Playfair Display, Caveat) | index.html Google Fonts 링크 추가 |
| 4 | html2canvas glassmorphism 한계 | glassmorphism 다운로드 시 안내 문구 추가 |

## 신규 기능

- 이미지 업로드 시 EXIF 자동 파싱 → Sidebar에 실제 데이터 표시
- 라이트/다크 테마 토글 (프레임별)
- 가로/세로 방향 전환
- 키보드 ← → 스타일 네비게이션

## 기술 스택

- React 18 + TypeScript + Tailwind CSS v3 + Vite
- `exifr`: 이미지 EXIF 파싱
- `html2canvas`: 다운로드 (glassmorphism 제외 정상 동작)
- `lucide-react`: 아이콘

## 파일 구조 (구현 후)

```
photoframemaker/
├── exif-designer/          ← 신규 React 앱 소스
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FrameCanvas.tsx
│   │   │   └── Sidebar.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
└── newexif/                ← 빌드 출력 (Vercel 서빙)
    ├── index.html
    └── assets/
```

## 배포

```bash
cd exif-designer && npm run build   # dist/ → ../newexif/ 복사
vercel --prod --yes                  # photoframemaker 루트에서
```

## 범위

- IN: 10개 스타일 구현, EXIF 파싱, 다운로드, 반응형
- OUT: 기존 exif.html 수정, 기타 페이지 변경
