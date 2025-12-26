import React from 'react';
import { Image, LayoutGrid, Type, Columns } from 'lucide-react';
import { SectionData } from '../types';

interface SectionMiniMapProps {
    sections: SectionData[];
    activeSectionId?: string;
    onSectionClick: (sectionId: string) => void;
    onMoveSection: (index: number, direction: 'up' | 'down') => void;
    onDeleteSection?: (index: number) => void;
}

// 섹션 타입 배지 스타일 (통일감 있게)
const getBadgeStyle = (layoutType: string) => {
    // 모든 배지를 연한 파란색 톤으로 통일하여 깔끔함 유지
    return {
        icon: layoutType === 'text-only' ? Type :
            layoutType.includes('grid') ? LayoutGrid :
                layoutType.includes('split') ? Columns : Image,
        label: layoutType === 'text-only' ? '텍스트' :
            layoutType === 'grid-2' ? '2열' :
                layoutType === 'grid-3' ? '3열' :
                    layoutType.includes('split') ? '분할' : '전체',
        className: 'bg-blue-50/80 border border-blue-200 text-blue-600'
    };
};

// 이미지 생성 완료 여부
const hasImageGenerated = (section: SectionData): boolean => {
    if (section.layoutType === 'text-only') return true;
    if (section.imageUrl) return true;
    if (section.imageSlots?.some(slot => slot.imageUrl)) return true;
    return false;
};

export const SectionMiniMap: React.FC<SectionMiniMapProps> = ({
    sections,
    activeSectionId,
    onSectionClick
}) => {
    const completedCount = sections.filter(hasImageGenerated).length;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* 헤더 (콤팩트) */}
            <div className="px-4 py-3 border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-800 flex items-center">
                        <LayoutGrid className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                        섹션 구조
                    </h3>
                    <span className="text-[10px] font-medium text-gray-400">
                        {completedCount}/{sections.length}
                    </span>
                </div>
            </div>

            {/* 섹션 목록 (콤팩트 & 세련됨) */}
            <div className="p-2 space-y-1.5 max-h-[450px] overflow-y-auto custom-scrollbar">
                {sections.map((section, index) => {
                    const isActive = section.id === activeSectionId;
                    const badge = getBadgeStyle(section.layoutType || 'full-width');
                    const BadgeIcon = badge.icon;

                    return (
                        <div
                            key={section.id}
                            className={`
                                flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200
                                ${isActive
                                    ? 'bg-white border border-blue-500 shadow-sm z-10'
                                    : 'bg-gray-50/80 border border-transparent hover:bg-gray-100 hover:border-gray-200'
                                }
                            `}
                            onClick={() => onSectionClick(section.id)}
                        >
                            {/* 번호 (콤팩트 원형) */}
                            <span className={`
                                w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors
                                ${isActive
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-gray-200 text-gray-500' // 무채색 회색
                                }
                            `}>
                                {index + 1}
                            </span>

                            {/* 배지 (심플 & 통일) */}
                            <span className={`
                                flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 transition-colors
                                ${badge.className}
                            `}>
                                <BadgeIcon className="w-3 h-3" />
                                {badge.label}
                            </span>

                            {/* 제목 (깔끔한 폰트) */}
                            <span className={`
                                flex-1 text-xs truncate transition-colors
                                ${isActive ? 'text-gray-900 font-semibold' : 'text-gray-600 font-medium'}
                            `}>
                                {section.title || '(제목 없음)'}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
