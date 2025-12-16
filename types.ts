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