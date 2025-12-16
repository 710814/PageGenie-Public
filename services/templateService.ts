import { Template } from "../types";

const TEMPLATE_STORAGE_KEY = 'gemini_commerce_templates';

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