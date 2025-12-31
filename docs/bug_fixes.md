# 🐛 Bug Fixes (오류 수정 내용)

이 문서는 개발 과정에서 발견된 버그와 그 수정 내용을 기록합니다.

---

## 📅 2024-12-31

### 1. 콜라주 미리보기 생성 오류
- **문제**: 콜라주 레이아웃(`collage-*`)을 선택하고 "이미지 생성"을 눌렀을 때, 콜라주 형태가 아닌 일반 단일 이미지가 생성됨.
- **원인**: `StepAnalysis.tsx`의 `handleGeneratePreview` 함수에서, 섹션이 단일 슬롯(`imageSlots` 길이가 1 이하)인 경우 무조건 기본 `imagePrompt`만 사용하는 로직으로 빠짐. 콜라주 타입에 대한 분기 처리가 누락됨.
- **수정**:
  ```typescript
  // StepAnalysis.tsx
  const isCollageLayout = section.layoutType?.startsWith('collage-');
  if (isCollageLayout) {
      const collagePrompt = buildCollagePrompt(...);
      // ... generateSectionImage 호출
      return;
  }
  ```
  위와 같이 콜라주 레이아웃인지 확인하고, 맞다면 `buildCollagePrompt`를 사용하여 이미지를 생성하도록 로직을 추가함.

### 2. 미니맵 레이아웃 배지 표시 오류
- **문제**: 미니맵에서 모든 비그리드 섹션이 "전체"로만 표시됨.
- **원인**: `SectionMiniMap.tsx`의 `getBadgeInfo` 함수에서 `layoutType`에 대한 상세 케이스 처리가 부족했음.
- **수정**: `text-only`, `split-left`, `split-right` 등 각 레이아웃 타입별 케이스를 추가하고, 콜라주 레이아웃(`collage-*`)에 대한 보라색 배지 처리를 추가함.

---
