# 🛒 PageGenie (AI 상품 페이지 자동 생성)

**PageGenie**는 Google Gemini API(Multimodal)를 활용하여 이커머스 상품 상세페이지를 자동으로 기획, 디자인, 생성 및 현지화하는 웹 애플리케이션입니다.



## 1. 프로젝트 개요

이 프로젝트는 React 기반의 단일 페이지 애플리케이션(SPA)으로, 별도의 백엔드 서버 없이 **Google Apps Script (GAS)**를 활용하여 Serverless 환경에서 동작합니다.

### 🎯 핵심 기능
1. **Mode A: 신규 생성 (Creation)**
   - 상품 사진을 업로드하면 AI가 특징을 분석하여 마케팅 문구 작성 및 섹션 기획.
   - 각 섹션에 적합한 고퀄리티 이미지를 AI가 생성.
2. **Mode B: 현지화 (Localization)**
   - 해외 상세페이지 스크린샷을 한국어 마케팅 문구로 변환.
   - 원본 레이아웃을 유지하며 텍스트만 자연스럽게 교체.

---

## 2. 시작하기 (Getting Started)

이 프로젝트를 로컬 환경에서 실행하기 위한 방법입니다.

### 사전 요구사항
*   Node.js (최신 LTS 버전 권장)
*   npm

### 설치 및 실행

1. **저장소 클론 (Clone)**
   ```bash
   git clone https://github.com/710814/PageGenie-Public.git
   cd PageGenie-Public
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **환경 변수 설정**
   루트 디렉토리에 `.env` 파일을 생성하고 Gemini API 키를 설정합니다. (GAS 프록시 사용 시 생략 가능하나 개발 편의를 위해 권장)
   ```bash
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

4. **개발 서버 실행**
   ```bash
   npm run dev
   ```

---

## 3. Google Apps Script (GAS) 설정

⚠️ **중요**: 이 앱은 이미지 저장 및 데이터 관리를 위해 Google Apps Script 설정이 필수입니다.

상세한 설정 방법은 **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** 파일을 참고해 주세요.

**간략 요약:**
1. Google Apps Script 프로젝트 생성.
2. `GOOGLE_APPS_SCRIPT_CODE.js` 내용 복사 & 붙여넣기.
3. 스크립트 속성에 `GEMINI_API_KEY` 등록.
4. 웹 앱으로 배포 ("나"로 실행, "모든 사용자" 액세스 허용).
5. 배포된 URL을 앱 설정 메뉴에 등록.

---

## 4. 기술 스택 (Tech Stack)

*   **Frontend**: React 19, TypeScript, Tailwind CSS
*   **AI**: Google Gemini API (`gemini-2.5-flash`)
*   **Backend**: Google Apps Script, Google Sheets, Google Drive
*   **Tools**: Lucide React, JSZip, FileSaver

---

## 5. 프로젝트 구조

```text
/
├── components/          # UI 컴포넌트 (업로드, 분석, 결과 화면 등)
├── services/            # 비즈니스 로직 (Gemini API, GAS 연동)
├── GOOGLE_APPS_SCRIPT_CODE.js  # GAS 배포용 코드
├── SETUP_GUIDE.md       # 상세 설정 가이드
└── ...
```
