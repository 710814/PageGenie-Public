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
 * @param categoryId 카테고리 ID (예: 'fashion', 'beauty')
 * @returns SectionData 배열
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
 * @param name 템플릿 이름
 * @param categoryId 선택적 카테고리 ID
 * @returns 새 Template 객체
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
    // 이미 존재하는 ID라면 업데이트 (수정)
    updatedTemplates = [...templates];
    updatedTemplates[existingIndex] = template;
  } else {
    // 새로운 템플릿이라면 추가
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