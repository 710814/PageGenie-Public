import { AppMode, ProductAnalysis, SectionData, Template } from "../types";
import { getGasUrl, DEFAULT_GAS_URL } from "./googleSheetService";
import { getCategoryPromptGuidelines } from "./categoryPresets";
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
 * @param timeoutMs 타임아웃 시간 (밀리초). 기본값: 120000 (2분), 이미지 생성 시: 300000 (5분)
 */
async function callGeminiViaProxy(requestData: {
  model: string;
  contents: GeminiRequest['contents'];
  config?: GeminiGenerationConfig;
}, timeoutMs?: number): Promise<GeminiResponse> {
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
    
    // URL 유효성 검증
    if (!gasUrl || !gasUrl.includes('script.google.com')) {
      throw new Error('GAS URL이 올바르지 않습니다. Google Apps Script 웹 앱 URL을 확인하세요.');
    }
    
    // 타임아웃 설정
    // 이미지 생성 모델은 더 오래 걸리므로 5분, 텍스트 분석은 2분
    const isImageGeneration = requestData.model.includes('image') || requestData.model.includes('IMAGE_GEN');
    const defaultTimeout = isImageGeneration ? 300000 : 120000; // 이미지 생성: 5분, 텍스트: 2분
    const timeout = timeoutMs || defaultTimeout;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    let response: Response;
    try {
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          model: requestData.model,
          contents: requestData.contents,
          config: requestData.config
        }),
        redirect: 'follow', // GAS 리다이렉트 따라가기
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      console.log('GAS 프록시 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '응답을 읽을 수 없습니다');
        console.error('GAS 프록시 오류 응답:', errorText);
        throw new Error(`GAS 프록시 오류 (${response.status}): ${errorText}`);
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        const timeoutMinutes = Math.round(timeout / 60000);
        throw new Error(
          `GAS 프록시 요청이 타임아웃되었습니다 (${timeoutMinutes}분). ` +
          `이미지 생성은 시간이 오래 걸릴 수 있습니다. ` +
          `네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.`
        );
      }
      if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
        throw new Error('GAS 웹 앱에 연결할 수 없습니다. 다음을 확인하세요:\n1. GAS URL이 올바른지 확인\n2. GAS 웹 앱이 배포되었는지 확인\n3. 네트워크 연결 확인\n4. 브라우저 콘솔에서 자세한 오류 확인');
      }
      throw fetchError;
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
/**
 * 템플릿 구조를 기반으로 AI 결과를 매핑
 * - 템플릿의 섹션 구조(ID, 개수, 순서, 레이아웃)를 100% 유지
 * - AI가 생성한 콘텐츠(제목, 설명)만 적용
 * - 고정 이미지, 고정 문구, 레이아웃은 절대 변경 불가
 */
const applyTemplateStructure = (
  aiResult: ProductAnalysis,
  template: Template
): ProductAnalysis => {
  // 템플릿 섹션을 기준으로 구조 완전 유지
  const mappedSections: SectionData[] = template.sections.map((templateSection, index) => {
    // AI 결과에서 동일 ID의 섹션 찾기 (우선), 없으면 인덱스 기반 매칭
    const aiSection = aiResult.sections.find(s => s.id === templateSection.id) 
                     || aiResult.sections[index]
                     || null;
    
    // 기본 섹션 구조 (템플릿에서 100% 유지)
    const baseSection: SectionData = {
      // 템플릿 구조 완전 유지 (절대 변경 불가)
      id: templateSection.id,
      layoutType: templateSection.layoutType,
      fixedText: templateSection.fixedText,
      fixedImageBase64: templateSection.fixedImageBase64,
      fixedImageMimeType: templateSection.fixedImageMimeType,
      useFixedImage: templateSection.useFixedImage,
      
      // AI가 생성한 콘텐츠 적용 (없으면 템플릿 기본값 사용)
      title: aiSection?.title || templateSection.title,
      content: buildContentWithFixedText(
        aiSection?.content || templateSection.content,
        templateSection.fixedText
      ),
      
      // 이미지 프롬프트: 고정 이미지면 템플릿 것 유지, 아니면 AI 것 사용
      imagePrompt: templateSection.useFixedImage 
        ? templateSection.imagePrompt 
        : (aiSection?.imagePrompt || templateSection.imagePrompt),
    };
    
    // 고정 이미지가 활성화되어 있으면 즉시 이미지 URL 설정
    if (templateSection.useFixedImage && templateSection.fixedImageBase64) {
      baseSection.imageUrl = `data:${templateSection.fixedImageMimeType};base64,${templateSection.fixedImageBase64}`;
      baseSection.isOriginalImage = true; // AI 생성 건너뛰기 플래그
    }
    
    return baseSection;
  });
  
  return {
    ...aiResult,
    sections: mappedSections,
  };
};

/**
 * 고정 문구를 콘텐츠에 자연스럽게 통합
 * - 고정 문구가 이미 포함되어 있으면 중복 추가 안함
 * - 없으면 콘텐츠 앞에 추가
 */
const buildContentWithFixedText = (content: string, fixedText?: string): string => {
  if (!fixedText) return content;
  
  // 이미 고정 문구가 포함되어 있는지 확인
  if (content.includes(fixedText)) {
    return content;
  }
  
  // 고정 문구를 콘텐츠 앞에 강조하여 추가
  return `✓ ${fixedText}\n\n${content}`;
};

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
          imagePrompt: { type: "string", description: "Prompt to generate an image for this section (Korean or English)" },
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
    4. Crucially, provide an 'imagePrompt' that describes the visual style and composition of that section. You can use Korean or English (e.g., "3가지 색상 변형을 보여주는 그리드 레이아웃" or "A grid layout showing 3 color variations", "텍스처 클로즈업" or "Close up of texture").
    
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
    // TEMPLATE MODE - 템플릿 구조 100% 유지
    const templateStructure = JSON.stringify(template.sections.map(s => ({
      id: s.id,
      section_purpose: s.title,
      content_guideline: s.content,
      visual_style: s.imagePrompt,
      fixed_text: s.fixedText || null,
      layout_type: s.layoutType || 'full-width',
      has_fixed_image: !!s.fixedImageBase64
    })), null, 2);

    const sectionCount = template.sections.length;
    const sectionIds = template.sections.map(s => s.id).join(', ');

    prompt = `
      You are an expert e-commerce merchandiser. You MUST follow a STRICT template structure.
      
      ## CRITICAL RULES (MUST FOLLOW):
      1. You MUST generate EXACTLY ${sectionCount} sections - no more, no less.
      2. You MUST use these EXACT section IDs in order: [${sectionIds}]
      3. You MUST NOT add, remove, or reorder any sections.
      4. You MUST preserve the template's storyline flow exactly as given.
      
      ## Input:
      - Product Image(s): Photos of the product to sell
      - Template Structure (MUST FOLLOW EXACTLY):
      ${templateStructure}
      
      ## Your Tasks:
      1. Analyze ALL input images to understand the product thoroughly.
      2. For EACH section in the template (in exact order):
         - Use the EXACT 'id' provided - do not change it
         - Write a compelling 'title' in Korean that fits the section's purpose
         - Write detailed 'content' in Korean based on the 'content_guideline'
         - Create an 'imagePrompt' (Korean or English) that combines the 'visual_style' with the actual product
      
      ## Special Instructions:
      - If 'fixed_text' exists: You MUST include it prominently in the 'content'
      - If 'has_fixed_image' is true: Keep the 'imagePrompt' similar to the 'visual_style'
      
      ## CRITICAL - imagePrompt Guidelines:
      When creating 'imagePrompt', you MUST:
      - Always describe the SAME EXACT product from the uploaded images
      - Focus on changing ONLY: background, lighting, angle, props, scene
      - NEVER describe a different or modified product
      - The product must remain identical to the reference image
      - Example: "The same product on a marble surface, studio lighting, minimal background"
      
      ## Output Format:
      Return JSON with 'sections' array containing EXACTLY ${sectionCount} sections with matching IDs.
    `;
  } else if (mode === AppMode.CREATION) {
    // 카테고리별 가이드라인 생성
    const categoryGuidelines = getCategoryPromptGuidelines();
    
    prompt = `
      You are an expert e-commerce merchandiser specializing in the Korean market.
      
      ## STEP 1: Analyze Product & Detect Category
      Analyze the provided product image(s) and determine the product category:
      - Fashion/Apparel (패션/의류): clothing, shoes, bags, accessories
      - Beauty/Cosmetics (뷰티/화장품): skincare, makeup, cosmetics
      - Furniture/Interior (가구/인테리어): furniture, home decor
      - Living/Kitchen (생활용품/주방): kitchenware, household items
      - Food/Health (식품/건강식품): food, snacks, supplements
      - Electronics (전자제품/가전): gadgets, appliances, devices
      - Kids/Baby (유아/아동용품): baby products, toys, children's items
      - Pet Supplies (반려동물용품): pet food, pet accessories
      
      ## STEP 2: Create Product Information
      1. Create a catchy Product Name in Korean
      2. List 4-5 key features visible or implied
      3. Write a short, persuasive marketing copy in Korean (2-3 sentences)
      4. Set 'detectedCategory' to the detected category ID (fashion, beauty, furniture, living, food, electronics, kids, pet)
      
      ## STEP 3: Category-Optimized Section Structure
      Based on the detected category, create 6 sections following these category-specific guidelines:
      
      ${categoryGuidelines}
      
      ## IMPORTANT RULES:
      1. You MUST detect the category first and use the corresponding section structure
      2. Each section should have:
         - A compelling Korean title matching the category template
         - Detailed Korean content (3-5 sentences) tailored to the product
         - An image generation prompt that matches the category's visual style
      3. The section structure should feel natural and optimized for the product type
      4. All content should be in Korean except imagePrompt (Korean or English)
      
      ## CRITICAL - imagePrompt Guidelines:
      When creating 'imagePrompt' for each section, you MUST:
      - Always describe the SAME EXACT product from the uploaded images
      - Focus on changing ONLY: background, lighting, angle, props, scene, styling
      - NEVER describe a different or modified product
      - The product's shape, color, design, texture must remain identical
      - Example format: "The same [product name] placed on a wooden table, soft natural lighting, lifestyle setting"
      - Always start with "The same product..." or "The exact product from the reference..."
      
      ## Output Format:
      Return JSON with:
      - productName: Korean product name
      - mainFeatures: array of 4-5 features
      - marketingCopy: Korean marketing text
      - detectedCategory: category ID (fashion, beauty, furniture, living, food, electronics, kids, pet)
      - sections: array of 6 category-optimized sections
    `;
  } else {
    // Mode B: Localization
    prompt = `
      You are an expert translator and localization specialist for the Korean market.
      The provided image(s) are screenshots of an existing product detail page in a foreign language (English, Chinese, etc.).
      
      ## Your Tasks:
      1. **Extract Content**: Analyze all images and extract:
         - All visible text content (product names, descriptions, features, prices, etc.)
         - Section structure and layout
         - Visual elements (product images, icons, graphics)
      
      2. **Translate Content**: Convert all foreign language text into natural, persuasive Korean:
         - Product names and descriptions
         - Marketing copy and features
         - Section titles and content
         - Maintain the original meaning and tone
      
      3. **Maintain Structure**: Keep the original section flow and layout exactly as shown
      
      4. **Image Prompt Strategy** (CRITICAL for 'imagePrompt' field):
         For each section, analyze the image and determine:
         
         **Case A: Text is CLEAR and TRANSLATABLE**
         - If the text in the image is clearly readable and can be accurately translated:
           → Create an imagePrompt that instructs: "Recreate this layout with Korean text replacing the original text"
           → Example: "The same product layout with Korean text overlay: '[translated text]', maintaining the original visual style and composition"
         
         **Case B: Text is UNCLEAR or UNTRANSLATABLE**
         - If the text is blurry, low resolution, partially obscured, or cannot be accurately translated:
           → Create an imagePrompt that instructs: "Remove all text from the image, keep only the visual elements"
           → Example: "The same product and visual elements without any text overlay, clean design, professional photography"
           → Default action: REMOVE TEXT (this is the default when translation is uncertain)
         
         **Decision Rule**:
         - If you can clearly read and translate 80%+ of the text → Use Case A
         - If text is unclear, blurry, or less than 80% readable → Use Case B (REMOVE TEXT)
         - When in doubt → Use Case B (REMOVE TEXT) - this is the default
      
      ## CRITICAL - imagePrompt Guidelines:
      When creating 'imagePrompt' for each section:
      - The product/visual elements must remain IDENTICAL to the original
      - The product's shape, color, design, texture must be EXACTLY the same
      - NEVER describe a different product
      - For text handling:
        * If text is clear and translatable: "Korean text: '[translated text]' replacing original text"
        * If text is unclear/unt translatable: "No text overlay, clean image without text"
        * Default: Remove text when uncertain
      
      ## Output Requirements:
      - All 'title' and 'content' fields must be in Korean (translated from original)
      - 'imagePrompt' must clearly indicate:
        * Whether to include Korean text or remove text
        * How to handle the visual elements
        * Default to text removal when translation is uncertain
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
      
      const analysis = JSON.parse(text) as ProductAnalysis;
      
      // 템플릿 모드: 템플릿 구조를 기반으로 강제 매핑 (100% 구조 유지)
      if (template) {
        return applyTemplateStructure(analysis, template);
      }
      
      return analysis;
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

    const analysis = JSON.parse(text) as ProductAnalysis;
    
    // 템플릿 모드: 템플릿 구조를 기반으로 강제 매핑 (100% 구조 유지)
    if (template) {
      return applyTemplateStructure(analysis, template);
    }
    
    return analysis;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

/**
 * Edit a single image: translate or remove foreign language text
 * 단일 이미지의 외국어 텍스트를 한국어로 번역하거나 삭제
 * @param progressCallback 진행 상태 업데이트 콜백 (step, message)
 */
export const editSingleImageWithProgress = async (
  base64Image: string,
  mimeType: string,
  progressCallback?: (step: string, message: string) => void
): Promise<string> => {
  const reportProgress = (step: string, message: string) => {
    if (progressCallback) {
      progressCallback(step, message);
    }
    console.log(`[editSingleImage] ${step}: ${message}`);
  };

  try {
    // 1단계: 이미지 분석 - 텍스트 감지 및 번역 가능 여부 판단
    reportProgress('1단계', '이미지 분석 중...');
  try {
    // 1단계: 이미지 분석 - 텍스트 감지 및 번역 가능 여부 판단
    const analysisPrompt = `
You are an expert image analyzer specializing in text detection and translation.

Analyze the provided image and:
1. Detect all visible text in the image (any language: English, Chinese, Japanese, etc.)
2. Assess text clarity and readability:
   - Can you clearly read 80%+ of the text? → TRANSLATABLE
   - Is the text blurry, low resolution, or partially obscured? → REMOVE_TEXT
   - Is the text stylized graphics that are hard to translate? → REMOVE_TEXT
3. If translatable, provide Korean translations for all detected text
4. Determine the action: "translate" or "remove"

Output JSON format:
{
  "action": "translate" | "remove",
  "detectedText": [
    {"original": "original text", "korean": "한국어 번역", "position": "description of text position"}
  ],
  "reason": "why translate or remove"
}
    `;

    // 분석 요청
    reportProgress('1단계', '텍스트 감지 및 번역 가능 여부 판단 중...');
    const analysisResult = await callGeminiViaProxy({
      model: MODEL_TEXT_VISION,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Image } } as GeminiInlineDataPart,
          { text: analysisPrompt } as GeminiTextPart
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["translate", "remove"] },
            detectedText: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  original: { type: "string" },
                  korean: { type: "string" },
                  position: { type: "string" }
                }
              }
            },
            reason: { type: "string" }
          },
          required: ["action", "detectedText", "reason"]
        },
        temperature: 0.3,
      }
    });

    const analysisText = analysisResult.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!analysisText) throw new Error("이미지 분석 실패");

    reportProgress('1단계', '분석 결과 처리 중...');
    const analysis = JSON.parse(analysisText);
    const shouldTranslate = analysis.action === "translate";
    
    reportProgress('2단계', shouldTranslate ? '한국어로 번역하여 이미지 생성 중...' : '텍스트 제거하여 이미지 생성 중...');

    // 2단계: 이미지 생성 프롬프트 생성
    let imagePrompt = "";
    
    if (shouldTranslate && analysis.detectedText && analysis.detectedText.length > 0) {
      // 번역 모드: 한국어 텍스트로 교체
      const translations = analysis.detectedText
        .map((item: any) => `"${item.original}" → "${item.korean}"`)
        .join(", ");
      
      imagePrompt = `
CRITICAL INSTRUCTIONS FOR IMAGE EDITING:
1. Keep the EXACT same product and visual elements from the reference image
   - Product's shape, color, design, texture must be IDENTICAL
   - Background, layout, composition must remain the same
   - Do NOT modify the product itself

2. REPLACE all foreign language text with Korean translations:
   ${translations}
   - Maintain the same text position, size, and style
   - Use natural, professional Korean typography
   - Keep the same visual hierarchy

3. Maintain the original visual style and composition
   - Same lighting, angle, and scene composition
   - Professional, high-quality photography

Generate the edited image with Korean text replacing the original text.
High quality, professional product photography.
      `.trim();
    } else {
      // 제거 모드: 텍스트 제거
      imagePrompt = `
CRITICAL INSTRUCTIONS FOR IMAGE EDITING:
1. Keep the EXACT same product and visual elements from the reference image
   - Product's shape, color, design, texture must be IDENTICAL
   - Background, layout, composition must remain the same
   - Do NOT modify the product itself

2. REMOVE ALL TEXT from the image
   - Remove any text overlays, labels, or text elements
   - Keep only the visual elements (product, background, graphics)
   - Create a clean, text-free version
   - Fill any text areas naturally with background or product elements

3. Maintain the original visual style and composition
   - Same lighting, angle, and scene composition
   - Professional, high-quality photography

Generate the edited image without any text.
High quality, professional product photography without text overlay.
      `.trim();
    }

    // 3단계: 이미지 생성
    const parts: GeminiPart[] = [
      { inlineData: { data: base64Image, mimeType } } as GeminiInlineDataPart,
      { text: imagePrompt } as GeminiTextPart
    ];

    const gasUrl = getGasUrl(true);
    const normalizedGasUrl = gasUrl ? normalizeUrlForComparison(gasUrl) : '';
    const normalizedDefaultUrl = normalizeUrlForComparison(DEFAULT_GAS_URL);
    const isDefaultUrl = normalizedGasUrl === normalizedDefaultUrl;

    if (gasUrl && gasUrl.trim() !== '' && !isDefaultUrl) {
      // GAS 프록시 사용
      reportProgress('2단계', '이미지 생성 중... (시간이 다소 걸릴 수 있습니다)');
      const result = await callGeminiViaProxy({
        model: MODEL_IMAGE_GEN,
        contents: { parts },
      });

      reportProgress('2단계', '생성된 이미지 처리 중...');
      for (const part of result.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          reportProgress('완료', '이미지 수정 완료!');
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }

      throw new Error("이미지 생성 실패");
    }

    // Fallback: 환경 변수에서 API 키 확인
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
    reportProgress('2단계', '이미지 생성 중... (Fallback 모드)');
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

    reportProgress('2단계', '생성된 이미지 처리 중...');
    for (const part of result.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        reportProgress('완료', '이미지 수정 완료!');
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("이미지 생성 실패");
  } catch (error) {
    console.error("Image editing failed:", error);
    if (progressCallback) {
      progressCallback('오류', `이미지 수정 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
    throw error;
  }
};

/**
 * Edit a single image: translate or remove foreign language text (기존 함수, 호환성 유지)
 * 단일 이미지의 외국어 텍스트를 한국어로 번역하거나 삭제
 */
export const editSingleImage = async (
  base64Image: string,
  mimeType: string
): Promise<string> => {
  return editSingleImageWithProgress(base64Image, mimeType);
};

/**
 * Generate a new image for a section using Gemini
 * 원본 이미지의 제품을 그대로 유지하면서 새로운 장면/구도로 생성
 */
export const generateSectionImage = async (
  prompt: string,
  referenceImageBase64?: string,
  referenceMimeType?: string,
  mode: AppMode = AppMode.CREATION
): Promise<string> => {
  try {
    let fullPrompt = "";
    
    if (referenceImageBase64 && referenceMimeType) {
      // 원본 이미지가 있는 경우 - 제품 동일성 유지 강조
      if (mode === AppMode.LOCALIZATION) {
        // 프롬프트에서 텍스트 처리 지시 확인
        const shouldRemoveText = prompt.toLowerCase().includes('no text') || 
                                 prompt.toLowerCase().includes('remove text') ||
                                 prompt.toLowerCase().includes('without text') ||
                                 prompt.toLowerCase().includes('clean image');
        
        const hasKoreanText = prompt.includes('한국어') || 
                             prompt.includes('Korean text') ||
                             prompt.match(/['"](.*?)['"]/); // 따옴표로 둘러싸인 텍스트
        
        if (shouldRemoveText) {
          // 텍스트 제거 모드
          fullPrompt = `
CRITICAL INSTRUCTIONS FOR LOCALIZATION:
1. Keep the EXACT same product from the reference image
   - Product's shape, color, design, texture must be IDENTICAL
   - Do NOT modify the product itself
2. REMOVE ALL TEXT from the image
   - Remove any text overlays, labels, or text elements
   - Keep only the visual elements (product, background, graphics)
   - Create a clean, text-free version
3. Maintain the original visual style and composition
   - Same lighting, angle, and scene composition
   - Same background style (if applicable)
   - Professional, high-quality photography

Based on the reference image, recreate: ${prompt}
High quality, professional product photography without any text.
          `.trim();
        } else if (hasKoreanText) {
          // 한국어 텍스트 포함 모드
          fullPrompt = `
CRITICAL INSTRUCTIONS FOR LOCALIZATION:
1. Keep the EXACT same product from the reference image
   - Product's shape, color, design, texture must be IDENTICAL
   - Do NOT modify the product itself
2. REPLACE original text with Korean text
   - Remove original foreign language text
   - Add Korean text as specified in the prompt
   - Maintain the same text position and style
3. Maintain the original visual style and composition
   - Same layout and composition
   - Same lighting and background style
   - Professional, high-quality photography

Based on the reference image, recreate: ${prompt}
High quality, professional product photography with Korean text.
          `.trim();
        } else {
          // 기본: 텍스트 제거 (불확실한 경우)
          fullPrompt = `
CRITICAL INSTRUCTIONS FOR LOCALIZATION:
1. Keep the EXACT same product from the reference image
   - Product's shape, color, design, texture must be IDENTICAL
   - Do NOT modify the product itself
2. DEFAULT ACTION: REMOVE ALL TEXT
   - Remove any text overlays, labels, or text elements
   - Keep only the visual elements (product, background, graphics)
   - Create a clean, text-free version
3. Maintain the original visual style and composition

Based on the reference image, recreate: ${prompt}
High quality, professional product photography without any text overlay.
          `.trim();
        }
      } else {
        fullPrompt = `
CRITICAL INSTRUCTION: You MUST keep the EXACT same product from the reference image.
- The product's shape, color, design, texture, and all visual details must be IDENTICAL to the reference
- Do NOT change, modify, or replace the product in any way
- You may ONLY change: background, lighting, camera angle, props, or scene composition
- The product must be clearly recognizable as the SAME item from the reference

Generate a professional product photo with these specifications:
${prompt}

REMEMBER: The product itself must remain EXACTLY as shown in the reference image.
High quality, 4K resolution, professional e-commerce photography.
        `.trim();
      }
    } else {
      // 원본 이미지가 없는 경우 - 기존 방식
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