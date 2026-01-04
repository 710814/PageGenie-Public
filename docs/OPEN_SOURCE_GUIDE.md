# 📖 PageGenie 오픈소스 가이드 (Open Source Guide)

이 프로젝트를 다운로드 받아 자신의 환경에서 사용하시려면 아래 설정 과정을 거쳐야 합니다.
보안을 위해 **Back-end(Google Apps Script)**와 **API Key** 정보는 포함되어 있지 않으므로, 직접 생성 후 연결이 필요합니다.

---

## 🚀 1. 빠른 시작 (Quick Start)

### 1-1. 환경 변수 설정 (.env)
프로젝트 루트 경로에 `.env` 파일을 생성하고, 아래 내용을 복사하여 입력해 주세요.

```bash
# .env 파일 생성
VITE_DEFAULT_GAS_URL=여기에_여러분의_GAS_웹앱_URL을_입력하세요
VITE_GEMINI_API_KEY=여기에_여러분의_Gemini_API_키를_입력하세요
```

*   `VITE_DEFAULT_GAS_URL`: 아래 [2. 백엔드 설정] 단계에서 생성한 URL입니다.
*   `VITE_GEMINI_API_KEY`: Google AI Studio에서 발급받은 API 키입니다. (선택 사항 - GAS 서버에 설정해도 됨)

---

## 🛠️ 2. 백엔드(GAS) 배포 가이드

이 프로젝트는 **Serverless** 구조로, Google Sheets와 Apps Script를 백엔드 DB로 사용합니다.

1.  **새 구글 시트 생성**
    *   구글 드라이브에서 '새 스프레드시트'를 생성합니다.
    *   상단 메뉴 `확장기능` -> `Apps Script`를 클릭합니다.

2.  **코드 복사 및 붙여넣기**
    *   이 프로젝트의 `GOOGLE_APPS_SCRIPT_CODE.js` 파일 내용을 전체 복사합니다.
    *   새로 열린 Apps Script 편집기에 붙여넣고 저장합니다.

3.  **스크립트 속성(환경변수) 설정**
    *   좌측 사이드바 `⚙️ 프로젝트 설정` -> `스크립트 속성` 섹션으로 이동.
    *   `속성 추가` 클릭 후 다음 값 입력:
        *   **속성**: `GEMINI_API_KEY`
        *   **값**: [Google AI Studio](https://aistudio.google.com/)에서 발급받은 API Key

4.  **웹 앱으로 배포**
    *   우측 상단 `배포` -> `새 배포` 클릭.
    *   유형 선택 톱니바퀴 -> `웹 앱` 선택.
    *   **설명**: "v1 배포" (자유 입력)
    *   **다음 사용자 권한으로 실행**: `나(Me)` (중요!)
    *   **액세스 권한이 있는 사용자**: `모든 사용자(Everyone)` (중요! 프론트엔드에서 접속하기 위함)
    *   `배포` 버튼 클릭 -> 권한 승인 -> **웹 앱 URL 복사**

5.  **URL 연결**
    *   복사한 URL을 위 [1-1. 환경 변수 설정]의 `.env` 파일에 붙여넣으세요.
    *   또는 웹 서비스 실행 후 `설정(Settings)` 메뉴에서 직접 입력해도 됩니다.

---

## ✅ 3. 실행 방법 (Run)

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173` 으로 접속하면 실행됩니다.

---
**주의사항**: `.env` 파일에는 개인 API Key가 포함되므로 절대 GitHub 등 공개된 저장소에 업로드하지 마세요.
