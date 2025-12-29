import { Template, SectionData, SectionType, LayoutType } from "../types";
import { CATEGORY_PRESETS, CategoryPreset } from "./categoryPresets";

const TEMPLATE_STORAGE_KEY = 'gemini_commerce_templates';

/**
 * 기본 빈 섹션 생성
 */
export const createDefaultSection = (): SectionData => ({
  id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  title: '새 섹션',
  content: '섹션 내용을 입력하세요',
  imagePrompt: 'Professional product photography, clean background',
  sectionType: 'custom' as SectionType,
  layoutType: 'full-width' as LayoutType,
});

/**
 * 섹션 제목을 SectionType으로 매핑
 */
const mapTitleToSectionType = (title: string): SectionType => {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('타이틀') || titleLower.includes('상품명')) return 'title';
  if (titleLower.includes('메인') || titleLower.includes('비주얼') || titleLower.includes('hero')) return 'hero';
  if (titleLower.includes('설명') || titleLower.includes('소개')) return 'description';
  if (titleLower.includes('색상') || titleLower.includes('컬러')) return 'colors';
  if (titleLower.includes('소재') || titleLower.includes('원단') || titleLower.includes('디테일')) return 'material_detail';
  if (titleLower.includes('스타일') || titleLower.includes('코디')) return 'styling';
  if (titleLower.includes('핏') || titleLower.includes('사이즈') || titleLower.includes('착용')) return 'fit';
  if (titleLower.includes('스펙') || titleLower.includes('사양') || titleLower.includes('성분') || titleLower.includes('영양')) return 'spec';
  if (titleLower.includes('안내') || titleLower.includes('주의') || titleLower.includes('케어') || titleLower.includes('보관') || titleLower.includes('인증')) return 'notice';
  return 'custom';
};

/**
 * 카테고리 프리셋을 SectionData 배열로 변환
 */
export const getCategoryPresetSections = (categoryId: string): SectionData[] => {
  const preset = CATEGORY_PRESETS[categoryId];
  if (!preset) {
    return [createDefaultSection()];
  }

  return preset.sections.map((section, index) => ({
    id: `sec-${Date.now()}-${index}`,
    title: section.title,
    content: section.purpose,
    imagePrompt: section.imageStyle,
    sectionType: mapTitleToSectionType(section.title),
    layoutType: 'full-width' as LayoutType,
  }));
};

/**
 * 새 빈 템플릿 생성
 */
export const createNewTemplate = (name: string = '새 템플릿', categoryId?: string): Template => {
  return {
    id: `tpl-${Date.now()}`,
    name,
    description: categoryId
      ? `${CATEGORY_PRESETS[categoryId]?.name || ''} 카테고리 기반 템플릿`
      : '사용자 정의 템플릿',
    sections: categoryId
      ? getCategoryPresetSections(categoryId)
      : [createDefaultSection()],
    createdAt: Date.now(),
    category: categoryId,
  };
};

/**
 * 저장된 모든 템플릿 가져오기
 */
export const getTemplates = (): Template[] => {
  const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to parse templates", e);
    return [];
  }
};

/**
 * 템플릿 저장하기 (추가 또는 수정)
 */
export const saveTemplate = (template: Template) => {
  const templates = getTemplates();
  const existingIndex = templates.findIndex(t => t.id === template.id);

  let updatedTemplates: Template[];

  if (existingIndex >= 0) {
    updatedTemplates = [...templates];
    updatedTemplates[existingIndex] = template;
  } else {
    updatedTemplates = [...templates, template];
  }

  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updatedTemplates));
};

/**
 * 템플릿 삭제하기
 */
export const deleteTemplate = (id: string) => {
  const templates = getTemplates();
  const updated = templates.filter(t => t.id !== id);
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updated));
};

// ============================================
// 빌트인 프리셋 템플릿 (Built-in Preset Templates)
// ============================================

/**
 * 모델컷 공통 스타일 프롬프트 (얼굴 완전 익명 + 실제 인간 모델 필수)
 */
const ANONYMOUS_MODEL_STYLE = 'MUST be a REAL HUMAN MODEL wearing the garment (NOT mannequin, NOT ghost mannequin, NOT flat-lay, NOT product only), face cropped out above the neck showing only from shoulders/collar down, no face visible, human body posture and natural skin texture visible, fashion lookbook style photography';

/**
 * 네거티브 프롬프트 (생성하면 안되는 요소)
 */
const NEGATIVE_ELEMENTS = 'NO mannequin, NO ghost mannequin, NO invisible model, NO floating clothes, NO flat-lay, NO product-only shot, NO headless dummy';

/**
 * 패션 룩북 템플릿 - 컬러별 3장씩 모델컷 (정면전신, 상반신포즈, 상반신뒷모습)
 */
export const FASHION_LOOKBOOK_TEMPLATE: Template = {
  id: 'tpl-fashion-lookbook-preset',
  name: '패션 룩북 (얼굴 익명)',
  description: '모델컷 중심의 의류 상세페이지. 컬러옵션별 3장씩 모델컷 (총 9장). 얼굴이 완전히 보이지 않는 익명 스타일.',
  category: 'fashion',
  createdAt: 1703836800000,
  sections: [
    // 섹션 1: 메인 비주얼
    {
      id: 'sec-lookbook-1',
      title: '메인 비주얼',
      content: '상품의 분위기와 감성을 전달하는 대표 이미지입니다.',
      sectionType: 'hero' as SectionType,
      layoutType: 'full-width' as LayoutType,
      imagePrompt: `REAL HUMAN MODEL wearing the product, fashion lookbook hero shot, upper body shot from shoulders down, ${ANONYMOUS_MODEL_STYLE}, soft natural lighting, clean white studio background, high-end fashion magazine aesthetic, elegant pose, ${NEGATIVE_ELEMENTS}, MUST maintain exact product design from reference`
    },
    // 섹션 2: 인트로 (text-only)
    {
      id: 'sec-lookbook-2',
      title: '인트로',
      content: '상품의 무드, 컨셉, 주요 셀링 포인트를 간결한 문구로 설명합니다.\\n\\n예: "클래식한 트위드 소재와 모던한 실루엣의 조화. 격식 있는 자리부터 데일리 룩까지 다양하게 연출 가능합니다."',
      sectionType: 'description' as SectionType,
      layoutType: 'text-only' as LayoutType,
      imagePrompt: ''
    },
    // 섹션 3: 컬러1 스타일링 (세로 3장)
    {
      id: 'sec-lookbook-3',
      title: '{{COLOR_1}} 스타일링',
      content: '첫 번째 컬러옵션의 다양한 착장 모습입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'grid-1' as LayoutType,
      imagePrompt: `All 3 images MUST show {{COLOR_1}} colored product with IDENTICAL design`,
      imageSlots: [
        { id: 'slot-3-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_1}} colored product, FRONT FULL BODY shot from shoulders to feet, ${ANONYMOUS_MODEL_STYLE}, natural standing pose with visible arms and legs, clean white studio background, high-end fashion editorial, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference`, photographyStyle: 'full-body' },
        { id: 'slot-3-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_1}} colored product, UPPER BODY shot from shoulders to waist, ${ANONYMOUS_MODEL_STYLE}, dynamic pose with crossed arms or touching collar, visible human hands and skin, soft studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference`, photographyStyle: 'close-up' },
        { id: 'slot-3-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_1}} colored product, BACK VIEW showing model's back and shoulders, ${ANONYMOUS_MODEL_STYLE}, slight head turn or looking over shoulder pose, visible human body silhouette, studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference`, photographyStyle: 'close-up' }
      ]
    },
    // 섹션 4: 컬러2 스타일링 (세로 3장)
    {
      id: 'sec-lookbook-4',
      title: '{{COLOR_2}} 스타일링',
      content: '두 번째 컬러옵션의 다양한 착장 모습입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'grid-1' as LayoutType,
      imagePrompt: `All 3 images MUST show {{COLOR_2}} colored product with IDENTICAL design`,
      imageSlots: [
        { id: 'slot-4-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_2}} colored product, FRONT FULL BODY shot from shoulders to feet, ${ANONYMOUS_MODEL_STYLE}, relaxed pose with one hand in pocket, clean white studio background, high-end fashion editorial, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference`, photographyStyle: 'full-body' },
        { id: 'slot-4-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_2}} colored product, UPPER BODY shot from shoulders to waist, ${ANONYMOUS_MODEL_STYLE}, casual pose with hands together, visible human hands and skin, soft studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference`, photographyStyle: 'close-up' },
        { id: 'slot-4-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_2}} colored product, BACK VIEW showing model's back and shoulders, ${ANONYMOUS_MODEL_STYLE}, walking away or turning pose, visible human body from behind, studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference`, photographyStyle: 'close-up' }
      ]
    },
    // 섹션 5: 컬러3 스타일링 (세로 3장)
    {
      id: 'sec-lookbook-5',
      title: '{{COLOR_3}} 스타일링',
      content: '세 번째 컬러옵션의 다양한 착장 모습입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'grid-1' as LayoutType,
      imagePrompt: `All 3 images MUST show {{COLOR_3}} colored product with IDENTICAL design`,
      imageSlots: [
        { id: 'slot-5-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_3}} colored product, FRONT FULL BODY shot from shoulders to feet, ${ANONYMOUS_MODEL_STYLE}, confident standing pose with casual lean, clean white studio background, high-end fashion editorial, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference`, photographyStyle: 'full-body' },
        { id: 'slot-5-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_3}} colored product, UPPER BODY shot from shoulders to waist, ${ANONYMOUS_MODEL_STYLE}, natural pose adjusting sleeve, visible human hands and arms, soft studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference`, photographyStyle: 'close-up' },
        { id: 'slot-5-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_3}} colored product, BACK VIEW showing model's back and shoulders, ${ANONYMOUS_MODEL_STYLE}, three-quarter back view, visible human body silhouette from behind, studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference`, photographyStyle: 'close-up' }
      ]
    },
    // 섹션 6: 디테일 클로즈업
    {
      id: 'sec-lookbook-6',
      title: '디테일 클로즈업',
      content: '원단의 질감, 단추, 마감 등 디테일을 확대하여 보여줍니다.',
      sectionType: 'material_detail' as SectionType,
      layoutType: 'grid-2' as LayoutType,
      imagePrompt: 'Product detail close-up shots, showing fabric texture, buttons, stitching',
      imageSlots: [
        { id: 'slot-6-1', slotType: 'detail', prompt: 'Extreme close-up of fabric texture, showing weave pattern and material quality, soft focus background, studio macro photography', photographyStyle: 'close-up' },
        { id: 'slot-6-2', slotType: 'detail', prompt: 'Close-up of button details and collar/neckline finishing, showing craftsmanship and quality stitching, studio lighting', photographyStyle: 'close-up' }
      ]
    },
    // 섹션 7: 제품 정보 (text-only)
    {
      id: 'sec-lookbook-7',
      title: '제품 정보',
      content: '사이즈 가이드와 소재 정보를 텍스트로 안내합니다.\\n\\n**소재**: 폴리에스터 70%, 아크릴 20%, 울 10%\\n**두께감**: 중간 / **비침**: 없음 / **신축성**: 약간 있음\\n\\n**사이즈 (cm)**\\n| 사이즈 | 어깨 | 가슴 | 소매 | 총장 |\\n|--------|------|------|------|------|\\n| S | 38 | 94 | 58 | 52 |\\n| M | 40 | 98 | 59 | 54 |\\n| L | 42 | 102 | 60 | 56 |',
      sectionType: 'spec' as SectionType,
      layoutType: 'text-only' as LayoutType,
      imagePrompt: ''
    }
  ]
};

/**
 * 빌트인 템플릿 ID 목록
 */
const BUILT_IN_TEMPLATE_IDS = [
  'tpl-fashion-lookbook-preset'
];

/**
 * 빌트인 템플릿 초기화 - 앱 시작 시 호출
 */
export const initializeBuiltInTemplates = () => {
  const existingTemplates = getTemplates();
  const existingIds = new Set(existingTemplates.map(t => t.id));

  // 패션 룩북 템플릿이 없으면 추가
  if (!existingIds.has(FASHION_LOOKBOOK_TEMPLATE.id)) {
    saveTemplate(FASHION_LOOKBOOK_TEMPLATE);
    console.log('[TemplateService] Built-in template added:', FASHION_LOOKBOOK_TEMPLATE.name);
  }
};