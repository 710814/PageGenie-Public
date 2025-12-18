export enum AppMode {
  CREATION = 'CREATION', // Mode A: New Creation from Image
  LOCALIZATION = 'LOCALIZATION', // Mode B: Localization/Reconstruction
}

export enum Step {
  SELECT_MODE = 0,
  UPLOAD_DATA = 1,
  ANALYSIS_REVIEW = 2,
  GENERATING = 3,
  RESULT = 4,
}

export interface SectionData {
  id: string;
  title: string;
  content: string;
  imagePrompt: string; // Prompt used/to be used for image generation
  imageUrl?: string; // Generated or Original Image URL
  isOriginalImage?: boolean; // Whether to keep original or generate new
  isPreview?: boolean; // 미리보기로 생성된 이미지인지 여부
  
  // 템플릿 고정 요소 (Template Fixed Elements)
  fixedText?: string; // 항상 포함될 고정 문구 (예: "100% 국내산", 인증문구 등)
  fixedImageBase64?: string; // 고정 이미지 Base64 데이터 (로고, 인증마크 등)
  fixedImageMimeType?: string; // 고정 이미지 MIME 타입
  useFixedImage?: boolean; // 고정 이미지 사용 여부 (true: 고정 이미지 사용, false: AI 생성)
  
  // 레이아웃 정보 (선택적)
  layoutType?: 'full-width' | 'split-left' | 'split-right' | 'grid-2' | 'grid-3' | 'text-only' | 'image-only';
}

export interface ProductAnalysis {
  productName: string;
  mainFeatures: string[];
  marketingCopy: string;
  sections: SectionData[];
  detectedCategory?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  sections: SectionData[]; // The structural blueprint
  createdAt: number;
}

export interface UploadedFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}