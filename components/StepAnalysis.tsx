import React, { useRef, useCallback, useMemo, useState } from 'react';
import { ProductAnalysis, SectionData, UploadedFile, AppMode, ImageSlot } from '../types';
import { Save, Plus, Trash2, RefreshCw, ArrowUp, ArrowDown, Sparkles, Lock, Image as ImageIcon, Type, Eye, X, Loader2, Edit3 } from 'lucide-react';
import { generateSectionImage } from '../services/geminiService';
import { useToastContext } from '../contexts/ToastContext';

interface Props {
  analysis: ProductAnalysis;
  onUpdate: (updated: ProductAnalysis) => void;
  onConfirm: () => void;
  isLoading: boolean;
  uploadedFiles?: UploadedFile[];
  mode?: AppMode;
}

export const StepAnalysis: React.FC<Props> = React.memo(({ analysis, onUpdate, onConfirm, isLoading, uploadedFiles = [], mode = AppMode.CREATION }) => {
  // 섹션 리스트 컨테이너 참조 (스크롤 이동용)
  const sectionsContainerRef = useRef<HTMLDivElement>(null);
  const toast = useToastContext();

  // 이미지 미리보기 생성 상태
  const [generatingPreviewId, setGeneratingPreviewId] = useState<string | null>(null);

  // 프롬프트 수정 모달 상태
  const [editPromptModal, setEditPromptModal] = useState<{
    sectionId: string;
    prompt: string;
  } | null>(null);

  // 이미지 확대 모달 상태
  const [imageViewModal, setImageViewModal] = useState<{
    imageUrl: string;
    sectionTitle: string;
    sectionId: string;
  } | null>(null);

  // 이미지 미리보기 생성 함수 (단일 섹션 또는 개별 슬롯)
  const handleGeneratePreview = useCallback(async (sectionId: string, customPrompt?: string, slotIndex?: number) => {
    const section = analysis.sections.find(s => s.id === sectionId);
    if (!section) return;

    const hasMultipleSlots = section.imageSlots && section.imageSlots.length > 1;

    setGeneratingPreviewId(sectionId);

    try {
      const primaryFile = uploadedFiles.length > 0 ? uploadedFiles[0] : null;

      // ★ 다중 슬롯인 경우: 각 슬롯별로 이미지 생성
      if (hasMultipleSlots && slotIndex === undefined) {
        // 전체 슬롯 생성
        const updatedSlots = [];
        for (let i = 0; i < section.imageSlots!.length; i++) {
          const slot = section.imageSlots![i];

          // 이미 이미지가 있으면 건너뛰기
          if (slot.imageUrl) {
            updatedSlots.push(slot);
            continue;
          }

          toast.info(`이미지 ${i + 1}/${section.imageSlots!.length} 생성 중...`);

          try {
            const imageUrl = await generateSectionImage(
              slot.prompt || section.imagePrompt || '',
              primaryFile?.base64,
              primaryFile?.mimeType,
              mode
            );
            updatedSlots.push({ ...slot, imageUrl });
          } catch (slotError) {
            console.error(`슬롯 ${i + 1} 생성 실패:`, slotError);
            updatedSlots.push(slot);
          }
        }

        const firstSlotImage = updatedSlots.find(s => s.imageUrl)?.imageUrl;
        const updatedSections = analysis.sections.map(s =>
          s.id === sectionId
            ? { ...s, imageSlots: updatedSlots, imageUrl: firstSlotImage, isPreview: true }
            : s
        );
        onUpdate({ ...analysis, sections: updatedSections });
        toast.success(`${updatedSlots.filter(s => s.imageUrl).length}개 이미지 미리보기가 생성되었습니다.`);
      }
      // 개별 슬롯 생성 (slotIndex 지정된 경우)
      else if (hasMultipleSlots && slotIndex !== undefined) {
        const slot = section.imageSlots![slotIndex];
        const prompt = customPrompt || slot.prompt || section.imagePrompt || '';

        const imageUrl = await generateSectionImage(
          prompt,
          primaryFile?.base64,
          primaryFile?.mimeType,
          mode
        );

        const updatedSlots = section.imageSlots!.map((s, idx) =>
          idx === slotIndex ? { ...s, imageUrl, prompt } : s
        );
        const firstSlotImage = updatedSlots.find(s => s.imageUrl)?.imageUrl;

        const updatedSections = analysis.sections.map(s =>
          s.id === sectionId
            ? { ...s, imageSlots: updatedSlots, imageUrl: firstSlotImage, isPreview: true }
            : s
        );
        onUpdate({ ...analysis, sections: updatedSections });
        toast.success(`이미지 ${slotIndex + 1} 미리보기가 생성되었습니다.`);
      }
      // 단일 이미지 섹션 (기존 방식)
      else {
        const prompt = customPrompt || section.imagePrompt;
        if (!prompt) {
          toast.error('이미지 프롬프트가 없습니다.');
          return;
        }

        const imageUrl = await generateSectionImage(
          prompt,
          primaryFile?.base64,
          primaryFile?.mimeType,
          mode
        );

        const updatedSections = analysis.sections.map(s =>
          s.id === sectionId
            ? { ...s, imageUrl, imagePrompt: prompt, isPreview: true }
            : s
        );
        onUpdate({ ...analysis, sections: updatedSections });
        toast.success('이미지 미리보기가 생성되었습니다.');
      }
    } catch (error) {
      console.error('Preview generation failed:', error);
      toast.error('이미지 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setGeneratingPreviewId(null);
    }
  }, [analysis, uploadedFiles, mode, onUpdate, toast]);

  // 프롬프트 수정 모달 열기
  const handleOpenEditPrompt = useCallback((sectionId: string) => {
    const section = analysis.sections.find(s => s.id === sectionId);
    setEditPromptModal({
      sectionId,
      prompt: section?.imagePrompt || ''
    });
  }, [analysis.sections]);

  // 프롬프트 수정 후 이미지 생성
  const handleConfirmEditPrompt = useCallback(() => {
    if (!editPromptModal) return;

    const { sectionId, prompt } = editPromptModal;
    setEditPromptModal(null);
    handleGeneratePreview(sectionId, prompt);
  }, [editPromptModal, handleGeneratePreview]);

  // 이미지 미리보기 제거
  const handleRemovePreview = useCallback((sectionId: string) => {
    const updatedSections = analysis.sections.map(s =>
      s.id === sectionId
        ? { ...s, imageUrl: undefined, isPreview: false }
        : s
    );
    onUpdate({ ...analysis, sections: updatedSections });
  }, [analysis, onUpdate]);

  // 미리보기가 있는 섹션 수
  const previewCount = useMemo(() =>
    analysis.sections.filter(s => s.imageUrl && !s.isOriginalImage).length,
    [analysis.sections]);

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
          <h2 className="text-2xl font-bold text-gray-900">상세페이지 기획안 검토</h2>
          <p className="text-gray-500">AI가 제안한 기획안을 검토하고 수정하세요. 이미지 미리보기를 생성하여 최종 시안을 확인할 수 있습니다.</p>
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

                {/* 다중 이미지 슬롯 섹션 (grid-2, grid-3): 1컬럼 레이아웃 */}
                {section.imageSlots && section.imageSlots.length > 1 ? (
                  <div className="space-y-4">
                    {/* 섹션 제목 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">섹션 제목</label>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => {
                          const newSections = [...analysis.sections];
                          newSections[index] = { ...newSections[index], title: e.target.value };
                          handleFieldChange('sections', newSections);
                        }}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    {/* 섹션 설명 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">상세 설명</label>
                      <textarea
                        rows={4}
                        value={section.content}
                        onChange={(e) => {
                          const newSections = [...analysis.sections];
                          newSections[index] = { ...newSections[index], content: e.target.value };
                          handleFieldChange('sections', newSections);
                        }}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    {/* 고정 문구 표시 */}
                    {section.fixedText && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <label className="text-xs font-semibold text-amber-700 uppercase mb-1 block flex items-center">
                          <Lock className="w-3 h-3 mr-1" />
                          고정 문구 (자동 포함)
                        </label>
                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{section.fixedText}</p>
                      </div>
                    )}

                    {/* 고정 이미지 표시 */}
                    {section.useFixedImage && section.fixedImageBase64 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <label className="text-xs font-semibold text-emerald-700 uppercase mb-2 block flex items-center">
                          <Lock className="w-3 h-3 mr-1" />
                          고정 이미지 (AI 생성 대신 사용)
                        </label>
                        <img
                          src={`data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`}
                          alt="고정 이미지"
                          className="w-full h-32 object-contain bg-white rounded border border-emerald-200 cursor-pointer hover:border-emerald-400 transition-colors"
                          onClick={() => setImageViewModal({
                            imageUrl: `data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`,
                            sectionTitle: `${section.title} (고정 이미지)`,
                            sectionId: section.id
                          })}
                          title="클릭하여 크게 보기"
                        />
                      </div>
                    )}

                    {/* 이미지 슬롯들 */}
                    <div className={`bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 ${section.useFixedImage ? 'opacity-50' : ''}`}>
                      <label className="text-xs font-semibold text-indigo-600 uppercase mb-2 block flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" />
                        이미지 생성 프롬프트 (한국어/영어 가능)
                        <span className="ml-2 bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full">
                          {section.imageSlots.length}개 이미지
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        {section.useFixedImage
                          ? '⚠️ 고정 이미지를 사용하므로 이 프롬프트는 무시됩니다.'
                          : `이 섹션은 ${section.layoutType} 레이아웃으로 ${section.imageSlots.length}개의 이미지가 필요합니다.`
                        }
                      </p>

                      <div className="space-y-3">
                        {section.imageSlots.map((slot, slotIdx) => (
                          <div key={slot.id} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center">
                                <ImageIcon className="w-3 h-3 mr-1" />
                                이미지 {slotIdx + 1}/{section.imageSlots!.length} ({slot.slotType})
                              </label>
                              <button
                                onClick={() => handleGeneratePreview(section.id, undefined, slotIdx)}
                                disabled={generatingPreviewId === section.id || !slot.prompt}
                                className="text-[10px] px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded flex items-center gap-1 disabled:opacity-50"
                              >
                                {generatingPreviewId === section.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3 h-3" />
                                )}
                                생성
                              </button>
                            </div>

                            {slot.imageUrl && (
                              <div className="mb-2 relative group/slot">
                                <img
                                  src={slot.imageUrl}
                                  alt={`이미지 ${slotIdx + 1}`}
                                  className="w-full h-32 object-contain bg-gray-50 rounded-lg border border-indigo-200 cursor-pointer hover:border-indigo-400 transition-colors"
                                  onClick={() => setImageViewModal({
                                    imageUrl: slot.imageUrl!,
                                    sectionTitle: `${section.title} - 이미지 ${slotIdx + 1}`,
                                    sectionId: `${section.id}-slot-${slotIdx}`
                                  })}
                                  title="클릭하여 크게 보기"
                                />
                                {/* Hover 액션 버튼들 */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/slot:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2 pointer-events-none group-hover/slot:pointer-events-auto">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setImageViewModal({
                                        imageUrl: slot.imageUrl!,
                                        sectionTitle: `${section.title} - 이미지 ${slotIdx + 1}`,
                                        sectionId: `${section.id}-slot-${slotIdx}`
                                      });
                                    }}
                                    className="bg-white text-gray-800 px-2 py-1 rounded text-[10px] font-medium flex items-center hover:bg-gray-100 transition-colors"
                                    title="이미지 크게 보기"
                                  >
                                    <Eye className="w-3 h-3 mr-0.5" />
                                    크게보기
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGeneratePreview(section.id, undefined, slotIdx);
                                    }}
                                    disabled={generatingPreviewId === section.id}
                                    className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-medium flex items-center hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    title="동일 프롬프트로 재생성"
                                  >
                                    <RefreshCw className={`w-3 h-3 mr-0.5 ${generatingPreviewId === section.id ? 'animate-spin' : ''}`} />
                                    재생성
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // 슬롯 이미지 제거
                                      const newSlots = [...(section.imageSlots || [])];
                                      newSlots[slotIdx] = { ...newSlots[slotIdx], imageUrl: undefined };
                                      const newSections = [...analysis.sections];
                                      newSections[index] = { ...newSections[index], imageSlots: newSlots };
                                      handleFieldChange('sections', newSections);
                                    }}
                                    className="bg-red-500 text-white p-1 rounded hover:bg-red-600 transition-colors"
                                    title="미리보기 제거"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <p className="text-xs text-green-600 flex items-center mt-1">
                                  <Eye className="w-3 h-3 mr-1" />
                                  미리보기 생성 완료 - 마우스를 올려 수정/재생성
                                </p>
                              </div>
                            )}

                            <textarea
                              rows={2}
                              value={slot.prompt}
                              onChange={(e) => {
                                const newSlots = [...(section.imageSlots || [])];
                                newSlots[slotIdx] = { ...newSlots[slotIdx], prompt: e.target.value };
                                const newSections = [...analysis.sections];
                                newSections[index] = { ...newSections[index], imageSlots: newSlots };
                                handleFieldChange('sections', newSections);
                              }}
                              disabled={section.useFixedImage}
                              className={`w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm text-gray-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none ${section.useFixedImage ? 'cursor-not-allowed' : ''}`}
                              placeholder={`이미지 ${slotIdx + 1}의 스타일을 설명하세요`}
                            />
                          </div>
                        ))}

                        <button
                          onClick={() => handleGeneratePreview(section.id)}
                          disabled={generatingPreviewId === section.id}
                          className="w-full py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          {generatingPreviewId === section.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              이미지 생성 중...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              전체 {section.imageSlots.length}개 이미지 미리보기 생성
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleGeneratePreview(section.id, undefined, undefined, true)}
                          disabled={generatingPreviewId === section.id}
                          className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <Sparkles className="w-3 h-3" />
                          이미지 미리보기 생성
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 단일 이미지 섹션: 기존 2컬럼 레이아웃 유지 */
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
                            className="w-full h-32 object-contain bg-white rounded border border-emerald-200 cursor-pointer hover:border-emerald-400 transition-colors"
                            onClick={() => setImageViewModal({
                              imageUrl: `data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`,
                              sectionTitle: `${section.title} (고정 이미지)`,
                              sectionId: section.id
                            })}
                            title="클릭하여 크게 보기"
                          />
                        </div>
                      )}

                      <div className={`bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 ${section.useFixedImage ? 'opacity-50' : ''}`}>
                        <label className="text-xs font-semibold text-indigo-600 uppercase mb-2 block flex items-center">
                          <Sparkles className="w-3 h-3 mr-1" />
                          이미지 생성 프롬프트 (한국어/영어 가능)
                          {section.imageSlots && section.imageSlots.length > 1 && (
                            <span className="ml-2 bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full">
                              {section.imageSlots.length}개 이미지
                            </span>
                          )}
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          {section.useFixedImage
                            ? '⚠️ 고정 이미지를 사용하므로 이 프롬프트는 무시됩니다.'
                            : section.imageSlots && section.imageSlots.length > 1
                              ? `이 섹션은 ${section.layoutType} 레이아웃으로 ${section.imageSlots.length}개의 이미지가 필요합니다.`
                              : '한국어 또는 영어로 이미지 스타일을 설명하세요.'
                          }
                        </p>

                        {/* 다중 이미지 슬롯 표시 */}
                        {section.imageSlots && section.imageSlots.length > 1 ? (
                          <div className="space-y-3">
                            {section.imageSlots.map((slot, slotIdx) => (
                              <div key={slot.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                <div className="flex justify-between items-center mb-2">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center">
                                    <ImageIcon className="w-3 h-3 mr-1" />
                                    이미지 {slotIdx + 1}/{section.imageSlots!.length} ({slot.slotType})
                                  </label>
                                  {/* 개별 슬롯 이미지 생성 버튼 */}
                                  <button
                                    onClick={() => handleGeneratePreview(section.id, undefined, slotIdx)}
                                    disabled={generatingPreviewId === section.id || !slot.prompt}
                                    className="text-[10px] px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded flex items-center gap-1 disabled:opacity-50"
                                  >
                                    {generatingPreviewId === section.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Sparkles className="w-3 h-3" />
                                    )}
                                    생성
                                  </button>
                                </div>

                                {/* 슬롯 이미지 미리보기 */}
                                {slot.imageUrl && (
                                  <div className="mb-2">
                                    <img
                                      src={slot.imageUrl}
                                      alt={`이미지 ${slotIdx + 1}`}
                                      className="w-full h-24 object-contain bg-gray-50 rounded border border-gray-200"
                                    />
                                  </div>
                                )}

                                <textarea
                                  rows={2}
                                  value={slot.prompt}
                                  onChange={(e) => {
                                    const newSlots = [...(section.imageSlots || [])];
                                    newSlots[slotIdx] = { ...newSlots[slotIdx], prompt: e.target.value };
                                    const newSections = [...analysis.sections];
                                    newSections[index] = { ...newSections[index], imageSlots: newSlots };
                                    handleFieldChange('sections', newSections);
                                  }}
                                  disabled={section.useFixedImage}
                                  className={`w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm text-gray-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none ${section.useFixedImage ? 'cursor-not-allowed' : ''}`}
                                  placeholder={`이미지 ${slotIdx + 1}의 스타일을 설명하세요`}
                                />
                              </div>
                            ))}

                            {/* 전체 슬롯 이미지 생성 버튼 */}
                            <button
                              onClick={() => handleGeneratePreview(section.id)}
                              disabled={generatingPreviewId === section.id}
                              className="w-full py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                              {generatingPreviewId === section.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  이미지 생성 중...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  전체 {section.imageSlots.length}개 이미지 미리보기 생성
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          /* 단일 이미지 프롬프트 (기존 방식) */
                          <textarea
                            rows={section.useFixedImage ? 3 : 4}
                            value={section.imagePrompt}
                            onChange={(e) => handleSectionChange(index, 'imagePrompt', e.target.value)}
                            disabled={section.useFixedImage}
                            className={`w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none ${section.useFixedImage ? 'cursor-not-allowed' : ''}`}
                            placeholder="예: 나무 테이블 위의 상품, 미니멀한 배경, 고품질 사진&#10;또는: Product on wooden table, minimalist background, high quality"
                          />
                        )}

                        {/* 이미지 미리보기 버튼 및 결과 */}
                        {!section.useFixedImage && (
                          <div className="mt-3">
                            {section.imageUrl && !section.isOriginalImage ? (
                              // 이미지가 생성된 경우
                              <div className="space-y-2">
                                <div className="relative group">
                                  <img
                                    src={section.imageUrl}
                                    alt="미리보기"
                                    className="w-full h-32 object-contain bg-white rounded-lg border border-indigo-200 cursor-pointer hover:border-indigo-400 transition-colors"
                                    onClick={() => setImageViewModal({
                                      imageUrl: section.imageUrl!,
                                      sectionTitle: section.title,
                                      sectionId: section.id
                                    })}
                                    title="클릭하여 크게 보기"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setImageViewModal({
                                          imageUrl: section.imageUrl!,
                                          sectionTitle: section.title,
                                          sectionId: section.id
                                        });
                                      }}
                                      className="bg-white text-gray-800 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center hover:bg-gray-100 transition-colors"
                                      title="이미지 크게 보기"
                                    >
                                      <Eye className="w-3 h-3 mr-1" />
                                      크게보기
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditPrompt(section.id);
                                      }}
                                      className="bg-white text-gray-800 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center hover:bg-gray-100 transition-colors"
                                      title="프롬프트 수정 후 재생성"
                                    >
                                      <Edit3 className="w-3 h-3 mr-1" />
                                      수정
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleGeneratePreview(section.id);
                                      }}
                                      disabled={generatingPreviewId === section.id}
                                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center hover:bg-blue-700 transition-colors disabled:opacity-50"
                                      title="동일 프롬프트로 재생성"
                                    >
                                      <RefreshCw className={`w-3 h-3 mr-1 ${generatingPreviewId === section.id ? 'animate-spin' : ''}`} />
                                      재생성
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemovePreview(section.id);
                                      }}
                                      className="bg-red-500 text-white p-1.5 rounded-lg hover:bg-red-600 transition-colors"
                                      title="미리보기 제거"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-xs text-green-600 flex items-center">
                                  <Eye className="w-3 h-3 mr-1" />
                                  미리보기 생성 완료 - 마우스를 올려 수정/재생성
                                </p>
                              </div>
                            ) : (
                              // 이미지가 없는 경우
                              <button
                                onClick={() => handleGeneratePreview(section.id)}
                                disabled={generatingPreviewId === section.id || !section.imagePrompt}
                                className="w-full py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {generatingPreviewId === section.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    이미지 생성 중...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4" />
                                    이미지 미리보기 생성
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 고정 액션 바 */}
      {previewCount > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-2xl border border-gray-200 rounded-full px-6 py-3 flex items-center gap-4 z-30">
          <span className="text-sm text-gray-600">
            <Eye className="w-4 h-4 inline mr-1" />
            미리보기 {previewCount}개 생성됨
          </span>
          <div className="w-px h-6 bg-gray-200"></div>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-full font-semibold flex items-center shadow-lg disabled:opacity-50 text-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            나머지 생성 후 완료
          </button>
        </div>
      )}

      {/* 프롬프트 수정 모달 */}
      {editPromptModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Edit3 className="w-5 h-5 mr-2" />
                이미지 프롬프트 수정
              </h3>
              <p className="text-indigo-100 text-sm mt-1">프롬프트를 수정하고 새로운 이미지를 생성합니다.</p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이미지 생성 프롬프트 (한국어/영어 가능)
              </label>
              <textarea
                rows={5}
                value={editPromptModal.prompt}
                onChange={(e) => setEditPromptModal({ ...editPromptModal, prompt: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="예: 나무 테이블 위의 상품, 미니멀한 배경, 고품질 사진"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 팁: 구체적인 설명을 추가할수록 원하는 이미지를 얻을 수 있습니다.
              </p>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setEditPromptModal(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleConfirmEditPrompt}
                disabled={!editPromptModal.prompt.trim()}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                이미지 재생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 확대 보기 모달 */}
      {imageViewModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setImageViewModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2" />
                  이미지 미리보기
                </h3>
                <p className="text-blue-100 text-sm mt-0.5">{imageViewModal.sectionTitle}</p>
              </div>
              <button
                onClick={() => setImageViewModal(null)}
                className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 이미지 영역 */}
            <div className="flex-1 overflow-auto p-6 bg-gray-100 flex items-center justify-center">
              <img
                src={imageViewModal.imageUrl}
                alt={imageViewModal.sectionTitle}
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
              />
            </div>

            {/* 액션 버튼 */}
            <div className="bg-white border-t px-6 py-4 flex justify-between items-center">
              <p className="text-sm text-gray-500">
                💡 이미지가 마음에 들지 않으면 프롬프트를 수정하여 재생성하세요.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setImageViewModal(null);
                    handleOpenEditPrompt(imageViewModal.sectionId);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium flex items-center transition-colors"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  프롬프트 수정
                </button>
                <button
                  onClick={() => {
                    setImageViewModal(null);
                    handleGeneratePreview(imageViewModal.sectionId);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  재생성
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

StepAnalysis.displayName = 'StepAnalysis';