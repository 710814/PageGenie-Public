import { SectionPreset } from "../types";

const PRESET_STORAGE_KEY = 'gemini_commerce_section_presets';

/**
 * 저장된 모든 섹션 프리셋 가져오기
 */
export const getSectionPresets = (): SectionPreset[] => {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error("Failed to parse section presets", e);
        return [];
    }
};

/**
 * 섹션 프리셋 저장하기 (추가 또는 수정)
 */
export const saveSectionPreset = (preset: SectionPreset) => {
    const presets = getSectionPresets();
    const existingIndex = presets.findIndex(p => p.id === preset.id);

    let updatedPresets: SectionPreset[];

    if (existingIndex >= 0) {
        // 이미 존재하는 ID라면 업데이트 (수정)
        updatedPresets = [...presets];
        updatedPresets[existingIndex] = preset;
    } else {
        // 새로운 프리셋이라면 추가
        updatedPresets = [...presets, preset];
    }

    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(updatedPresets));
};

/**
 * 섹션 프리셋 삭제하기
 */
export const deleteSectionPreset = (id: string) => {
    const presets = getSectionPresets();
    const updated = presets.filter(p => p.id !== id);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(updated));
};
