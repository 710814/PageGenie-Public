import React from 'react';
import { Type, Image, LayoutGrid, Columns, MoveUp, MoveDown, Check, ImageIcon, Trash2, Copy } from 'lucide-react';
import { SectionData } from '../types';

interface SectionMiniMapProps {
    sections: SectionData[];
    activeSectionId?: string;
    onSectionClick: (sectionId: string) => void;
    onMoveSection: (index: number, direction: 'up' | 'down') => void;
    onDeleteSection?: (index: number) => void;
}

// 섹션 타입에 따른 한글 라벨과 아이콘
const getSectionTypeInfo = (layoutType: string) => {
    switch (layoutType) {
        case 'text-only':
            return { label: '텍스트', icon: Type, color: 'text-gray-500 bg-gray-100' };
        case 'full-width':
            return { label: '전체', icon: Image, color: 'text-blue-600 bg-blue-100' };
        case 'split-left':
            return { label: '좌측', icon: Columns, color: 'text-purple-600 bg-purple-100' };
        case 'split-right':
            return { label: '우측', icon: Columns, color: 'text-purple-600 bg-purple-100' };
        case 'grid-2':
            return { label: '2열', icon: LayoutGrid, color: 'text-green-600 bg-green-100' };
        case 'grid-3':
            return { label: '3열', icon: LayoutGrid, color: 'text-green-600 bg-green-100' };
        default:
            return { label: '기타', icon: Image, color: 'text-gray-500 bg-gray-100' };
    }
};

// 이미지 생성 완료 여부 확인
const hasImageGenerated = (section: SectionData): boolean => {
    if (section.layoutType === 'text-only') return true; // 텍스트 전용은 항상 완료
    if (section.imageUrl) return true;
    if (section.imageSlots?.some(slot => slot.imageUrl)) return true;
    return false;
};

export const SectionMiniMap: React.FC<SectionMiniMapProps> = ({
    sections,
    activeSectionId,
    onSectionClick,
    onMoveSection,
    onDeleteSection
}) => {
    // 이미지 생성 진행률 계산
    const completedCount = sections.filter(hasImageGenerated).length;
    const progressPercent = sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* 헤더 + 진행률 */}
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-white border-b">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center">
                        <LayoutGrid className="w-4 h-4 mr-2 text-indigo-600" />
                        섹션 구조
                    </h3>
                    <span className="text-xs font-medium text-gray-500">
                        {completedCount}/{sections.length}
                    </span>
                </div>
                {/* 진행률 바 */}
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* 섹션 목록 */}
            <div className="p-3 space-y-2 max-h-[450px] overflow-y-auto custom-scrollbar">
                {sections.map((section, index) => {
                    const isActive = section.id === activeSectionId;
                    const typeInfo = getSectionTypeInfo(section.layoutType || 'full-width');
                    const TypeIcon = typeInfo.icon;
                    const isCompleted = hasImageGenerated(section);

                    return (
                        <div
                            key={section.id}
                            className={`
                                group relative rounded-xl px-4 py-4 cursor-pointer transition-all duration-200
                                ${isActive
                                    ? 'bg-blue-50 border-2 border-blue-400 shadow-md'
                                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                }
                            `}
                            onClick={() => onSectionClick(section.id)}
                        >
                            {/* 메인 라인: 번호 + 타입 아이콘 + 제목 */}
                            <div className="flex items-center gap-2">
                                {/* 번호 (원형) */}
                                <span className={`
                                    text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0
                                    ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}
                                `}>
                                    {index + 1}
                                </span>

                                {/* 타입 배지 */}
                                <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-md flex-shrink-0 bg-blue-100 text-blue-600 border border-blue-300">
                                    <TypeIcon className="w-3.5 h-3.5" />
                                    {typeInfo.label}
                                </span>

                                {/* 섹션 제목 */}
                                <span className="flex-1 text-sm text-gray-800 font-medium truncate">
                                    {section.title || '(제목 없음)'}
                                </span>

                                {/* 완료 체크 */}
                                {isCompleted && section.layoutType !== 'text-only' && (
                                    <span className="flex-shrink-0 w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
                                        <Check className="w-2.5 h-2.5 text-green-600" />
                                    </span>
                                )}
                            </div>

                            {/* 호버 시 액션 버튼 */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMoveSection(index, 'up'); }}
                                    disabled={index === 0}
                                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="위로 이동"
                                >
                                    <MoveUp className="w-3 h-3 text-gray-500" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMoveSection(index, 'down'); }}
                                    disabled={index === sections.length - 1}
                                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="아래로 이동"
                                >
                                    <MoveDown className="w-3 h-3 text-gray-500" />
                                </button>
                                {onDeleteSection && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteSection(index); }}
                                        className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500"
                                        title="삭제"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
