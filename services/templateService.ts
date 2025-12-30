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
 * ★ 빌트인 템플릿: 사용자 수정 버전이 있으면 그것을 사용, 없으면 코드 버전 사용
 */
export const getTemplates = (): Template[] => {
  const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
  let userTemplates: Template[] = [];

  if (stored) {
    try {
      userTemplates = JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse templates", e);
      userTemplates = [];
    }
  }

  // ★ 빌트인 템플릿 목록
  const builtInTemplates = [FASHION_LOOKBOOK_TEMPLATE];
  const builtInIds = new Set(builtInTemplates.map(t => t.id));

  // localStorage에 빌트인 템플릿 ID가 있는지 확인 (사용자 수정 버전)
  const userModifiedBuiltInIds = new Set(
    userTemplates.filter(t => builtInIds.has(t.id)).map(t => t.id)
  );

  // 사용자가 수정하지 않은 빌트인 템플릿만 코드 버전 추가
  const codeBuildIns = builtInTemplates.filter(t => !userModifiedBuiltInIds.has(t.id));

  // 결과: 코드 빌트인(수정 안된 것) + 사용자 템플릿(수정된 빌트인 포함)
  const result = [...codeBuildIns, ...userTemplates];

  return result;
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
 * ★ Gemini 권장사항 적용: 시맨틱 네거티브 대신 긍정적 표현 사용
 */
const ANONYMOUS_MODEL_STYLE = 'A REAL HUMAN MODEL with visible natural skin texture and realistic body proportions is wearing this garment. The model has a natural human posture with arms and torso clearly visible. Face is cropped at NOSE level showing FULL NECKLINE, COLLAR, visible chin, lips, and jawline. This is a fashion editorial photo featuring a living person, like a magazine lookbook shoot';

/**
 * 네거티브 프롬프트 -> 긍정적 설명으로 변경
 * ★ "마네킹이 아니다" 대신 "이것은 실제 인간이 착용한 패션 사진이다" 형태로 강조
 */
const NEGATIVE_ELEMENTS = 'This must be a photo of a REAL PERSON wearing the garment with visible human skin, natural body movement, and realistic fabric draping. The entire product must be fully visible without any cropping. Show the complete garment from neckline to hem';

/**
 * 패션 룩북 템플릿 - 컬러별 3장씩 모델컷 (정면전신, 상반신포즈, 상반신뒷모습)
 */
export const FASHION_LOOKBOOK_TEMPLATE: Template = {
  id: 'tpl-fashion-lookbook-preset',
  name: '패션 룩북 (얼굴 익명)',
  description: '모델컷 중심의 의류 상세페이지. 컬러옵션별 3장씩 모델컷 (총 9장). 얼굴이 완전히 보이지 않는 익명 스타일.',
  category: 'fashion',
  isBuiltin: true,
  createdAt: 1703836800000,
  sections: [
    // 섹션 1: 메인 비주얼
    {
      id: 'sec-lookbook-1',
      title: '메인 비주얼',
      content: '상품의 분위기와 감성을 전달하는 대표 이미지입니다.',
      sectionType: 'hero' as SectionType,
      layoutType: 'full-width' as LayoutType,
      imagePrompt: `REAL HUMAN MODEL wearing the product, fashion lookbook hero shot, upper body shot from CHIN down showing full neckline, ${ANONYMOUS_MODEL_STYLE}, soft natural lighting, clean white studio background, high-end fashion magazine aesthetic, elegant pose, ${NEGATIVE_ELEMENTS}, MUST maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`
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
        { id: 'slot-3-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_1}} colored product, FRONT FULL BODY shot, ${ANONYMOUS_MODEL_STYLE}, natural standing pose with visible arms and legs, clean white studio background, high-end fashion editorial, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' },
        { id: 'slot-3-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_1}} colored product, UPPER BODY shot from CHIN down showing full neck, ${ANONYMOUS_MODEL_STYLE}, dynamic pose with crossed arms or touching collar, visible human hands and skin, soft studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' },
        { id: 'slot-3-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_1}} colored product, EITHER Back View OR Side Profile based on reference context: IF reference shows back design -> Generate BACK VIEW. IF reference only shows front -> Generate SIDE PROFILE or 45-degree angle shot showing styling variety. ${ANONYMOUS_MODEL_STYLE}, visible human body silhouette, studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' }
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
        { id: 'slot-4-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_2}} colored product, FRONT FULL BODY shot, ${ANONYMOUS_MODEL_STYLE}, relaxed pose with one hand in pocket, clean white studio background, high-end fashion editorial, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' },
        { id: 'slot-4-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_2}} colored product, UPPER BODY shot from CHIN down showing full neck, ${ANONYMOUS_MODEL_STYLE}, casual pose with hands together, visible human hands and skin, soft studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' },
        { id: 'slot-4-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_2}} colored product, EITHER Back View OR Side Profile based on reference context: IF reference shows back design -> Generate BACK VIEW. IF reference only shows front -> Generate SIDE PROFILE or 45-degree angle shot showing styling variety. ${ANONYMOUS_MODEL_STYLE}, visible human body silhouette, studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' }
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
        { id: 'slot-5-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_3}} colored product, FRONT FULL BODY shot, ${ANONYMOUS_MODEL_STYLE}, confident standing pose with casual lean, clean white studio background, high-end fashion editorial, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' },
        { id: 'slot-5-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_3}} colored product, UPPER BODY shot from CHIN down showing full neck, ${ANONYMOUS_MODEL_STYLE}, natural pose adjusting sleeve, visible human hands and arms, soft studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' },
        { id: 'slot-5-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_3}} colored product, EITHER Back View OR Side Profile based on reference context: IF reference shows back design -> Generate BACK VIEW. IF reference only shows front -> Generate SIDE PROFILE or 45-degree angle shot showing styling variety. ${ANONYMOUS_MODEL_STYLE}, visible human body silhouette, studio lighting, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' }
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