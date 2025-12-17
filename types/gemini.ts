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
}

export interface GeminiRequest {
  contents: GeminiContent;
  generationConfig?: GeminiGenerationConfig;
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

