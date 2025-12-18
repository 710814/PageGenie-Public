import React, { useRef, useCallback, useMemo } from 'react';
import { ProductAnalysis, SectionData } from '../types';
import { Save, Plus, Trash2, RefreshCw, ArrowUp, ArrowDown, Sparkles, Lock, Image as ImageIcon, Type } from 'lucide-react';

interface Props {
  analysis: ProductAnalysis;
  onUpdate: (updated: ProductAnalysis) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export const StepAnalysis: React.FC<Props> = React.memo(({ analysis, onUpdate, onConfirm, isLoading }) => {
  // 섹션 리스트 컨테이너 참조 (스크롤 이동용)
  const sectionsContainerRef = useRef<HTMLDivElement>(null);

  const handleFieldChange = useCallback((field: keyof ProductAnalysis, value: any) => {
    const newData = { ...analysis, [field]: value };
    onUpdate(newData);
  }, [analysis, onUpdate]);

  const handleSectionChange = useCallback((index: number, field: keyof SectionData, value: string) => {
    const newSections = [...analysis.sections];
    newSections[index] = { ...newSections[index], [field]: value };
    handleFieldChange('sections', newSections);
  }, [analysis.sections, handleFieldChange]);

  const addSection = useCallback(() => {
    const newSection: SectionData = {
      id: `new-${Date.now()}`,
      title: "새 섹션",
      content: "내용을 입력하세요.",
      imagePrompt: "Product closeup, detailed shot, white background"
    };
    handleFieldChange('sections', [...analysis.sections, newSection]);

    // UX: 추가된 섹션이 보이도록 스크롤 이동
    setTimeout(() => {
      if (sectionsContainerRef.current) {
        const lastChild = sectionsContainerRef.current.lastElementChild;
        lastChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, [analysis.sections, handleFieldChange]);

  const removeSection = useCallback((index: number) => {
    if (confirm('이 섹션을 삭제하시겠습니까?')) {
      const newSections = analysis.sections.filter((_, i) => i !== index);
      handleFieldChange('sections', newSections);
    }
  }, [analysis.sections, handleFieldChange]);

  // 섹션 순서 변경 함수
  const moveSection = useCallback((index: number, direction: 'up' | 'down') => {
    const newSections = [...analysis.sections];
    if (direction === 'up' && index > 0) {
      // 위로 이동 (Swap with index-1)
      [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    } else if (direction === 'down' && index < newSections.length - 1) {
      // 아래로 이동 (Swap with index+1)
      [newSections[index + 1], newSections[index]] = [newSections[index], newSections[index + 1]];
    }
    handleFieldChange('sections', newSections);
  }, [analysis.sections, handleFieldChange]);

  // 메모이제이션된 섹션 개수
  const sectionCount = useMemo(() => analysis.sections.length, [analysis.sections.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI 분석 결과 검토</h2>
          <p className="text-gray-500">Gemini가 제안한 내용을 수정하고 섹션을 구성하세요.</p>
        </div>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              생성 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              상세페이지 생성 시작
            </>
          )}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Col: Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-6">
            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">기본 정보</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상품명</label>
                <input
                  type="text"
                  value={analysis.productName}
                  onChange={(e) => handleFieldChange('productName', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <input
                  type="text"
                  value={analysis.detectedCategory || ''}
                  onChange={(e) => handleFieldChange('detectedCategory', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">마케팅 문구 (헤드라인)</label>
                <textarea
                  rows={4}
                  value={analysis.marketingCopy}
                  onChange={(e) => handleFieldChange('marketingCopy', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주요 특징</label>
                <div className="space-y-2">
                  {analysis.mainFeatures.map((feature, i) => (
                    <input
                      key={i}
                      type="text"
                      value={feature}
                      onChange={(e) => {
                        const newFeatures = [...analysis.mainFeatures];
                        newFeatures[i] = e.target.value;
                        handleFieldChange('mainFeatures', newFeatures);
                      }}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Sections */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-800">섹션 구성 ({sectionCount})</h3>
            <button
              onClick={addSection}
              className="text-sm flex items-center text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" /> 섹션 추가
            </button>
          </div>

          <div className="space-y-4" ref={sectionsContainerRef}>
            {analysis.sections.map((section, index) => (
              <div key={section.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 group transition-all duration-200">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center text-gray-400">
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded mr-2">
                      SECTION {index + 1}
                    </span>
                    {/* 고정 요소 표시 배지 */}
                    {section.fixedText && (
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-medium px-2 py-0.5 rounded-full mr-1 flex items-center" title="고정 문구 포함">
                        <Type className="w-3 h-3 mr-0.5" />
                        고정문구
                      </span>
                    )}
                    {section.useFixedImage && section.fixedImageBase64 && (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-medium px-2 py-0.5 rounded-full mr-1 flex items-center" title="고정 이미지 사용">
                        <ImageIcon className="w-3 h-3 mr-0.5" />
                        고정이미지
                      </span>
                    )}
                    {section.layoutType && section.layoutType !== 'full-width' && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-medium px-2 py-0.5 rounded-full mr-1" title={`레이아웃: ${section.layoutType}`}>
                        {section.layoutType}
                      </span>
                    )}
                    {/* Reorder Buttons */}
                    <div className="flex items-center space-x-1 ml-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => moveSection(index, 'up')} 
                            disabled={index === 0}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent text-gray-600 transition-colors"
                            title="위로 이동"
                        >
                            <ArrowUp className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => moveSection(index, 'down')} 
                            disabled={index === analysis.sections.length - 1}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent text-gray-600 transition-colors"
                            title="아래로 이동"
                        >
                            <ArrowDown className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                  <button
                    onClick={() => removeSection(index)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="섹션 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">섹션 제목</label>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => handleSectionChange(index, 'title', e.target.value)}
                        className="w-full border-b border-gray-300 py-1 focus:border-blue-500 focus:outline-none font-medium text-gray-900"
                        placeholder="제목을 입력하세요"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">상세 설명</label>
                      <textarea
                        rows={5}
                        value={section.content}
                        onChange={(e) => handleSectionChange(index, 'content', e.target.value)}
                        className="w-full border border-gray-200 rounded p-2 text-sm text-gray-700 focus:ring-1 focus:ring-blue-500 focus:outline-none mt-1"
                        placeholder="섹션 내용을 입력하세요"
                      />
                    </div>
                    
                    {/* 고정 문구 표시 */}
                    {section.fixedText && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <label className="text-xs font-semibold text-amber-700 uppercase flex items-center mb-1">
                          <Lock className="w-3 h-3 mr-1" />
                          고정 문구
                        </label>
                        <p className="text-sm text-amber-800">{section.fixedText}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {/* 고정 이미지 미리보기 */}
                    {section.useFixedImage && section.fixedImageBase64 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <label className="text-xs font-semibold text-emerald-700 uppercase flex items-center mb-2">
                          <Lock className="w-3 h-3 mr-1" />
                          고정 이미지 (AI 생성 대신 사용)
                        </label>
                        <img 
                          src={`data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`}
                          alt="고정 이미지"
                          className="w-full h-32 object-contain bg-white rounded border border-emerald-200"
                        />
                      </div>
                    )}
                    
                    <div className={`bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 ${section.useFixedImage ? 'opacity-50' : ''}`}>
                      <label className="text-xs font-semibold text-indigo-600 uppercase mb-2 block flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" />
                        이미지 생성 프롬프트 (English)
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        {section.useFixedImage 
                          ? '⚠️ 고정 이미지를 사용하므로 이 프롬프트는 무시됩니다.'
                          : 'Gemini가 이 프롬프트를 기반으로 섹션 이미지를 생성합니다.'
                        }
                      </p>
                      <textarea
                        rows={section.useFixedImage ? 3 : 6}
                        value={section.imagePrompt}
                        onChange={(e) => handleSectionChange(index, 'imagePrompt', e.target.value)}
                        disabled={section.useFixedImage}
                        className={`w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono ${section.useFixedImage ? 'cursor-not-allowed' : ''}`}
                        placeholder="e.g. Detailed product shot on a wooden table..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

StepAnalysis.displayName = 'StepAnalysis';