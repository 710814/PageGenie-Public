export enum AppMode {
  CREATION = 'CREATION', // Mode A: New Creation from Image
  LOCALIZATION = 'LOCALIZATION', // Mode B: Localization/Reconstruction
  IMAGE_EDIT = 'IMAGE_EDIT', // Mode C: Single Image Edit (Translate/Remove Text)
}

export enum Step {
  SELECT_MODE = 0,
  UPLOAD_DATA = 1,
  ANALYSIS_REVIEW = 2,
  GENERATING = 3,
  RESULT = 4,
}

// ============================================
// 템플릿 시스템 타입 (Template System Types)
// ============================================

/**
 * 섹션 타입 - 섹션의 역할/목적을 정의
 */
export type SectionType =
  | 'title'           // 타이틀/상품명
  | 'hero'            // 메인 비주얼
  | 'description'     // 상품 설명
  | 'colors'          // 색상 옵션
  | 'material_detail' // 소재 상세
  | 'styling'         // 스타일링 제안
  | 'fit'             // 핏/사이즈
  | 'spec'            // 스펙/사양
  | 'notice'          // 안내/주의사항
  | 'custom';         // 사용자 정의

/**
 * 이미지 슬롯 타입 - 이미지의 유형/목적을 정의
 */
export type ImageSlotType =
  | 'hero'            // 대표 이미지
  | 'product'         // 상품 이미지
  | 'detail'          // 디테일 클로즈업
  | 'material'        // 소재/텍스처
  | 'color_styling'   // 색상/스타일링
  | 'fit'             // 착용/핏
  | 'spec'            // 스펙 도표
  | 'notice'          // 안내 이미지
  | 'custom';         // 사용자 정의

/**
 * 레이아웃 타입
 */
export type LayoutType =
  | 'full-width'      // 전체 너비 이미지
  | 'split-left'      // 좌측 이미지 + 우측 텍스트
  | 'split-right'     // 우측 이미지 + 좌측 텍스트
  | 'grid-2'          // 2열 그리드
  | 'grid-3'          // 3열 그리드
  | 'text-only'       // 텍스트만
  | 'image-only';     // 이미지만

/**
 * 이미지 슬롯 - 섹션 내 개별 이미지 정보
 */
export interface ImageSlot {
  id: string;
  slotType: ImageSlotType;          // 이미지 유형
  prompt: string;                    // AI 이미지 생성 프롬프트
  imageUrl?: string;                 // 생성된 이미지 URL (일관성 위해 추가)
  generatedImageUrl?: string;        // 생성된 이미지 URL (deprecated, use imageUrl)
  fixedImageBase64?: string;         // 고정 이미지 (Base64)
  fixedImageMimeType?: string;       // 고정 이미지 MIME 타입
  useFixedImage?: boolean;           // 고정 이미지 사용 여부
}

/**
 * 섹션 데이터 - 상세페이지의 각 섹션 정보
 */
export interface SectionData {
  id: string;
  title: string;
  content: string;

  // ★ 새로운 템플릿 구조
  sectionType?: SectionType;         // 섹션 타입
  imageSlots?: ImageSlot[];          // 다중 이미지 슬롯
  layoutType?: LayoutType;           // 레이아웃 타입

  // === 기존 필드 (하위 호환성 유지) ===
  imagePrompt: string;               // 기존 단일 프롬프트
  imageUrl?: string;                 // 생성된/원본 이미지 URL
  isOriginalImage?: boolean;         // 원본 이미지 유지 여부
  isPreview?: boolean;               // 미리보기 이미지 여부

  // 템플릿 고정 요소 (기존)
  fixedText?: string;                // 고정 문구
  fixedImageBase64?: string;         // 고정 이미지 Base64
  fixedImageMimeType?: string;       // 고정 이미지 MIME
  useFixedImage?: boolean;           // 고정 이미지 사용 여부
}

export interface ProductAnalysis {
  productName: string;
  mainFeatures: string[];
  marketingCopy: string;
  sections: SectionData[];
  detectedCategory?: string;
}

/**
 * 템플릿 - 재사용 가능한 상세페이지 구조
 */
export interface Template {
  id: string;
  name: string;
  description?: string;
  sections: SectionData[];           // 섹션 구조
  createdAt: number;

  // ★ 새로운 필드
  category?: string;                 // 템플릿 카테고리 (fashion, beauty 등)
  sourceImageThumbnail?: string;     // 원본 참조 이미지 썸네일 (선택)
}

export interface UploadedFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

/**
 * 컬러 옵션 - 색상별 상품 이미지 그룹
 */
export interface ColorOption {
  id: string;
  colorName: string;           // 색상명 (예: "와인", "베이지", "그레이")
  hexCode?: string;            // 색상 코드 (선택, 예: "#8B0000")
  images: UploadedFile[];      // 해당 색상의 상품 이미지들
}

/**
 * 첫 단계에서 수집하는 상품 기본 정보
 * - 모든 필드 선택사항 (기존 이미지만 업로드도 가능)
 */
export interface ProductInputData {
  productName?: string;        // 상품명 (선택)
  price?: number;              // 가격 (선택)
  discountRate?: number;       // 할인율 % (선택)
  productFeatures?: string;    // 상품 특징 (선택) - 줄바꿈으로 구분
  colorOptions: ColorOption[]; // 컬러별 이미지 (선택)
  mainImages: UploadedFile[];  // 컬러 구분 없는 메인 이미지
  selectedTemplateId?: string; // 선택된 템플릿 ID
}