/**
 * Gemini API 관련 타입 정의
 */

export interface GeminiInlineData {
  mimeType: string;
  data: string;
}

export interface GeminiTextPart {
  text: string;
}

export interface GeminiInlineDataPart {
  inlineData: GeminiInlineData;
}

export type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

export interface GeminiContent {
  parts: GeminiPart[];
}

export interface GeminiGenerationConfig {
  responseMimeType?: string;
  responseSchema?: any;
  temperature?: number;
  topK?: number;
  aspectRatio?: string;  // 이미지 생성 비율 (예: "3:4", "9:16", "1:1")
}

/**
 * Gemini API 안전 설정
 * 패션 모델 이미지 생성 시 과도한 필터링 방지
 */
export interface GeminiSafetySettings {
  category: string;
  threshold: string;
}

export interface GeminiRequest {
  contents: GeminiContent;
  generationConfig?: GeminiGenerationConfig;
  safetySettings?: GeminiSafetySettings[];
}

export interface GeminiCandidate {
  content: {
    parts: Array<{
      text?: string;
      inlineData?: GeminiInlineData;
    }>;
  };
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

