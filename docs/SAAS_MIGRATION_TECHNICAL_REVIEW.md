# SaaS 서비스 개편을 위한 기술 검토 보고서

본 문서는 **PageGenie-KDH (OnePicAI)** 프로젝트를 SaaS 기반 서비스로 전환하기 위해, 현재 시스템의 아키텍처, 데이터 구조, 비즈니스 로직을 상세히 분석하여 정리한 기술 자료입니다.

---

## 1. 시스템 개요 및 아키텍처

현재 시스템은 **Serverless 형태의 Client-Side 중심 웹 애플리케이션**으로, Google의 생태계(Gemini, Apps Script, Sheets, Drive)를 백엔드 및 데이터베이스 대용으로 활용하고 있습니다.

### 1.1 현재 아키텍처 (AS-IS)

```mermaid
graph TD
    User[Client Browser]
    
    subgraph "Frontend (Vite/React)"
        UI[User Interface]
        Logic[Business Logic]
        State[Local Storage]
    end
    
    subgraph "Backend Proxy (Google Apps Script)"
        GAS[GAS Web App]
        Auth[Implicit Auth (Script URL)]
    end
    
    subgraph "External Integration"
        Gemini[Google Gemini API]
        GSheet[Google Sheets (DB)]
        GDrive[Google Drive (Storage)]
    end

    User --> UI
    UI --> Logic
    Logic -- "Settings (URL/ID)" --> State
    Logic -- "API Calls (Proxy)" --> GAS
    GAS -- "Analysis/Gen" --> Gemini
    GAS -- "Log/Save Data" --> GSheet
    GAS -- "Save Images/HTML" --> GDrive
```

### 1.2 기술 스택 (Tech Stack)

| 구분 | 기술/도구 | 상세 내용 |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19, Vite 6 | 최신 리액트 및 빌드 도구 사용 |
| **Language** | TypeScript (~5.8) | 정적 타입 시스템 적용 |
| **Styling** | TailwindCSS 3.4 | 유틸리티 퍼스트 CSS 프레임워크 |
| **AI Engine** | Google Generative AI | `gemini-2.5-flash` (Vision/Text), `gemini-2.5-flash-image` (Image Gen) |
| **Backend / Proxy** | Google Apps Script (GAS) | CORS 회피, API Key 은닉, Google 서비스 연동을 위한 미들웨어 |
| **Database** | Google Sheets | 데이터 영구 저장 (Row 기반 레코드) |
| **Storage** | Google Drive | 생성된 이미지 및 HTML 파일 저장 |
| **State Management** | React Context API | 전역 상태 관리 |
| **Persistence** | Browser LocalStorage | 사용자 설정(GAS URL, Sheet ID) 및 임시 상태 저장 |

---

## 2. 데이터베이스 스키마 및 데이터 모델

현재 정식 RDBMS를 사용하지 않으나, 어플리케이션 내부에서 사용하는 데이터 모델(TypeScript Interface)과 Google Sheets에 저장되는 데이터 구조가 그 역할을 대신하고 있습니다. SaaS 전환 시 이 구조를 RDBMS(PostgreSQL 등)로 마이그레이션 해야 합니다.

### 2.1 핵심 데이터 모델 (Logical Schema)

SaaS DB 설계 시 `Projects`, `Products`, `Sections`, `Images` 테이블로 정규화될 핵심 객체들입니다.

#### A. ProductAnalysis (메인 프로젝트 객체)
상세페이지 생성의 단위가 되는 핵심 객체입니다.

```typescript
interface ProductAnalysis {
  productName: string;               // 상품명
  detectedCategory: string;          // AI가 감지한 카테고리
  productVisualDescription: string;  // AI가 분석한 시각적 특징 (이미지 생성 프롬프트용)
  mainFeatures: string[];            // 주요 특징 3-5개
  marketingCopy: string;             // 마케팅 문구
  sections: SectionData[];           // 하위 섹션 배열 (1:N 관계)
  showIntroSection: boolean;         // 인트로 표시 여부
}
```

#### B. SectionData (상세페이지 섹션)
페이지를 구성하는 블록 단위입니다.

```typescript
interface SectionData {
  id: string;                        // UUID or Unique ID
  title: string;                     // 섹션 제목
  content: string;                   // 섹션 본문
  sectionType: string;               // 역할 (hero, detail, spec, etc.)
  layoutType: string;                // 레이아웃 (full-width, grid-2, collage-2x2, etc.)
  imagePrompt: string;               // 이 섹션의 AI 이미지 생성 프롬프트
  imageSlots: ImageSlot[];           // 포함된 이미지들 (1:N 관계)
  
  // 고정(User defined) 데이터
  fixedText?: string;
  fixedImageBase64?: string;
  useFixedImage: boolean;
}
```

#### C. ImageSlot (이미지 자산)
섹션 내에 배치되는 개별 이미지 단위입니다.

```typescript
interface ImageSlot {
  id: string;
  slotType: string;                  // 이미지 유형 (product, model_wear, detail, etc.)
  prompt: string;                    // 개별 이미지 프롬프트
  imageUrl?: string;                 // 생성된 이미지 URL (CDN/Storage Path)
  photographyStyle?: string;         // 촬영 스타일 메타데이터
}
```

#### D. ProductInputData (입력 소스 데이터)
사용자가 처음에 업로드하는 원본 데이터입니다.

```typescript
interface ProductInputData {
  productName?: string;
  colorOptions: ColorOption[];       // 컬러별 원본 이미지 그룹
  mainImages: UploadedFile[];        // 공통 원본 이미지
  modelSettings?: ModelSettings;     // 선호 모델 설정 (인종, 나이, 성별)
  selectedTemplateId?: string;       // 선택한 템플릿
}
```

### 2.2 저장소 데이터 구조 (Physical Schema - Google Sheets)

현재 Google Sheets에 저장되는 Row 데이터 구조입니다. `SheetRowData` 인터페이스에 정의되어 있습니다.

| 컬럼명 | 데이터 타입 | 설명 |
| :--- | :--- | :--- |
| `timestamp` | String (Date) | 생성 일시 |
| `mode` | String | 실행 모드 (Creation/Localization) |
| `productName` | String | 상품명 |
| `category` | String | 카테고리 |
| `features` | String (CSV-like) | 주요 특징 목록 |
| `marketingCopy` | String | 마케팅 카피 |
| `sectionCount` | Number | 생성된 섹션 수 |
| `sections_summary` | String (Text) | 섹션 내용 요약 텍스트 |
| `image_prompts` | String (Text) | 사용된 프롬프트 모음 |

---

## 3. 주요 기능 및 비즈니스 로직

SaaS 백엔드 이관 시 구현해야 할 핵심 비즈니스 로직입니다.

### 3.1 이미지 일관성 유지 (Consistency System)
가장 중요한 핵심 기술로, AI가 생성하는 이미지가 원본 상품과 동일해 보이도록 강제하는 로직입니다.
- **Reference**: 원본 이미지를 Gemini의 멀티모달 프롬프트로 주입합니다.
- **Visual Description**: Step 2에서 AI가 상품의 시각적 특징(텍스처, 로고, 봉제선 등)을 텍스트로 **상세하게 추출**하여 `productVisualDescription`에 저장하고, 이를 모든 이미지 생성 프롬프트에 `[PRODUCT]` 변수로 주입합니다.
- **Implicit Prompting**: `buildProductConsistentPrompt` 함수가 모든 프롬프트 뒤에 "CRITICAL: MAINTAIN EXACT PRODUCT VISUAL CONSISTENCY" 지침을 자동으로 부착합니다.

### 3.2 템플릿 엔진 로직
단순 생성이 아니라, 미리 정의된 구조(Template)에 내용을 채워 넣는 방식입니다.
- **Mapping**: `applyTemplateStructure` 함수가 핵심입니다. AI가 분석한 결과를 템플릿의 섹션 ID와 매칭하여 병합합니다.
- **Dynamic Slotting**: 레이아웃 타입(`layoutType`)에 따라 필요한 이미지 슬롯 수(`imageSlots`)를 동적으로 계산하고 생성합니다. (예: `grid-3` 레이아웃이면 자동으로 3개의 디테일 컷 프롬프트를 생성)

### 3.3 로컬라이제이션 및 모드
- **Mode A (Creation)**: 이미지 -> 분석 -> 아예 새로운 기획안 및 이미지 생성
- **Mode B (Localization)**: (코드상 존재) 기존 이미지를 바탕으로 번역 및 현지화에 초점

### 3.4 콜라주 생성 시스템
단일 이미지 생성이 아닌, AI에게 레이아웃 가이드를 주어 한 장의 이미지 안에 여러 컷(앞, 뒤, 디테일)이 배치된 **콜라주 이미지**를 생성하게 하는 로직이 포함되어 있습니다.
- 정의된 레이아웃: `collage-1-2`, `collage-2-1`, `collage-2x2`

---

## 4. SaaS 전환 시 기술적 고려사항

현재 시스템을 상용 SaaS로 전환하기 위해 해결해야 할 과제입니다.

### 4.1 인프라 및 백엔드
- **Database 도입**: Google Sheets를 **PostgreSQL (Supabase/AWS RDS)** 등으로 교체해야 합니다. 
  - `Users`, `Organizations`, `Projects`, `Templates`, `Assets` 테이블 필요.
- **Storage 교체**: Google Drive는 대용량 트래픽에 부적합하므로 **AWS S3** 또는 **Cloudflare R2**로 교체해야 합니다.
- **Backend API**: 현재 GAS의 역할을 수행할 **Node.js (NestJS or Express) / Python (FastAPI)** 서버가 필요합니다. 
  - API Key 관리, Rate Limiting, User Authentication 처리 필요.

### 4.2 인증 및 권한 (Auth)
- 현재는 인증이 없습니다 (누구나 URL만 알면 접근).
- **OAuth 2.0 / JWT** 기반 인증 도입 필요 (Firebase Auth, Auth0, Supabase Auth 등 권장).

### 4.3 AI 비용 및 최적화
- 현재: 사용자의 개인 Google Gemini API Key 또는 GAS의 Quota 사용.
- SaaS: **Centralized API Key** 사용 필요.
  - 사용자별 Token Usage 추적 및 **Credit/Billing 시스템** 구현 필수.
  - Image Gen Model(`gemini-2.5-flash-image`) 호출 비용 최적화 필요.

### 4.4 성능 및 UX
- **비동기 처리**: 이미지 생성은 오래 걸리므로(장당 10~30초), 현재의 클라이언트 대기 방식에서 **Server-Side Queue (BullMQ, Redis)** + **WebSocket/Polling** 방식으로 변경하여 사용자가 브라우저를 닫아도 작업이 진행되도록 개선해야 합니다.

### 4.5 보안
- 현재 클라이언트 코드에 AI 로직이 많이 노출되어 있습니다. 프롬프트 엔지니어링 자산을 보호하기 위해 **Prompt Construction 로직을 서버로 이동**시켜야 합니다.
