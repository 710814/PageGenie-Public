# 🛒 PageGenie (AI 상품 페이지 자동 생성)

## 1. 프로젝트 개요
**PageGenie**는 Google Gemini API(Multimodal)를 활용하여 이커머스 상품 상세페이지를 자동으로 기획, 디자인, 생성 및 현지화하는 웹 애플리케이션입니다. React 기반의 단일 페이지 애플리케이션(SPA)으로, Serverless 환경(Google Apps Script 활용)에서 동작하도록 설계되었습니다.

### 🎯 핵심 기능 (Modes)
1.  **Mode A: 신규 생성 (Creation)**
    *   사용자가 상품 사진(다중 업로드 가능)을 업로드하면 AI가 상품명, 카테고리, 특징을 분석합니다.
    *   소구점(Selling Point)이 강조된 마케팅 문구를 작성하고, 상세페이지 섹션 구조를 기획합니다.
    *   각 섹션에 필요한 이미지를 AI(Imagen/Gemini Image)가 새로 생성합니다.
2.  **Mode B: 현지화 (Localization)**
    *   기존 해외 상세페이지 스크린샷을 업로드하면, 레이아웃을 유지하면서 한국어 마케팅 문구로 변환합니다.
    *   기존 이미지를 분석하여 텍스트가 제거된 고화질 이미지를 재생성하거나 스타일을 유지합니다.

---

## 2. 기술 스택 (Tech Stack)
*   **Frontend:** React 19, TypeScript, Tailwind CSS
*   **AI Model:** Google Gemini API (`@google/genai`)
    *   Vision/Text: `gemini-2.5-flash`
    *   Image Generation: `gemini-2.5-flash-image`
*   **Backend / DB:** Google Apps Script (GAS), Google Sheets, Google Drive
    *   별도의 백엔드 서버 없이 GAS를 Web App으로 배포하여 REST API처럼 사용
*   **Utils:** Lucide React (Icons), JSZip (압축 다운로드), FileSaver

---

## 3. 프로젝트 구조 (File Structure)

```text
/
├── index.html              # Entry point (Tailwind CDN 포함)
├── index.tsx               # React Root Mount
├── App.tsx                 # Main Component & Step Management State
├── types.ts                # TypeScript Interfaces (ProductAnalysis, SectionData, UploadedFile 등)
├── metadata.json           # 앱 메타데이터
├── PROJECT_README.md       # 프로젝트 설명서 (본 파일)
│
├── components/             # UI 컴포넌트
│   ├── StepModeSelection.tsx # 모드 선택 (생성 vs 현지화)
│   ├── StepUpload.tsx        # 다중 파일 업로드, 드래그앤드롭, 미리보기 UI
│   ├── StepAnalysis.tsx      # AI 분석 결과 수정, 섹션 추가/삭제/순서변경
│   ├── StepResult.tsx        # 최종 렌더링, HTML/ZIP 다운로드, 시트 내보내기
│   └── SettingsModal.tsx     # GAS URL 설정, 템플릿 관리(추가/수정/삭제)
│
└── services/               # 비즈니스 로직
    ├── geminiService.ts      # Gemini API 호출 (이미지 분석, 텍스트 생성, 이미지 생성)
    ├── googleSheetService.ts # Google Sheets/Drive 연동 (GAS 통신, Fallback 로직)
    └── templateService.ts    # 템플릿 LocalStorage CRUD 관리
```

---

## 4. 핵심 데이터 구조 및 로직

### 4.1. 다중 이미지 분석 (Multi-turn Vision)
*   **파일:** `services/geminiService.ts` -> `analyzeProductImage`
*   **로직:** 사용자가 업로드한 여러 장의 이미지를 `base64` 배열로 변환하여 Gemini에 `contents.parts`로 한 번에 전송합니다. 이를 통해 정면, 측면, 후면 등 다양한 각도를 종합적으로 분석하여 정확도를 높입니다.

### 4.2. 섹션 기반 상세페이지 구조 (`ProductAnalysis`)
AI 분석 결과는 아래와 같은 JSON 구조로 관리됩니다.
```typescript
interface ProductAnalysis {
  productName: string;
  mainFeatures: string[];
  marketingCopy: string; // 헤드라인/인트로 카피
  sections: {
    id: string;
    title: string;
    content: string;     // 섹션 본문
    imagePrompt: string; // 이미지 생성을 위한 영문 프롬프트
    imageUrl?: string;   // 생성된 이미지 URL (Base64)
  }[];
}
```

### 4.3. Google Sheets 및 Drive 연동 (GAS)
*   **파일:** `services/googleSheetService.ts`
*   **로직:**
    1.  프론트엔드에서 데이터를 JSON으로 직렬화하여 GAS Web App URL로 `POST` 요청을 보냅니다.
    2.  **Fallback 로직:** 이미지 용량이 커서 전송 실패(`Failed to fetch`) 시, 자동으로 이미지를 제외한 텍스트 데이터만 다시 전송하여 데이터 유실을 방지합니다.
    3.  **GAS 코드 (`GOOGLE_APPS_SCRIPT_CODE.js`):** 받은 데이터를 파싱하여 시트에 행을 추가하고, Base64 이미지를 디코딩하여 구글 드라이브 폴더에 저장합니다.

### 4.4. 템플릿 시스템
*   이미지(스크린샷)를 업로드하면 AI가 레이아웃 구조(섹션 배치, 이미지 스타일)를 역설계하여 '템플릿'으로 저장합니다.
*   새 상품 생성 시 이 템플릿을 적용하면, 해당 구조에 맞춰 내용만 갈아끼우는 형태로 생성이 가능합니다.

---

## 5. 최근 작업 내역 (Recent Changes)

1.  **다중 파일 업로드 지원 (`StepUpload.tsx`, `App.tsx`)**
    *   기존 단일 파일 업로드에서 `multiple` 속성을 지원하도록 변경.
    *   미리보기 화면을 그리드(Grid) 형태로 개선하여 업로드된 모든 이미지를 확인/삭제 가능.
    *   `geminiService`가 이미지 배열을 받아 처리하도록 수정.

2.  **설정 저장 오류 수정 (`SettingsModal.tsx`)**
    *   Google Sheet ID 입력 시 조건부 저장 로직 제거 (항상 저장되도록 수정).
    *   공백 제거(`trim`) 및 자동완성 방지 적용.

3.  **GAS 전송 안정성 강화 (`googleSheetService.ts`)**
    *   대용량 이미지 전송 실패 시, 사용자에게 알림을 주고 텍스트 데이터만 백업 저장하는 Fallback 로직 구현.
    *   설정값이 없을 경우 `DEMO_SHEET_ID`를 명시적으로 반환하도록 수정.

4.  **이미지 재생성 로직 개선 (`StepResult.tsx`)**
    *   결과 화면에서 특정 섹션의 이미지만 다시 생성할 때, 업로드한 원본 이미지(첫 번째 파일)를 스타일 참조(Reference Image)로 사용하도록 수정.

---

## 6. 추가 개발 필요 사항 (Todo Suggestion)
*   **이미지 편집 기능:** 생성된 이미지에 텍스트 오버레이 추가 기능.
*   **PDF 내보내기:** HTML/ZIP 외에 PDF 포맷 지원.
*   **템플릿 고도화:** 섹션별 레이아웃(좌우 배치, 지그재그 등) 스타일 세분화.
*   **로그인/세션:** 현재는 LocalStorage 기반이나, Firebase 등을 연동하여 사용자별 데이터 관리.
