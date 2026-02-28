# 여러 장 작업 기능 기획안 (최대 10장)

## 1. 핵심 컨셉

현재 1장만 처리하는 구조를 **이미지 배열(최대 10장)** 기반으로 전환합니다.
프레임 설정(비율, 크기, 두께, 색상)은 **전체 공통**으로 적용하고,
사진별 **위치 오프셋만 개별 관리**합니다.

---

## 2. 데이터 모델 변경

### Before (단일 이미지)
```
this.image / this.imageUrl / this.fileName / this.fileSize / this.imageOffset
```

### After (이미지 배열)
```js
this.images = [];          // 최대 10개
this.currentIndex = 0;     // 현재 선택된 이미지 인덱스

// 각 항목 구조
{
  image: HTMLImageElement,
  imageUrl: string,
  fileName: string,
  fileSize: number,
  imageOffset: { x: 0, y: 0 },
  exifData: object | null
}
```

편의 getter:
```js
get currentImage() { return this.images[this.currentIndex] || null; }
```

---

## 3. UI 변경

### 3-1. 썸네일 스트립 (데스크톱 + 모바일 공통)

프리뷰 영역 아래, 툴바 위에 가로 스크롤 가능한 썸네일 바를 추가합니다.

```
[ 썸1 ] [ 썸2 ] [ 썸3 ] ... [ + 추가 ]     (1/3)
```

- 선택된 썸네일에 파란 테두리 강조
- `[ + ]` 버튼: 추가 업로드 (10장 이하일 때만 노출)
- 우측 끝에 "1/3" 형태의 카운터
- 이미지가 1장 이하이면 썸네일 바를 숨김

### 3-2. 업로드 영역 변경

- 기존 단일 업로드 → **여러 파일 선택** 가능 (`multiple` 속성)
- 드래그 앤 드롭, Ctrl+V도 여러 파일 지원
- 10장 초과 시 앞의 10장만 사용하고 경고 표시

### 3-3. 사이드바 업로드 섹션

- 기존 단일 파일 정보 표시 → 현재 선택된 이미지의 정보 표시
- 삭제 시 해당 이미지만 배열에서 제거, 나머지 유지

### 3-4. 프리뷰 모드 (기본/피드/프로필)

- 기본 모드: 현재 선택된 이미지의 캔버스 표시
- 피드 모드: 현재 선택된 이미지의 피드 목업
- 프로필 모드: 업로드된 이미지들로 3x3 그리드 채움 (나머지는 플레이스홀더)

### 3-5. 모바일 사진 탭

- 현재 선택 사진 정보 표시
- "사진 추가" → 추가 업로드
- "사진 삭제" → 현재 사진만 삭제
- 썸네일 스트립도 프리뷰 아래에 동일하게 표시

---

## 4. 다운로드 변경

### 이미지 1장: 현재와 동일 (단일 PNG)

### 이미지 2장 이상:
- **"모두 다운로드"** 버튼: 각 이미지를 개별 PNG로 순차 다운로드
- 파일명: `원본이름_pfm.png` (기존과 동일, 각 파일별)
- 모바일 Web Share: 현재 선택된 이미지 1장만 공유

---

## 5. 주요 로직 변경 포인트

| 영역 | 변경 내용 |
|------|-----------|
| `loadImage()` | 배열에 push, 10장 제한 체크 |
| `removeImage()` | 배열에서 splice, currentIndex 보정 |
| `render()` | `this.currentImage`의 image/offset 사용 |
| `drawImage()` | `this.currentImage.imageOffset` 사용 |
| `updateInfo()` | `this.currentImage`의 원본 크기/EXIF 표시 |
| `updateUploadUI()` | 현재 선택 이미지 정보 표시 |
| `download()` | 1장이면 기존, 2장+ 이면 순차 다운로드 |
| `onDrag*()` | `this.currentImage.imageOffset` 조작 |
| 비율/크기/프레임/색상 변경 | 모든 이미지의 offset 초기화 |
| 프로필 모드 | 실제 업로드 이미지들로 그리드 채움 |

---

## 6. 구현 순서

1. **데이터 모델 전환**: `this.image` → `this.images[]` + getter
2. **loadImage/removeImage 리팩터**: 배열 기반으로 변경
3. **썸네일 스트립 UI**: HTML + CSS + 클릭 이벤트
4. **render/draw/drag 업데이트**: currentImage 기반으로 변경
5. **다운로드 로직**: 다건 순차 다운로드
6. **프로필 그리드**: 실제 이미지로 채우기
7. **모바일 대응**: 썸네일 스트립 + 사진 탭 업데이트
