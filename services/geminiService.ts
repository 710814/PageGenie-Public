import { AppMode, ProductAnalysis, SectionData, Template, ProductInputData } from "../types";
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
 * 이미지 슬롯 타입별 기본 프롬프트 템플릿
 * [PRODUCT] 플레이스홀더는 실제 이미지 생성 시 원본 상품 이미지 참조로 대체됨
 */
export const IMAGE_SLOT_DEFAULT_PROMPTS: Record<string, string> = {
  hero: 'Full body product shot of [PRODUCT], clean white background, professional studio lighting, hero image style, centered composition',
  product: 'Professional product photography of [PRODUCT], clean background, high quality studio lighting, e-commerce style',
  detail: 'Extreme close-up macro shot of [PRODUCT] showing texture, stitching, and material details, high resolution, shallow depth of field',
  material: 'Close-up of [PRODUCT] fabric/material texture, showing weave pattern and quality, soft directional lighting, texture focus',
  color_styling: 'Full body shot of [PRODUCT] showcasing color and styling, lifestyle setting, coordinated styling, fashion editorial style',
  fit: 'Full body shot of model wearing/using [PRODUCT], natural pose, minimalist indoor setting, lifestyle photography, showing fit and movement',
  spec: '[PRODUCT] with measurement overlay or size reference, infographic style, clean background, size chart visualization',
  notice: 'Clean informational image related to [PRODUCT], notice/care instruction style, iconographic elements, clear and readable',
  custom: 'Professional product photography of [PRODUCT], suitable for e-commerce product detail page'
};

/**
 * 상품 일관성 유지 프롬프트 래퍼
 * 원본 상품 이미지를 참조하면서 다양한 컴포지션을 생성하도록 지시
 */
export const PRODUCT_CONSISTENCY_PROMPT = `
## CRITICAL: MAINTAIN EXACT PRODUCT VISUAL CONSISTENCY

### MANDATORY REQUIREMENTS:
1. The product's shape, color, design, texture, and ALL visual details must be IDENTICAL to the reference image
2. Do NOT modify, alter, or stylize the product itself in any way
3. The product must be clearly recognizable as the EXACT same item from the reference

### WHAT YOU CAN CHANGE:
- Background setting and environment
- Lighting style and direction
- Camera angle and composition
- Props and context elements
- Model/mannequin for wearable items

### FINAL CHECK:
If someone compared the product in your generated image with the reference, it should be indistinguishable - only the setting changes.
`;

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
    // 이미지 생성 모델은 더 오래 걸리므로 5분
    // 이미지 분석(텍스트 감지)도 큰 이미지나 복잡한 이미지의 경우 시간이 걸릴 수 있으므로 3분
    // 일반 텍스트 분석은 2분
    const isImageGeneration = requestData.model.includes('image') || requestData.model === MODEL_IMAGE_GEN;

    // 이미지 분석 감지: parts 배열에서 inlineData가 있는지 확인
    let hasImageData = false;
    try {
      if (requestData.contents?.parts) {
        hasImageData = requestData.contents.parts.some((p: any) => {
          return p && (p.inlineData || (typeof p === 'object' && 'inlineData' in p));
        });
      }
    } catch (e) {
      console.warn('[callGeminiViaProxy] 이미지 데이터 감지 중 오류:', e);
    }

    const isImageAnalysis = requestData.model === MODEL_TEXT_VISION && hasImageData;

    let defaultTimeout = 120000; // 기본 2분
    if (isImageGeneration) {
      defaultTimeout = 300000; // 이미지 생성: 5분
    } else if (isImageAnalysis) {
      defaultTimeout = 180000; // 이미지 분석(텍스트 감지): 3분
    }

    const timeout = timeoutMs || defaultTimeout;

    console.log('[callGeminiViaProxy] 타임아웃 설정:', {
      model: requestData.model,
      isImageGeneration,
      isImageAnalysis,
      hasImageData,
      timeoutMs,
      defaultTimeout,
      finalTimeout: timeout,
      timeoutMinutes: Math.round(timeout / 60000)
    });

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
 * 이미지 슬롯 타입에 따른 기본 프롬프트 가져오기
 * @param slotType 이미지 슬롯 타입
 * @returns 기본 프롬프트 문자열
 */
export const getDefaultPromptForSlotType = (slotType: string): string => {
  return IMAGE_SLOT_DEFAULT_PROMPTS[slotType] || IMAGE_SLOT_DEFAULT_PROMPTS.custom;
};

/**
 * 상품 일관성을 유지하는 최종 이미지 생성 프롬프트 빌드
 * 원본 상품 이미지를 참조 이미지로 사용하면서, 섹션/슬롯 타입에 맞는 컴포지션 생성
 * 
 * @param userPrompt 사용자가 입력한 프롬프트 또는 기본 프롬프트
 * @param productName 상품명 (선택)
 * @returns 일관성 보장 프롬프트
 */
export const buildProductConsistentPrompt = (
  userPrompt: string,
  productName?: string
): string => {
  // [PRODUCT] 플레이스홀더를 상품명으로 대체 (있으면)
  let finalPrompt = userPrompt;
  if (productName) {
    finalPrompt = userPrompt.replace(/\[PRODUCT\]/gi, productName);
  } else {
    // 상품명이 없으면 "the product"로 대체
    finalPrompt = userPrompt.replace(/\[PRODUCT\]/gi, 'the product');
  }

  // 일관성 유지 지시어 추가
  return `${PRODUCT_CONSISTENCY_PROMPT}

${finalPrompt}

High quality, 4K resolution, professional e-commerce photography.`;
};

/**
 * Schema for the product analysis output (JSON Schema format for Gemini API)
 */
/**
 * 레이아웃 타입에 따른 필요 이미지 슬롯 수 계산
 */
const getImageSlotCountForLayout = (layoutType: string): number => {
  switch (layoutType) {
    case 'grid-2': return 2;
    case 'grid-3': return 3;
    case 'split-left':
    case 'split-right':
    case 'full-width':
    case 'image-only':
      return 1;
    case 'text-only':
      return 0;
    default:
      return 1;
  }
};

/**
 * 레이아웃 타입에 따른 이미지 슬롯 자동 생성
 */
const generateImageSlotsForLayout = (
  sectionId: string,
  layoutType: string,
  basePrompt: string,
  existingSlots?: import('../types').ImageSlot[]
): import('../types').ImageSlot[] => {
  const requiredCount = getImageSlotCountForLayout(layoutType);

  if (requiredCount === 0) return [];

  // 기존 슬롯이 있으면 그대로 사용 (개수 맞으면)
  if (existingSlots && existingSlots.length === requiredCount) {
    return existingSlots;
  }

  // 새로 생성
  const slots: import('../types').ImageSlot[] = [];
  for (let i = 0; i < requiredCount; i++) {
    const slotNum = i + 1;
    slots.push({
      id: `${sectionId}-slot-${slotNum}`,
      slotType: i === 0 ? 'product' : 'detail',
      prompt: requiredCount > 1
        ? `[이미지 ${slotNum}/${requiredCount}] ${basePrompt}`
        : basePrompt
    });
  }

  return slots;
};

/**
 * 이미지 프롬프트에서 색상 플레이스홀더를 실제 컬러 옵션으로 대체
 * - {{COLOR_1}}, {{COLOR_2}}, {{COLOR_3}} 등을 colorOptions 이름으로 대체
 * - 하드코딩된 색상 패턴도 감지하여 대체 시도
 */
const replaceColorPlaceholders = (
  prompt: string,
  colorOptions: { colorName: string }[],
  slotIndex: number
): string => {
  if (!prompt || colorOptions.length === 0) return prompt;

  let result = prompt;

  // 플레이스홀더 방식: {{COLOR_1}}, {{COLOR_2}} 등
  colorOptions.forEach((color, idx) => {
    const placeholder = `{{COLOR_${idx + 1}}}`;
    result = result.replace(new RegExp(placeholder, 'gi'), color.colorName);
  });

  // 현재 슬롯에 해당하는 컬러로 대체 (슬롯 인덱스 기반)
  if (colorOptions[slotIndex]) {
    const colorName = colorOptions[slotIndex].colorName;

    // 일반적인 색상 표현 패턴 대체
    // "in wine color" -> "in {actualColor} color"
    // "wine-colored" -> "{actualColor}-colored"
    const colorPatterns = [
      /in\s+(wine|beige|gray|grey|black|white|navy|brown|red|blue|green|pink|cream|ivory|khaki|olive|camel)\s+(color|colored)/gi,
      /\b(wine|beige|gray|grey|black|white|navy|brown|red|blue|green|pink|cream|ivory|khaki|olive|camel)[- ]?color(ed)?\b/gi,
    ];

    colorPatterns.forEach(pattern => {
      result = result.replace(pattern, (match) => {
        // "in wine color" -> "in 네이비 color"
        return match.replace(/\b(wine|beige|gray|grey|black|white|navy|brown|red|blue|green|pink|cream|ivory|khaki|olive|camel)\b/i, colorName);
      });
    });
  }

  return result;
};

/**
 * 모델 설정을 이미지 생성 프롬프트용 텍스트로 변환
 * - 빈 설정이면 빈 문자열 반환
 */
const buildModelDescription = (
  modelSettings?: import('../types').ModelSettings
): string => {
  if (!modelSettings) return '';

  const parts: string[] = [];

  // 인종/외모
  if (modelSettings.ethnicity === 'asian') {
    parts.push('Asian model');
  } else if (modelSettings.ethnicity === 'western') {
    parts.push('Western/Caucasian model');
  }

  // 성별
  if (modelSettings.gender === 'female') {
    parts.push('female');
  } else if (modelSettings.gender === 'male') {
    parts.push('male');
  }

  // 연령대
  if (modelSettings.ageRange && modelSettings.ageRange !== 'any') {
    const ageMap: Record<string, string> = {
      'teens': 'teenager',
      '20s': 'in their 20s',
      '30s': 'in their 30s',
      '40s': 'in their 40s',
      '50s+': 'in their 50s or older'
    };
    parts.push(ageMap[modelSettings.ageRange] || '');
  }

  // 헤어 스타일
  if (modelSettings.hairStyle) {
    parts.push(`with ${modelSettings.hairStyle}`);
  }

  if (parts.length === 0) return '';

  return parts.join(', ');
};

/**
 * 템플릿 구조를 기반으로 AI 결과를 매핑
 * - 템플릿의 섹션 구조(ID, 개수, 순서, 레이아웃)를 100% 유지
 * - AI가 생성한 콘텐츠(제목, 설명)만 적용
 * - 고정 이미지, 고정 문구, 레이아웃은 절대 변경 불가
 * - ★ layoutType에 따라 imageSlots 자동 생성
 * - ★ productData.colorOptions로 색상 플레이스홀더 대체
 */
const applyTemplateStructure = (
  aiResult: ProductAnalysis,
  template: Template,
  productData?: ProductInputData
): ProductAnalysis => {
  console.log('[applyTemplateStructure] 템플릿 적용 시작:', template.name);
  console.log('[applyTemplateStructure] 템플릿 섹션 수:', template.sections.length);
  console.log('[applyTemplateStructure] AI 결과 섹션 수:', aiResult.sections.length);
  console.log('[applyTemplateStructure] 컬러 옵션 수:', productData?.colorOptions?.length || 0);

  const colorOptions = productData?.colorOptions || [];

  // 템플릿 섹션을 기준으로 구조 완전 유지
  const mappedSections: SectionData[] = template.sections.map((templateSection, index) => {
    // AI 결과에서 동일 ID의 섹션 찾기 (우선), 없으면 인덱스 기반 매칭
    const aiSection = aiResult.sections.find(s => s.id === templateSection.id)
      || aiResult.sections[index]
      || null;

    console.log(`[applyTemplateStructure] 섹션 ${index + 1}: ${templateSection.id} -> AI 매칭: ${aiSection?.id || 'none'}`);

    const effectiveLayoutType = templateSection.layoutType || 'full-width';
    const baseImagePrompt = templateSection.useFixedImage
      ? templateSection.imagePrompt
      : (aiSection?.imagePrompt || templateSection.imagePrompt);

    // ★ layoutType에 따라 imageSlots 자동 생성
    const autoGeneratedSlots = generateImageSlotsForLayout(
      templateSection.id,
      effectiveLayoutType,
      baseImagePrompt || '',
      templateSection.imageSlots
    );

    // ★ 컬러 옵션이 있으면 슬롯 프롬프트의 색상 플레이스홀더 대체
    const colorReplacedSlots = autoGeneratedSlots.map((slot, slotIdx) => ({
      ...slot,
      prompt: replaceColorPlaceholders(slot.prompt, colorOptions, slotIdx)
    }));

    console.log(`[applyTemplateStructure] 섹션 ${index + 1}: layout=${effectiveLayoutType}, slots=${colorReplacedSlots.length}`);

    // 기본 섹션 구조 (템플릿에서 100% 유지)
    const baseSection: SectionData = {
      // ★ 템플릿 구조 완전 유지 (절대 변경 불가)
      id: templateSection.id,
      sectionType: templateSection.sectionType,
      layoutType: effectiveLayoutType,
      imageSlots: colorReplacedSlots,  // ★ 색상 대체 적용된 이미지 슬롯
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

      // 기존 호환성: 단일 imagePrompt (첫 번째 슬롯 기준)
      imagePrompt: colorReplacedSlots[0]?.prompt || baseImagePrompt,
    };

    // 고정 이미지가 활성화되어 있으면 즉시 이미지 URL 설정
    if (templateSection.useFixedImage && templateSection.fixedImageBase64) {
      baseSection.imageUrl = `data:${templateSection.fixedImageMimeType};base64,${templateSection.fixedImageBase64}`;
      baseSection.isOriginalImage = true; // AI 생성 건너뛰기 플래그
    }

    return baseSection;
  });

  console.log('[applyTemplateStructure] 최종 매핑된 섹션 수:', mappedSections.length);

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
 * Schema for template extraction (NEW - template-specific structure)
 */
const templateExtractionSchema = {
  type: "object",
  properties: {
    templateName: { type: "string", description: "템플릿 이름 (상품 카테고리 기반)" },
    templateCategory: {
      type: "string",
      enum: ["fashion", "beauty", "food", "electronics", "furniture", "living", "kids", "pet", "other"],
      description: "상품 카테고리"
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "섹션 고유 ID (예: sec-1)" },
          sectionType: {
            type: "string",
            enum: ["title", "hero", "description", "colors", "material_detail", "styling", "fit", "spec", "notice", "custom"],
            description: "섹션 역할/목적"
          },
          title: { type: "string", description: "섹션 제목 예시 (한국어)" },
          content: { type: "string", description: "본문 플레이스홀더 텍스트 (한국어)" },
          layoutType: {
            type: "string",
            enum: ["full-width", "split-left", "split-right", "grid-2", "grid-3", "text-only", "image-only"],
            description: "레이아웃 배치"
          },
          imageSlots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "이미지 슬롯 ID (예: img-1)" },
                slotType: {
                  type: "string",
                  enum: ["hero", "product", "detail", "material", "color_styling", "fit", "spec", "notice", "custom"],
                  description: "이미지 유형"
                },
                prompt: { type: "string", description: "범용 이미지 생성 프롬프트 ([PRODUCT] 플레이스홀더 사용)" }
              },
              required: ["id", "slotType", "prompt"]
            },
            description: "이미지 슬롯 배열 (섹션 내 이미지들)"
          }
        },
        required: ["id", "sectionType", "title", "layoutType", "imageSlots"]
      }
    }
  },
  required: ["templateName", "templateCategory", "sections"]
};

/**
 * Enhanced prompt for template extraction
 */
const templateExtractionPrompt = `
You are an expert e-commerce product page designer analyzing a product detail page image.
Your task is to extract a REUSABLE TEMPLATE STRUCTURE that can be applied to similar products.

## CRITICAL INSTRUCTIONS:

### 1. Analyze each distinct SECTION of the page:

**섹션 타입 (sectionType)** - Identify the purpose:
- title: 상품명/타이틀 영역
- hero: 메인 비주얼 영역 (대표 이미지)
- description: 상품 설명/소개
- colors: 색상 옵션/변형
- material_detail: 소재/원단 상세
- styling: 코디/스타일링 제안
- fit: 핏/착용감/사이즈 안내
- spec: 상세 스펙/사양표
- notice: 안내사항/주의사항
- custom: 기타

**레이아웃 (layoutType)** - How content is arranged:
- full-width: 이미지가 전체 너비로 표시
- split-left: 좌측 이미지 + 우측 텍스트
- split-right: 좌측 텍스트 + 우측 이미지
- grid-2: 2열 이미지 그리드
- grid-3: 3열 이미지 그리드
- text-only: 텍스트만 (이미지 없음)
- image-only: 이미지만 (텍스트 없음)

### 2. For EACH image in the section, create an imageSlot:

**이미지 슬롯 타입 (slotType)**:
- hero: 대표/메인 이미지
- product: 상품 전체 이미지
- detail: 디테일 클로즈업
- material: 소재/텍스처 클로즈업
- color_styling: 색상 변형/스타일링
- fit: 착용/핏 이미지
- spec: 스펙 도표/다이어그램
- notice: 안내 이미지
- custom: 기타

**프롬프트 작성 규칙 (IMPORTANT)**:
- Write product-agnostic prompts using [PRODUCT] as placeholder
- Include visual style, composition, lighting, background
- Example: "Full body shot of a model wearing [PRODUCT] in a minimalist room setting with warm natural lighting"
- Example: "Close-up texture shot of [PRODUCT] material with soft studio lighting"
- Write in English for better AI image generation

### 3. Output Requirements:
- Return valid JSON matching the schema
- title and content fields in Korean
- imageSlot prompt in English with [PRODUCT] placeholder
- Include 4-8 sections for a complete template
- Each section should have at least 1 imageSlot (except text-only sections)

## TEMPLATE PURPOSE:
This template will be used to generate new product pages. The structure, layout types, and image prompts will be reused - only the actual product content will change. Focus on extracting PATTERNS, not specific content.
`;

/**
 * Extract template structure from a reference image
 * Enhanced version with sectionType, layoutType, and imageSlots
 */
export const extractTemplateFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<Template> => {
  try {
    // GAS 프록시를 통한 호출 시도
    const gasUrl = getGasUrl(true);

    // URL 정규화 비교
    const normalizedGasUrl = gasUrl ? normalizeUrlForComparison(gasUrl) : '';
    const normalizedDefaultUrl = normalizeUrlForComparison(DEFAULT_GAS_URL);
    const isDefaultUrl = normalizedGasUrl === normalizedDefaultUrl;

    console.log('[Template Extract] Using enhanced template extraction schema');

    // GAS URL이 설정되어 있고 기본 데모 URL이 아니면 프록시 사용
    if (gasUrl && gasUrl.trim() !== '' && !isDefaultUrl) {
      // GAS 프록시 사용
      const result = await callGeminiViaProxy({
        model: MODEL_TEXT_VISION,
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Image } } as GeminiInlineDataPart,
            { text: templateExtractionPrompt } as GeminiTextPart
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: templateExtractionSchema,
          temperature: 0.3,
        }
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No response from Gemini");

      const templateData = JSON.parse(text);

      // Convert to Template format with new structure
      return convertToTemplate(templateData);
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
              { text: templateExtractionPrompt }
            ]
          },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: templateExtractionSchema,
            temperature: 0.3,
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

    const templateData = JSON.parse(text);

    return convertToTemplate(templateData);
  } catch (error) {
    console.error("Template extraction failed:", error);
    throw error;
  }
};

/**
 * Convert AI response to Template format
 */
const convertToTemplate = (templateData: any): Template => {
  const sections: SectionData[] = templateData.sections.map((sec: any) => ({
    id: sec.id || `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: sec.title || '',
    content: sec.content || '',
    sectionType: sec.sectionType,
    layoutType: sec.layoutType,
    imageSlots: sec.imageSlots?.map((slot: any) => ({
      id: slot.id || `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      slotType: slot.slotType || 'hero',
      prompt: slot.prompt || '',
    })) || [],
    // 하위 호환성: 첫 번째 이미지 슬롯의 프롬프트를 imagePrompt로 설정
    imagePrompt: sec.imageSlots?.[0]?.prompt || '',
  }));

  return {
    id: `tpl-${Date.now()}`,
    name: templateData.templateName || "새 템플릿",
    description: `${templateData.templateCategory || 'other'} 카테고리 템플릿`,
    category: templateData.templateCategory,
    sections,
    createdAt: Date.now()
  };
};

/**
 * Analyze image(s) and generate product details and section structure
 * Updated to accept multiple images
 */
export const analyzeProductImage = async (
  base64Images: string[],
  mimeTypes: string[],
  mode: AppMode,
  template?: Template | null,
  productData?: ProductInputData  // 상품 정보 (새로운 Phase 7)
): Promise<ProductAnalysis> => {
  // 디버그 로그: 템플릿 전달 확인
  console.log('[analyzeProductImage] 호출됨');
  console.log('[analyzeProductImage] 이미지 수:', base64Images.length);
  console.log('[analyzeProductImage] 템플릿:', template ? `${template.name} (${template.sections.length}개 섹션)` : '없음');
  console.log('[analyzeProductImage] 상품 정보:', productData?.productName || '없음');

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

    // ★ 사용자 입력 상품 정보 추가
    const productInfoSection = productData ? `
      ## PROVIDED PRODUCT INFORMATION (MUST USE):
      ${productData.productName ? `- Product Name: "${productData.productName}" - Use this EXACT name in productName field` : ''}
      ${productData.price ? `- Price: ${productData.price.toLocaleString()}원` : ''}
      ${productData.discountRate ? `- Discount Rate: ${productData.discountRate}%` : ''}
      ${productData.productFeatures ? `- Key Features (from seller):\n${productData.productFeatures}` : ''}
      ${productData.colorOptions?.length > 0 ? `- Available Colors: ${productData.colorOptions.map(c => c.colorName).join(', ')}` : ''}
    ` : '';

    prompt = `
      You are an expert e-commerce merchandiser. You MUST follow a STRICT template structure.
      
      ## CRITICAL RULES (MUST FOLLOW):
      1. You MUST generate EXACTLY ${sectionCount} sections - no more, no less.
      2. You MUST use these EXACT section IDs in order: [${sectionIds}]
      3. You MUST NOT add, remove, or reorder any sections.
      4. You MUST preserve the template's storyline flow exactly as given.
      ${productData?.productName ? `5. You MUST use "${productData.productName}" as the productName - do NOT make up a different name.` : ''}
      
      ${productInfoSection}
      
      ## Input:
      - Product Image(s): Photos of the product to sell
      - Template Structure (MUST FOLLOW EXACTLY):
      ${templateStructure}
      
      ## Your Tasks:
      1. Analyze ALL input images to understand the product thoroughly.
      2. ${productData?.productName ? `Use the provided product name "${productData.productName}" directly.` : 'Create a catchy product name in Korean.'}
      3. For EACH section in the template (in exact order):
         - Use the EXACT 'id' provided - do not change it
         - Write a compelling 'title' in Korean that fits the section's purpose
         - Write detailed 'content' in Korean based on the 'content_guideline'
         ${productData?.productFeatures ? '- Incorporate the provided key features into relevant sections' : ''}
         ${productData?.colorOptions?.length ? '- Mention available colors in color-related sections' : ''}
         - Create an 'imagePrompt' (Korean or English) that combines the 'visual_style' with the actual product
      
      ## Special Instructions:
      - If 'fixed_text' exists: You MUST include it prominently in the 'content'
      - If 'has_fixed_image' is true: Keep the 'imagePrompt' similar to the 'visual_style'
      ${productData?.price ? `- Include price "${productData.price.toLocaleString()}원" in relevant marketing content` : ''}
      ${productData?.discountRate ? `- Mention ${productData.discountRate}% discount prominently` : ''}
      
      ## CRITICAL - imagePrompt Guidelines:
      When creating 'imagePrompt', you MUST:
      - Always describe the SAME EXACT product from the uploaded images
      - Focus on changing ONLY: background, lighting, angle, props, scene
      - NEVER describe a different or modified product
      - The product must remain identical to the reference image
      - Example: "The same product on a marble surface, studio lighting, minimal background"
      
      ## Output Format:
      Return JSON with 'sections' array containing EXACTLY ${sectionCount} sections with matching IDs.
      ${productData?.productName ? `The 'productName' field MUST be exactly: "${productData.productName}"` : ''}
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
      
      ## CRITICAL MISSION:
      Your goal is to accurately translate foreign language text in product images to natural, persuasive Korean (의역 - free translation) while maintaining 100% visual consistency with the original images. The product and all visual elements must remain ABSOLUTELY IDENTICAL - only text language changes.
      
      ## Your Tasks:
      1. **Extract Content**: Analyze all images and extract:
         - All visible text content (product names, descriptions, features, prices, etc.)
         - Section structure and layout
         - Visual elements (product images, icons, graphics)
         - Text positions, sizes, styles, and colors (for accurate replacement)
      
      2. **Translate Content**: Convert all foreign language text into natural, persuasive Korean:
         - Use 의역 (free translation) for natural, marketing-effective Korean
         - Product names and descriptions: natural Korean or transliteration as appropriate
         - Marketing copy and features: persuasive and natural in Korean
         - Section titles and content: maintain original meaning and tone
         - Consider Korean market preferences and expressions
      
      3. **Maintain Structure**: Keep the original section flow and layout exactly as shown
      
      4. **Image Prompt Strategy** (CRITICAL for 'imagePrompt' field):
         For each section, analyze the image and determine:
         
         **Case A: Text is CLEAR and TRANSLATABLE (80%+ readable)**
         - If the text in the image is clearly readable and can be accurately translated:
           → Create an imagePrompt that instructs: "Recreate this EXACT layout with Korean text replacing the original text at the SAME position, size, and style"
           → Include the Korean translation in the prompt
           → Example format: "The EXACT same product and layout from the reference image, with Korean text '[translated text]' replacing the original text at [position], maintaining the same text size, style, and color"
         
         **Case B: Text is UNCLEAR or UNTRANSLATABLE (Default)**
         - If the text is blurry, low resolution, partially obscured, or cannot be accurately translated:
         - If text readability is less than 80%:
         - If translation is uncertain due to image quality:
           → Create an imagePrompt that instructs: "Remove ALL text from the image, keep ONLY the visual elements"
           → Example: "The EXACT same product and visual elements from the reference image without any text overlay, clean design, professional photography"
           → **DEFAULT ACTION: REMOVE TEXT** (this is the default when translation is uncertain)
         
         **Decision Rule**:
         - If you can clearly read and translate 80%+ of the text → Use Case A (TRANSLATE)
         - If text is unclear, blurry, or less than 80% readable → Use Case B (REMOVE TEXT) - DEFAULT
         - When in doubt → Use Case B (REMOVE TEXT) - this is the default
         - If image resolution is low → Use Case B (REMOVE TEXT)
         - If text is stylized graphics that are hard to translate → Use Case B (REMOVE TEXT)
      
      ## CRITICAL - imagePrompt Guidelines:
      When creating 'imagePrompt' for each section, you MUST:
      - **ABSOLUTELY MAINTAIN** the product/visual elements IDENTICAL to the original
      - The product's shape, color, design, texture must be EXACTLY the same
      - Background, layout, composition, lighting, shadows must remain EXACTLY the same
      - Camera angle, perspective, scene composition must be IDENTICAL
      - NEVER describe a different or modified product
      - For text handling:
        * If text is clear and translatable: "Korean text: '[translated text]' replacing original text at [position], same size/style/color"
        * If text is unclear/unt translatable: "No text overlay, clean image without text, EXACT same visual elements"
        * Default: Remove text when uncertain (REMOVE TEXT is the default)
      
      ## Output Requirements:
      - All 'title' and 'content' fields must be in Korean (translated from original using 의역)
      - 'imagePrompt' must clearly indicate:
        * Whether to include Korean text or remove text (default: remove if uncertain)
        * How to maintain 100% visual consistency with original
        * Exact text position, size, style if translating
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
        return applyTemplateStructure(analysis, template, productData);
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
      return applyTemplateStructure(analysis, template, productData);
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

    const analysisPrompt = `
You are an expert image analyzer and translator specializing in Korean localization.

## CRITICAL MISSION:
Your goal is to accurately translate foreign language text in product images to natural, persuasive Korean while maintaining 100% visual consistency with the original image.

## Analysis Tasks:
1. **Detect ALL visible text** in the image (any language: English, Chinese, Japanese, etc.)
   - Include text in product labels, descriptions, features, prices, etc.
   - Note the exact position, size, style, and color of each text element

2. **Assess text clarity and translatability:**
   - Can you clearly read 80%+ of the text? → TRANSLATABLE (preferred)
   - Is the text blurry, low resolution, or partially obscured? → REMOVE_TEXT
   - Is the text stylized graphics that are hard to translate? → REMOVE_TEXT

3. **If translatable, provide ACCURATE Korean translations:**
   - Use natural, persuasive Korean (의역 - free translation for marketing effectiveness)
   - Maintain the original meaning and tone
   - Consider Korean market preferences and expressions
   - For product names: use natural Korean or transliteration as appropriate
   - For marketing copy: make it persuasive and natural in Korean

4. **Document text details:**
   - Original text
   - Korean translation (의역)
   - Exact position description (top-left, center, bottom-right, etc.)
   - Text style hints (bold, italic, size, color if visible)

## Output JSON format:
{
  "action": "translate" | "remove",
  "detectedText": [
    {
      "original": "original text",
      "korean": "자연스럽고 설득력 있는 한국어 번역 (의역)",
      "position": "exact position description (e.g., 'top-center, above product', 'bottom-right corner')",
      "style": "text style hints if visible (e.g., 'bold white text', 'small gray text')"
    }
  ],
  "reason": "why translate or remove"
}
    `;

    // 분석 요청
    reportProgress('1단계', '텍스트 감지 및 번역 가능 여부 판단 중...');
    console.log('[editSingleImage] 1단계: 이미지 분석 시작', {
      model: MODEL_TEXT_VISION,
      hasImage: !!base64Image,
      imageSize: base64Image?.length || 0
    });

    // 이미지 분석은 시간이 걸릴 수 있으므로 명시적으로 3분 타임아웃 적용
    let analysisResult;
    try {
      analysisResult = await callGeminiViaProxy({
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
                    position: { type: "string" },
                    style: { type: "string" }
                  }
                }
              },
              reason: { type: "string" }
            },
            required: ["action", "detectedText", "reason"]
          },
          temperature: 0.3,
        }
      }, 180000); // 이미지 분석: 3분 타임아웃

      console.log('[editSingleImage] 1단계: 이미지 분석 완료', {
        hasResult: !!analysisResult,
        hasCandidates: !!analysisResult?.candidates,
        candidatesCount: analysisResult?.candidates?.length || 0
      });
    } catch (error) {
      console.error('[editSingleImage] 1단계: 이미지 분석 실패', error);
      reportProgress('오류', `이미지 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      throw error;
    }

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
        .map((item: any) => {
          const position = item.position || 'original position';
          const style = item.style ? ` (${item.style})` : '';
          return `"${item.original}" → "${item.korean}" at ${position}${style}`;
        })
        .join("\n   ");

      imagePrompt = `
## CRITICAL INSTRUCTIONS - MUST FOLLOW EXACTLY:

### 1. MAINTAIN 100% VISUAL CONSISTENCY WITH ORIGINAL IMAGE
   - The product's shape, color, design, texture, and ALL visual details must be IDENTICAL to the reference
   - Background, layout, composition, lighting, shadows, reflections must remain EXACTLY the same
   - Camera angle, perspective, and scene composition must be IDENTICAL
   - Do NOT modify, change, or replace ANY visual element except text
   - The image should look like the original with ONLY text changed

### 2. REPLACE TEXT WITH KOREAN TRANSLATIONS
   Replace the following foreign language text with Korean translations:
   ${translations}
   
   **Text Replacement Rules:**
   - Maintain the EXACT same text position as the original
   - Keep the same text size, font weight, and style
   - Preserve the same text color and effects (shadows, outlines, etc.)
   - Use natural, professional Korean typography that fits the design
   - Keep the same visual hierarchy and text alignment
   - If text was bold/italic in original, keep it bold/italic in Korean
   - Text should look like it was originally designed in Korean

### 3. FINAL CHECK
   - Compare side-by-side: Original vs. Edited
   - The ONLY difference should be the language of the text
   - Everything else (product, background, layout, colors, lighting) must be IDENTICAL
   - The edited image should be indistinguishable from the original except for text language

Generate the edited image with Korean text replacing the original text.
High quality, professional product photography. Pixel-perfect consistency with original.
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
      // 이미지 생성은 시간이 오래 걸리므로 명시적으로 5분 타임아웃 적용
      const result = await callGeminiViaProxy({
        model: MODEL_IMAGE_GEN,
        contents: { parts },
      }, 300000); // 이미지 생성: 5분 타임아웃

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
  mode: AppMode = AppMode.CREATION,
  modelSettings?: import('../types').ModelSettings
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
          prompt.toLowerCase().includes('clean image') ||
          prompt.toLowerCase().includes('text-free');

        const hasKoreanText = prompt.includes('한국어') ||
          prompt.includes('Korean text') ||
          prompt.match(/['"](.*?)['"]/); // 따옴표로 둘러싸인 텍스트

        if (shouldRemoveText) {
          // 텍스트 제거 모드
          fullPrompt = `
## CRITICAL INSTRUCTIONS FOR LOCALIZATION - MUST FOLLOW EXACTLY:

### 1. MAINTAIN 100% VISUAL CONSISTENCY WITH ORIGINAL IMAGE
   - The product's shape, color, design, texture, and ALL visual details must be IDENTICAL to the reference
   - Background, layout, composition, lighting, shadows, reflections must remain EXACTLY the same
   - Camera angle, perspective, and scene composition must be IDENTICAL
   - Do NOT modify, change, or replace ANY visual element except text
   - The image should look like the original with ONLY text removed

### 2. REMOVE ALL TEXT FROM THE IMAGE
   - Remove any text overlays, labels, or text elements
   - Keep only the visual elements (product, background, graphics)
   - Create a clean, text-free version
   - Fill any text areas naturally with background or product elements

### 3. FINAL CHECK
   - Compare side-by-side: Original vs. Edited
   - The ONLY difference should be the absence of text
   - Everything else (product, background, layout, colors, lighting) must be IDENTICAL
   - The edited image should be indistinguishable from the original except for text removal

Based on the reference image, recreate: ${prompt}
High quality, professional product photography without any text. Pixel-perfect consistency with original.
          `.trim();
        } else if (hasKoreanText) {
          // 한국어 텍스트 포함 모드
          fullPrompt = `
## CRITICAL INSTRUCTIONS FOR LOCALIZATION - MUST FOLLOW EXACTLY:

### 1. MAINTAIN 100% VISUAL CONSISTENCY WITH ORIGINAL IMAGE
   - The product's shape, color, design, texture, and ALL visual details must be IDENTICAL to the reference
   - Background, layout, composition, lighting, shadows, reflections must remain EXACTLY the same
   - Camera angle, perspective, and scene composition must be IDENTICAL
   - Do NOT modify, change, or replace ANY visual element except text
   - The image should look like the original with ONLY text language changed

### 2. REPLACE TEXT WITH KOREAN TRANSLATIONS
   - Remove original foreign language text
   - Add Korean text as specified in the prompt
   - Maintain the EXACT same text position, size, style, and color as the original
   - Use natural, professional Korean typography that fits the design
   - Keep the same visual hierarchy and text alignment
   - If text was bold/italic in original, keep it bold/italic in Korean
   - Text should look like it was originally designed in Korean

### 3. FINAL CHECK
   - Compare side-by-side: Original vs. Edited
   - The ONLY difference should be the language of the text
   - Everything else (product, background, layout, colors, lighting) must be IDENTICAL
   - The edited image should be indistinguishable from the original except for text language

Based on the reference image, recreate: ${prompt}
High quality, professional product photography with Korean text. Pixel-perfect consistency with original.
          `.trim();
        } else {
          // 기본: 텍스트 제거 (불확실한 경우)
          fullPrompt = `
## CRITICAL INSTRUCTIONS FOR LOCALIZATION - MUST FOLLOW EXACTLY:

### 1. MAINTAIN 100% VISUAL CONSISTENCY WITH ORIGINAL IMAGE
   - The product's shape, color, design, texture, and ALL visual details must be IDENTICAL to the reference
   - Background, layout, composition, lighting, shadows, reflections must remain EXACTLY the same
   - Camera angle, perspective, and scene composition must be IDENTICAL
   - Do NOT modify, change, or replace ANY visual element except text
   - The image should look like the original with ONLY text removed

### 2. DEFAULT ACTION: REMOVE ALL TEXT (When translation is uncertain)
   - Remove any text overlays, labels, or text elements
   - Keep only the visual elements (product, background, graphics)
   - Create a clean, text-free version
   - Fill any text areas naturally with background or product elements

### 3. FINAL CHECK
   - Compare side-by-side: Original vs. Edited
   - The ONLY difference should be the absence of text
   - Everything else (product, background, layout, colors, lighting) must be IDENTICAL

Based on the reference image, recreate: ${prompt}
High quality, professional product photography without any text overlay. Pixel-perfect consistency with original.
          `.trim();
        }
      } else {
        // 모델 설정을 프롬프트에 추가
        const modelDescription = buildModelDescription(modelSettings);

        fullPrompt = `
CRITICAL INSTRUCTION: You MUST keep the EXACT same product from the reference image.
- The product's shape, color, design, texture, and all visual details must be IDENTICAL to the reference
- Do NOT change, modify, or replace the product in any way
- You may change: background, lighting, camera angle, props, scene composition${modelDescription ? ', and HUMAN MODEL appearance' : ''}
- The product must be clearly recognizable as the SAME item from the reference

${modelDescription ? `## CRITICAL MODEL REQUIREMENTS (MUST FOLLOW):
- REPLACE any model in the reference image with: ${modelDescription}
- The product must be worn/held by this NEW model naturally
- KEEP the product identical, but CHANGE the model as requested
` : ''}

Generate a professional product photo with these specifications:
${prompt}

REMEMBER: The product itself must remain EXACTLY as shown in the reference image.
High quality, 4K resolution, professional e-commerce photography.
        `.trim();
      }
    } else {
      // 원본 이미지가 없는 경우 - 모델 설정 적용
      const modelDescription = buildModelDescription(modelSettings);
      fullPrompt = `Professional product photography, high quality, 4k: ${prompt}${modelDescription ? `\n\nModel requirements: ${modelDescription}` : ''}`;
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