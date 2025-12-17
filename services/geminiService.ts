import { AppMode, ProductAnalysis, SectionData, Template } from "../types";
import { getGasUrl, DEFAULT_GAS_URL } from "./googleSheetService";
import type {
  GeminiRequest,
  GeminiResponse,
  GeminiPart,
  GeminiInlineDataPart,
  GeminiTextPart,
  GeminiGenerationConfig
} from "../types/gemini";

// 보안 강화: API 키는 GAS 프록시를 통해 서버 사이드에서만 사용
// 클라이언트에서는 직접 API 키를 사용하지 않음

const MODEL_TEXT_VISION = 'gemini-2.5-flash';
const MODEL_IMAGE_GEN = 'gemini-2.5-flash-image';

/**
 * URL 정규화 함수 - 비교를 위해 모든 공백, 언더스코어, 하이픈 제거
 */
function normalizeUrlForComparison(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '') // 모든 공백 제거
    .replace(/_/g, '') // 언더스코어 제거
    .replace(/-/g, '') // 하이픈 제거
    .replace(/\/+/g, '/') // 연속된 슬래시 정규화
    .replace(/\/$/, ''); // 끝의 슬래시 제거
}

/**
 * GAS 프록시를 통해 Gemini API 호출
 */
async function callGeminiViaProxy(requestData: {
  model: string;
  contents: GeminiRequest['contents'];
  config?: GeminiGenerationConfig;
}): Promise<GeminiResponse> {
  const gasUrl = getGasUrl(true);
  
  if (!gasUrl) {
    throw new Error('GAS URL이 설정되지 않았습니다. 설정에서 Google Apps Script URL을 입력하세요.');
  }

  // GAS 프록시 엔드포인트로 요청
  // GAS는 URL 파라미터로 action을 받음
  const proxyUrl = `${gasUrl}?action=gemini`;
  
  try {
    console.log('GAS 프록시 호출:', proxyUrl);
    console.log('요청 데이터:', { model: requestData.model, hasContents: !!requestData.contents });
    
    // GAS는 CORS preflight를 처리하지 않으므로 simple request로 보냄
    // Content-Type: text/plain으로 변경하면 preflight 없이 요청 가능
    // GAS는 여전히 e.postData.contents로 JSON을 파싱할 수 있음
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        model: requestData.model,
        contents: requestData.contents,
        config: requestData.config
      }),
      redirect: 'follow' // GAS 리다이렉트 따라가기
    });

    console.log('GAS 프록시 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GAS 프록시 오류 응답:', errorText);
      throw new Error(`GAS 프록시 오류 (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('GAS 프록시 응답:', result);
    
    if (result.status === 'error') {
      throw new Error(result.message || 'GAS 프록시에서 오류가 발생했습니다.');
    }
    
    if (!result.data) {
      throw new Error('GAS 프록시 응답에 데이터가 없습니다.');
    }
    
    return result.data as GeminiResponse;
  } catch (error) {
    console.error('GAS 프록시 호출 실패:', error);
    throw error;
  }
} 

/**
 * Helper to convert Blob/File to Base64 string without data prefix
 */
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data:image/png;base64, prefix
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Schema for the product analysis output (JSON Schema format for Gemini API)
 */
const productAnalysisSchema = {
  type: "object",
  properties: {
    productName: { type: "string", description: "Suggested product name in Korean" },
    detectedCategory: { type: "string", description: "Product category" },
    mainFeatures: {
      type: "array",
      items: { type: "string" },
      description: "List of 3-5 key features in Korean"
    },
    marketingCopy: { type: "string", description: "Persuasive marketing intro copy (2-3 sentences) in Korean" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string", description: "Section header in Korean" },
          content: { type: "string", description: "Detailed section body text in Korean" },
          imagePrompt: { type: "string", description: "Prompt to generate an image for this section (in English)" },
        },
        required: ["id", "title", "content", "imagePrompt"]
      }
    }
  },
  required: ["productName", "mainFeatures", "marketingCopy", "sections"]
};

/**
 * Extract template structure from a reference image
 */
export const extractTemplateFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<Template> => {
  const prompt = `
    Analyze this product detail page image to create a reusable template.
    1. Identify the structural flow (Layout).
    2. Break it down into logical sections (e.g., Intro, Problems, Solution, Certifications, Reviews, FAQ).
    3. For each section, provide a generic 'title' (e.g., "Main Feature 1", "User Reviews") and a 'content' description describing what kind of text usually goes here.
    4. Crucially, provide an 'imagePrompt' that describes the visual style and composition of that section (e.g., "A grid layout showing 3 color variations", "Close up of texture").
    
    Output strictly in JSON format.
  `;

  try {
    // GAS 프록시를 통한 호출 시도
    const gasUrl = getGasUrl(true);
    
    // localStorage에 실제로 저장된 값 확인 (디버깅)
    const rawSavedUrl = localStorage.getItem('gemini_commerce_gas_url');
    console.log('[Template Extract] localStorage 원본 값:', rawSavedUrl);
    console.log('[Template Extract] getGasUrl() 결과:', gasUrl);
    console.log('[Template Extract] DEFAULT_GAS_URL:', DEFAULT_GAS_URL);
    
    // URL 정규화 비교
    const normalizedGasUrl = gasUrl ? normalizeUrlForComparison(gasUrl) : '';
    const normalizedDefaultUrl = normalizeUrlForComparison(DEFAULT_GAS_URL);
    const isDefaultUrl = normalizedGasUrl === normalizedDefaultUrl;
    console.log('[Template Extract] 정규화된 사용자 URL:', normalizedGasUrl);
    console.log('[Template Extract] 정규화된 기본 URL:', normalizedDefaultUrl);
    console.log('[Template Extract] 기본 URL과 비교 (정규화 후):', isDefaultUrl);
    
    // GAS URL이 설정되어 있고 기본 데모 URL이 아니면 프록시 사용
    if (gasUrl && gasUrl.trim() !== '' && !isDefaultUrl) {
      // GAS 프록시 사용
      const result = await callGeminiViaProxy({
        model: MODEL_TEXT_VISION,
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Image } } as GeminiInlineDataPart,
            { text: prompt } as GeminiTextPart
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: productAnalysisSchema,
          temperature: 0.2,
        }
      });
      
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No response from Gemini");
      
      const analysis = JSON.parse(text) as ProductAnalysis;
      
      return {
        id: `tpl-${Date.now()}`,
        name: analysis.productName || "새 템플릿",
        description: analysis.marketingCopy || "이미지에서 추출된 템플릿",
        sections: analysis.sections,
        createdAt: Date.now()
      };
    }
    
    // GAS 프록시가 없으면 환경 변수에서 API 키 확인 (Fallback)
    const apiKey = (window as any).__GEMINI_API_KEY__ || 
                   (import.meta.env?.VITE_GEMINI_API_KEY as string);
    
    if (!apiKey) {
      throw new Error(
        'Gemini API 키가 설정되지 않았습니다.\n\n' +
        '방법 1: GAS 프록시 사용 (권장)\n' +
        '  - Google Apps Script에 GEMINI_API_KEY를 스크립트 속성으로 설정\n' +
        '  - GAS Web App URL을 설정에 입력\n\n' +
        '방법 2: 환경 변수 사용\n' +
        '  - .env 파일에 VITE_GEMINI_API_KEY=your_key 추가'
      );
    }

    // 직접 API 호출 (Fallback)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TEXT_VISION}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: {
            parts: [
              { inlineData: { mimeType, data: base64Image } },
              { text: prompt }
            ]
          },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: productAnalysisSchema,
            temperature: 0.2,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini API 오류: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("No response from Gemini");
    
    const analysis = JSON.parse(text) as ProductAnalysis;
    
    return {
      id: `tpl-${Date.now()}`,
      name: analysis.productName || "새 템플릿",
      description: analysis.marketingCopy || "이미지에서 추출된 템플릿",
      sections: analysis.sections,
      createdAt: Date.now()
    };
  } catch (error) {
    console.error("Template extraction failed:", error);
    throw error;
  }
};

/**
 * Analyze image(s) and generate product details and section structure
 * Updated to accept multiple images
 */
export const analyzeProductImage = async (
  base64Images: string[],
  mimeTypes: string[],
  mode: AppMode,
  template?: Template | null
): Promise<ProductAnalysis> => {
  
  let prompt = "";
  
  if (template) {
    // TEMPLATE MODE
    const templateStructure = JSON.stringify(template.sections.map(s => ({
      title: s.title,
      description_of_content_needed: s.content,
      visual_style: s.imagePrompt
    })));

    prompt = `
      You are an expert e-commerce merchandiser.
      I have a specific "Winning Layout Template" that I want to apply to a new product.
      
      Input Image(s): Photos of the product to sell.
      Target Template Structure: ${templateStructure}
      
      Tasks:
      1. Analyze ALL input images to fully understand the product (front, back, details, etc.).
      2. Fill in the "Target Template Structure" with content specific to this product.
      3. For each section in the template:
         - Keep the original structural intent.
         - Write persuasive Korean content for 'title' and 'content'.
         - Refine the 'imagePrompt' to combine the Template's Visual Style with the Input Product's visual details found in the images.
    `;
  } else if (mode === AppMode.CREATION) {
    prompt = `
      You are an expert e-commerce merchandiser. 
      Analyze the provided product image(s).
      1. Identify the product by looking at all angles/details provided.
      2. Create a catchy Product Name in Korean.
      3. List key features visible or implied.
      4. Write a short, persuasive marketing copy in Korean.
      5. Suggest a structure for a "Detail Page" (Landing Page) with 4-5 distinct sections (e.g., Intro, Feature 1, Feature 2, Usage, Specs).
      6. For each section, provide an English prompt that could be used to generate a supporting image.
    `;
  } else {
    // Mode B: Localization
    prompt = `
      You are an expert translator and localization specialist for the Korean market.
      The provided image(s) are screenshots of an existing product detail page.
      
      Tasks:
      1. Extract the content and structure from all images.
      2. Localize the content into natural, persuasive Korean.
      3. Maintain the original section flow.
      4. For 'imagePrompt', describe the visual content of each section so it can be regenerated or replaced.
         If text exists in the image, instruct to replace it with Korean translation in the prompt.
    `;
  }

  try {
    // Construct parts array with multiple images
    const imageParts = base64Images.map((b64, index) => ({
      inlineData: { mimeType: mimeTypes[index], data: b64 }
    }));

    // GAS 프록시를 통한 호출 시도
    const gasUrl = getGasUrl(true); // 기본값 포함하여 가져오기
    
    // localStorage에 실제로 저장된 값 확인 (디버깅)
    const rawSavedUrl = localStorage.getItem('gemini_commerce_gas_url');
    console.log('[Gemini Service] localStorage 원본 값:', rawSavedUrl);
    console.log('[Gemini Service] getGasUrl() 결과:', gasUrl);
    console.log('[Gemini Service] DEFAULT_GAS_URL:', DEFAULT_GAS_URL);
    
    // URL 정규화 비교
    const normalizedGasUrl = gasUrl ? normalizeUrlForComparison(gasUrl) : '';
    const normalizedDefaultUrl = normalizeUrlForComparison(DEFAULT_GAS_URL);
    const isDefaultUrl = normalizedGasUrl === normalizedDefaultUrl;
    
    console.log('[Gemini Service] 원본 사용자 URL:', gasUrl);
    console.log('[Gemini Service] 원본 기본 URL:', DEFAULT_GAS_URL);
    console.log('[Gemini Service] 정규화된 사용자 URL:', normalizedGasUrl);
    console.log('[Gemini Service] 정규화된 기본 URL:', normalizedDefaultUrl);
    console.log('[Gemini Service] 기본 URL과 동일한지:', isDefaultUrl);
    console.log('[Gemini Service] URL 길이 비교 - 사용자:', normalizedGasUrl.length, '기본:', normalizedDefaultUrl.length);
    
    // URL이 실제로 다른지 문자 단위로 비교
    if (normalizedGasUrl && normalizedDefaultUrl) {
      const diffIndex = Array.from(normalizedGasUrl).findIndex((char, i) => char !== normalizedDefaultUrl[i]);
      if (diffIndex !== -1) {
        console.log('[Gemini Service] 첫 번째 차이점 위치:', diffIndex);
        console.log('[Gemini Service] 사용자 URL의 문자:', normalizedGasUrl[diffIndex], '기본 URL의 문자:', normalizedDefaultUrl[diffIndex]);
      }
    }
    
    // GAS URL이 설정되어 있고 기본 데모 URL이 아니면 프록시 사용
    if (gasUrl && gasUrl.trim() !== '' && !isDefaultUrl) {
      // GAS 프록시 사용
      const result = await callGeminiViaProxy({
        model: MODEL_TEXT_VISION,
        contents: {
          parts: [
            ...imageParts.map(p => ({ inlineData: p.inlineData } as GeminiInlineDataPart)),
            { text: prompt } as GeminiTextPart
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: productAnalysisSchema,
          temperature: 0.4,
        }
      });
      
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No response from Gemini");
      
      return JSON.parse(text) as ProductAnalysis;
    }
    
    // GAS 프록시를 사용할 수 없는 경우
    console.warn('[Gemini Service] GAS 프록시를 사용할 수 없습니다. Fallback으로 환경 변수 확인');
    console.warn('[Gemini Service] 현재 GAS URL:', gasUrl);
    console.warn('[Gemini Service] 기본 URL과 동일한지:', isDefaultUrl);
    
    // GAS 프록시가 없으면 환경 변수에서 API 키 확인 (Fallback)
    const apiKey = (window as any).__GEMINI_API_KEY__ || 
                   (import.meta.env?.VITE_GEMINI_API_KEY as string);
    
    if (!apiKey) {
      const errorMessage = isDefaultUrl
        ? 'GAS 프록시가 설정되지 않았습니다.\n\n' +
          '✅ Google Apps Script에 GEMINI_API_KEY를 스크립트 속성으로 설정하셨다면,\n' +
          '   애플리케이션 설정에서 GAS Web App URL을 입력해주세요.\n\n' +
          '   [설정 방법]\n' +
          '   1. 우측 상단 ⚙️ 아이콘 클릭\n' +
          '   2. "구글 시트 연동" 탭 선택\n' +
          '   3. "Google Apps Script (GAS) Web App URL" 필드에\n' +
          '      배포한 웹 앱 URL 입력\n' +
          '   4. "설정 저장하기" 클릭\n\n' +
          '   또는 환경 변수 사용:\n' +
          '   - .env 파일에 VITE_GEMINI_API_KEY=your_key 추가'
        : 'Gemini API 키가 설정되지 않았습니다.\n\n' +
          '방법 1: GAS 프록시 사용 (권장)\n' +
          '  - Google Apps Script에 GEMINI_API_KEY를 스크립트 속성으로 설정\n' +
          '  - GAS Web App URL을 설정에 입력\n\n' +
          '방법 2: 환경 변수 사용\n' +
          '  - .env 파일에 VITE_GEMINI_API_KEY=your_key 추가';
      
      throw new Error(errorMessage);
    }

    // 직접 API 호출 (Fallback)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TEXT_VISION}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: {
            parts: [
              ...imageParts, // Add all images
              { text: prompt }
            ]
          },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: productAnalysisSchema,
            temperature: 0.4,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini API 오류: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as ProductAnalysis;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

/**
 * Generate a new image for a section using Gemini
 */
export const generateSectionImage = async (
  prompt: string,
  referenceImageBase64?: string,
  referenceMimeType?: string,
  mode: AppMode = AppMode.CREATION
): Promise<string> => {
  try {
    let fullPrompt = "";
    
    if (mode === AppMode.LOCALIZATION) {
       fullPrompt = `High quality product image. Based on the reference, recreate the visual content. ${prompt}`;
    } else {
       fullPrompt = `Professional product photography, high quality, 4k: ${prompt}`;
    }

    const parts: GeminiPart[] = [{ text: fullPrompt } as GeminiTextPart];
    
    if (referenceImageBase64 && referenceMimeType) {
       parts.unshift({
         inlineData: {
           data: referenceImageBase64,
           mimeType: referenceMimeType
         }
       } as GeminiInlineDataPart);
    }

    // GAS 프록시를 통한 호출 시도
    const gasUrl = getGasUrl(true);
    
    // URL 정규화 비교
    const normalizedGasUrl = gasUrl ? normalizeUrlForComparison(gasUrl) : '';
    const normalizedDefaultUrl = normalizeUrlForComparison(DEFAULT_GAS_URL);
    const isDefaultUrl = normalizedGasUrl === normalizedDefaultUrl;
    
    console.log('[Image Generate] 원본 GAS URL:', gasUrl);
    console.log('[Image Generate] 정규화된 사용자 URL:', normalizedGasUrl);
    console.log('[Image Generate] 정규화된 기본 URL:', normalizedDefaultUrl);
    console.log('[Image Generate] 기본 URL과 비교 (정규화 후):', isDefaultUrl);
    
    // GAS URL이 설정되어 있고 기본 데모 URL이 아니면 프록시 사용
    if (gasUrl && gasUrl.trim() !== '' && !isDefaultUrl) {
      // GAS 프록시 사용
      const result = await callGeminiViaProxy({
        model: MODEL_IMAGE_GEN,
        contents: { parts },
      });
      
      for (const part of result.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      
      throw new Error("No image generated");
    }
    
    // GAS 프록시가 없으면 환경 변수에서 API 키 확인 (Fallback)
    const apiKey = (window as any).__GEMINI_API_KEY__ || 
                   (import.meta.env?.VITE_GEMINI_API_KEY as string);
    
    if (!apiKey) {
      throw new Error(
        'Gemini API 키가 설정되지 않았습니다.\n\n' +
        '방법 1: GAS 프록시 사용 (권장)\n' +
        '  - Google Apps Script에 GEMINI_API_KEY를 스크립트 속성으로 설정\n' +
        '  - GAS Web App URL을 설정에 입력\n\n' +
        '방법 2: 환경 변수 사용\n' +
        '  - .env 파일에 VITE_GEMINI_API_KEY=your_key 추가'
      );
    }

    // 직접 API 호출 (Fallback)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IMAGE_GEN}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: { parts }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini API 오류: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    
    for (const part of result.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image generated");
  } catch (error) {
    console.error("Image generation failed:", error);
    return `https://picsum.photos/800/800?random=${Math.random()}`;
  }
};