import React from 'react';
import { Image, LayoutGrid, Type, Columns, MoveUp, MoveDown, Trash2 } from 'lucide-react';
import { SectionData } from '../types';

interface SectionMiniMapProps {
    sections: SectionData[];
    activeSectionId?: string;
    onSectionClick: (sectionId: string) => void;
    onMoveSection: (index: number, direction: 'up' | 'down') => void;
    onDeleteSection?: (index: number) => void;
}

// 레이아웃 배지 정보
const getBadgeInfo = (layoutType: string) => {
    switch (layoutType) {
        case 'text-only':
            return { icon: Type, label: '텍스트' };
        case 'full-width':
            return { icon: Image, label: '전체' };
        case 'split-left':
        case 'split-right':
            return { icon: Columns, label: '분할' };
        case 'grid-2':
            return { icon: LayoutGrid, label: '2열' };
        case 'grid-3':
            return { icon: LayoutGrid, label: '3열' };
        default:
            return { icon: Image, label: '전체' };
    }
};

// 이미지 완료 여부
const hasImage = (section: SectionData): boolean => {
    if (section.layoutType === 'text-only') return true;
    return !!(section.imageUrl || section.imageSlots?.some(s => s.imageUrl));
};

export const SectionMiniMap: React.FC<SectionMiniMapProps> = ({
    sections,
    activeSectionId,
    onSectionClick,
    onMoveSection,
    onDeleteSection
}) => {
    const done = sections.filter(hasImage).length;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4 text-gray-500" />
                        섹션 구조
                    </h3>
                    <span className="text-xs text-gray-400">{done}/{sections.length}</span>
                </div>
                {/* 진행률 바 */}
                <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${sections.length ? (done / sections.length) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* 섹션 목록 */}
            <div className="p-3 space-y-2">
                {sections.map((section, i) => {
                    const active = section.id === activeSectionId;
                    const badge = getBadgeInfo(section.layoutType || 'full-width');
                    const Icon = badge.icon;

                    return (
                        <div
                            key={section.id}
                            onClick={() => onSectionClick(section.id)}
                            className={`
                                group relative flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all
                                ${active
                                    ? 'bg-white border-2 border-blue-500 shadow-sm'
                                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                }
                            `}
                        >
                            {/* 번호 */}
                            <span className={`
                                w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold shrink-0
                                ${active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}
                            `}>
                                {i + 1}
                            </span>

                            {/* 배지 */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-blue-50 border-blue-200 text-blue-600 text-[11px] font-semibold shrink-0">
                                <Icon className="w-3 h-3" />
                                {badge.label}
                            </span>

                            {/* 제목 */}
                            <span className={`text-sm truncate flex-1 ${active ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                                {section.title || '(제목 없음)'}
                            </span>

                            {/* 호버 액션 버튼 (복원) */}
                            <div className="absolute right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-[2px] rounded-lg p-1 shadow-sm border border-gray-100">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMoveSection(i, 'up'); }}
                                    disabled={i === 0}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    title="위로"
                                >
                                    <MoveUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMoveSection(i, 'down'); }}
                                    disabled={i === sections.length - 1}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    title="아래로"
                                >
                                    <MoveDown className="w-3.5 h-3.5" />
                                </button>
                                {onDeleteSection && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteSection(i); }}
                                        className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                                        title="삭제"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
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
