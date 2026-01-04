# 🔧 프로젝트 설정 정보

## Google Apps Script 프로젝트

- **프로젝트 ID**: `YOUR_PROJECT_ID_HERE`
- **프로젝트 편집 URL**: https://script.google.com/home/projects/YOUR_PROJECT_ID_HERE/edit

## Google Sheet

- **Sheet URL**: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
- **Sheet ID**: `YOUR_SHEET_ID_HERE`

---

## ✅ 해야 할 작업

### 1단계: Apps Script 코드 업데이트

1. [프로젝트 편집 페이지](https://script.google.com/home/projects/YOUR_PROJECT_ID_HERE/edit) 접속
2. `Code.gs` 파일 열기
3. `GOOGLE_APPS_SCRIPT_CODE.js` 파일의 **전체 내용**을 복사
4. `Code.gs`의 기존 내용을 모두 삭제하고 붙여넣기
5. **저장** (Ctrl+S 또는 Cmd+S)

### 2단계: API 키 설정 (중요!)

1. 왼쪽 메뉴에서 **"프로젝트 설정"** (톱니바퀴 아이콘) 클릭
2. **"스크립트 속성"** 섹션으로 스크롤
3. 기존 속성이 있다면 확인, 없다면 **"스크립트 속성 추가"** 클릭
4. 다음 정보 입력:
   - **속성**: `GEMINI_API_KEY`
   - **값**: [Google AI Studio](https://makersuite.google.com/app/apikey)에서 발급받은 Gemini API 키
5. **저장** 클릭

### 3단계: 웹 앱 배포 (또는 기존 배포 업데이트)

#### 새로 배포하는 경우:
1. 상단 메뉴에서 **"배포"** → **"새 배포"** 클릭
2. **"유형 선택"** 옆의 톱니바퀴 아이콘 클릭
3. **"웹 앱"** 선택
4. 배포 설정:
   - **설명**: "PageGenie API Proxy" (선택사항)
   - **실행 대상**: **"나"** ⚠️ 중요: 반드시 "나"로 설정해야 Google Sheets/Drive 접근 가능
   - **액세스 권한**: "모든 사용자"
5. **"배포"** 클릭
6. **권한 승인** (필요시):
   - 권한 승인 팝업이 나타나면 다음 권한을 확인:
     - ✅ Google Sheets 접근 권한
     - ✅ Google Drive 접근 권한 (파일 생성/수정)
     - ✅ 외부 API 호출 권한
   - **"허용"** 클릭
7. **웹 앱 URL 복사** (예: `https://script.google.com/macros/s/AKfycb.../exec`)

#### 권한 테스트 (권장):
배포 후 권한이 제대로 설정되었는지 확인:
1. GAS 편집기에서 함수 선택 드롭다운에서 **`testPermissions`** 선택
2. 실행 버튼(▶️) 클릭
3. 권한 승인 팝업이 나타나면 "허용" 클릭
4. 실행 로그에서 다음 확인:
   - ✅ 외부 API 호출 권한 승인 완료
   - ✅ Google Sheets 권한 승인 완료
   - ✅ Google Drive 권한 승인 완료

#### 기존 배포를 업데이트하는 경우:
1. 상단 메뉴에서 **"배포"** → **"배포 관리"** 클릭
2. 기존 배포 옆의 **연필 아이콘** (편집) 클릭
3. **"새 버전"** 선택
4. **"배포"** 클릭
5. 웹 앱 URL 확인 (변경되지 않음)

### 4단계: 애플리케이션 설정

1. 애플리케이션 실행 (`npm run dev`)
2. 우측 상단의 **설정 아이콘** (⚙️) 클릭
3. **"구글 시트 연동"** 탭 선택
4. 다음 정보 입력:
   - **Google Apps Script (GAS) Web App URL**: 
     - 3단계에서 복사한 웹 앱 URL 붙여넣기
     - 예: `https://script.google.com/macros/s/AKfycb.../exec`
   - **Google Sheet ID**: 
     - `YOUR_SHEET_ID_HERE` (자신의 Google Sheet ID로 교체하세요)
5. **"설정 저장하기"** 클릭
6. 성공 메시지 확인

---

## 🔍 확인 사항

### Apps Script 프로젝트 확인
- [ ] `Code.gs`에 최신 코드가 업데이트되었는지 확인
- [ ] 스크립트 속성에 `GEMINI_API_KEY`가 설정되었는지 확인
- [ ] 웹 앱이 배포되어 있고 URL을 복사했는지 확인

### 애플리케이션 설정 확인
- [ ] GAS Web App URL이 올바르게 입력되었는지 확인
- [ ] Google Sheet ID가 올바르게 입력되었는지 확인
- [ ] 설정 저장 후 Toast 알림이 표시되는지 확인

### 테스트
- [ ] 이미지 업로드 테스트
- [ ] AI 분석 테스트
- [ ] 상세페이지 생성 테스트
- [ ] Google Sheet 저장 테스트 (선택사항)

---

## 🚨 문제 해결

### API 키 오류가 발생하는 경우
1. Apps Script 프로젝트 설정에서 `GEMINI_API_KEY` 속성 확인
2. API 키가 올바른지 확인 (Google AI Studio에서 발급)
3. Apps Script 프로젝트를 저장했는지 확인

### 웹 앱 URL을 찾을 수 없는 경우
1. "배포" → "배포 관리"에서 확인
2. 기존 배포가 없다면 새로 배포
3. 배포 후 표시되는 URL을 복사

### Sheet 저장이 안 되는 경우
1. Sheet ID가 올바른지 확인
2. Apps Script에 Sheet 접근 권한이 있는지 확인:
   - GAS 편집기에서 `testSheetsPermission()` 함수 실행
   - 권한 승인 팝업이 나타나면 "허용" 클릭
   - 해당 Google Sheet에 대한 접근 권한이 있는지 확인
3. GAS 코드가 최신 버전인지 확인
4. 배포 시 "실행 대상"이 **"나"**로 설정되었는지 확인

### Drive 저장이 안 되는 경우
1. Google Drive 접근 권한 확인:
   - GAS 편집기에서 `testDrivePermission()` 함수 실행
   - 권한 승인 팝업이 나타나면 "허용" 클릭
2. 배포 시 "실행 대상"이 **"나"**로 설정되었는지 확인
3. Google Drive 저장 공간이 충분한지 확인

---

## 📝 참고 정보

- **Apps Script 프로젝트 편집**: https://script.google.com/home/projects/YOUR_PROJECT_ID_HERE/edit
- **Google Sheet**: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
- **Google AI Studio (API 키 발급)**: https://makersuite.google.com/app/apikey

