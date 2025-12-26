import React from 'react';
import { Type, Image, LayoutGrid, Columns, GripVertical, MoveUp, MoveDown } from 'lucide-react';
import { SectionData } from '../types';

interface SectionMiniMapProps {
    sections: SectionData[];
    activeSectionId?: string;
    onSectionClick: (sectionId: string) => void;
    onMoveSection: (index: number, direction: 'up' | 'down') => void;
}

// 레이아웃 타입별 시각적 표현
const LayoutPreview: React.FC<{ layoutType: string }> = ({ layoutType }) => {
    const baseClass = "w-full h-8 flex items-center gap-1 p-1 rounded bg-gray-100";

    switch (layoutType) {
        case 'text-only':
            return (
                <div className={baseClass}>
                    <div className="flex-1 h-1.5 bg-gray-300 rounded" />
                    <div className="flex-1 h-1.5 bg-gray-300 rounded" />
                </div>
            );
        case 'full-width':
            return (
                <div className={baseClass}>
                    <div className="flex-1 h-full bg-blue-200 rounded flex items-center justify-center">
                        <Image className="w-3 h-3 text-blue-500" />
                    </div>
                </div>
            );
        case 'split-left':
            return (
                <div className={baseClass}>
                    <div className="w-1/2 h-full bg-blue-200 rounded flex items-center justify-center">
                        <Image className="w-3 h-3 text-blue-500" />
                    </div>
                    <div className="w-1/2 h-full flex flex-col gap-0.5 justify-center">
                        <div className="h-1 bg-gray-300 rounded" />
                        <div className="h-1 bg-gray-300 rounded w-3/4" />
                    </div>
                </div>
            );
        case 'split-right':
            return (
                <div className={baseClass}>
                    <div className="w-1/2 h-full flex flex-col gap-0.5 justify-center">
                        <div className="h-1 bg-gray-300 rounded" />
                        <div className="h-1 bg-gray-300 rounded w-3/4" />
                    </div>
                    <div className="w-1/2 h-full bg-blue-200 rounded flex items-center justify-center">
                        <Image className="w-3 h-3 text-blue-500" />
                    </div>
                </div>
            );
        case 'grid-2':
            return (
                <div className={baseClass}>
                    <div className="w-1/2 h-full bg-blue-200 rounded flex items-center justify-center">
                        <Image className="w-2.5 h-2.5 text-blue-500" />
                    </div>
                    <div className="w-1/2 h-full bg-blue-200 rounded flex items-center justify-center">
                        <Image className="w-2.5 h-2.5 text-blue-500" />
                    </div>
                </div>
            );
        case 'grid-3':
            return (
                <div className={baseClass}>
                    <div className="flex-1 h-full bg-blue-200 rounded flex items-center justify-center">
                        <Image className="w-2 h-2 text-blue-500" />
                    </div>
                    <div className="flex-1 h-full bg-blue-200 rounded flex items-center justify-center">
                        <Image className="w-2 h-2 text-blue-500" />
                    </div>
                    <div className="flex-1 h-full bg-blue-200 rounded flex items-center justify-center">
                        <Image className="w-2 h-2 text-blue-500" />
                    </div>
                </div>
            );
        default:
            return (
                <div className={baseClass}>
                    <div className="flex-1 h-full bg-gray-200 rounded" />
                </div>
            );
    }
};

export const SectionMiniMap: React.FC<SectionMiniMapProps> = ({
    sections,
    activeSectionId,
    onSectionClick,
    onMoveSection
}) => {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-white border-b">
                <h3 className="text-sm font-bold text-gray-800 flex items-center">
                    <LayoutGrid className="w-4 h-4 mr-2 text-indigo-600" />
                    섹션 구조
                    <span className="ml-2 text-xs font-normal bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        {sections.length}개
                    </span>
                </h3>
            </div>

            {/* 섹션 목록 */}
            <div className="p-2 space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar">
                {sections.map((section, index) => {
                    const isActive = section.id === activeSectionId;

                    return (
                        <div
                            key={section.id}
                            className={`
                group relative rounded-lg p-2 cursor-pointer transition-all duration-200
                ${isActive
                                    ? 'bg-indigo-50 border-2 border-indigo-400 shadow-sm'
                                    : 'bg-gray-50 border border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm'
                                }
              `}
                            onClick={() => onSectionClick(section.id)}
                        >
                            {/* 섹션 번호 & 타입 */}
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                    <span className={`
                    text-[10px] font-bold px-1.5 py-0.5 rounded
                    ${isActive ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}
                  `}>
                                        {index + 1}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${section.layoutType === 'text-only'
                                            ? 'bg-gray-100 text-gray-500'
                                            : 'bg-blue-100 text-blue-600'
                                        }`}>
                                        {section.layoutType}
                                    </span>
                                </div>

                                {/* 순서 이동 버튼 */}
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onMoveSection(index, 'up'); }}
                                        disabled={index === 0}
                                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="위로 이동"
                                    >
                                        <MoveUp className="w-3 h-3 text-gray-500" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onMoveSection(index, 'down'); }}
                                        disabled={index === sections.length - 1}
                                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="아래로 이동"
                                    >
                                        <MoveDown className="w-3 h-3 text-gray-500" />
                                    </button>
                                </div>
                            </div>

                            {/* 레이아웃 미리보기 */}
                            <LayoutPreview layoutType={section.layoutType || 'full-width'} />

                            {/* 섹션 제목 */}
                            <p className="mt-1.5 text-[11px] text-gray-700 font-medium truncate">
                                {section.title || '(제목 없음)'}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
