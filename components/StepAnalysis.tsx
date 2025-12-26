import React, { useRef, useCallback, useMemo, useState } from 'react';
import { ProductAnalysis, SectionData, UploadedFile, AppMode, ImageSlot, SectionPreset, SectionType, LayoutType } from '../types';
import { Save, Plus, Trash2, RefreshCw, ArrowUp, ArrowDown, Sparkles, Lock, Image as ImageIcon, Type, Eye, X, Loader2, Edit3, Upload, Bookmark, ChevronDown, ChevronUp, ZoomIn, ZoomOut, RotateCcw, Move, Check, LayoutGrid } from 'lucide-react';
import { generateSectionImage } from '../services/geminiService';
import { getSectionPresets, saveSectionPreset, deleteSectionPreset } from '../services/sectionPresetService';
import { useToastContext } from '../contexts/ToastContext';
import { SectionMiniMap } from './SectionMiniMap';

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

  // 이미지 확대 모달 상태 (Pan & Zoom 기능 포함)
  const [imageViewModal, setImageViewModal] = useState<{
    imageUrl: string;
    sectionTitle: string;
    sectionId: string;
    slotIndex?: number;      // 슬롯 인덱스 (단일 이미지는 undefined)
    zoom: number;
    panX: number;
    panY: number;
  } | null>(null);

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 섹션 추가 모달 상태 (확장)
  const [addSectionModal, setAddSectionModal] = useState<{
    isOpen: boolean;
    activeTab: 'new' | 'preset';        // 새로 만들기 / 프리셋에서
    sectionType: string;
    layoutType: string;
    slotCount: number;
    fixedText: string;                   // 고정 문구
    fixedImageBase64?: string;           // 고정 이미지 Base64
    fixedImageMimeType?: string;         // 고정 이미지 MIME
    showAdvanced: boolean;               // 고급 설정 펼치기
    saveAsPreset: boolean;               // 프리셋으로 저장 모드
    presetName: string;                  // 프리셋 이름
  } | null>(null);

  // 섹션 프리셋 목록
  const [sectionPresets, setSectionPresets] = useState<SectionPreset[]>([]);

  // 현재 활성 섹션 (미니맵 하이라이트용)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // 각 섹션 요소의 ref (스크롤 이동용)
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // 모달용 파일 input ref
  const modalImageInputRef = useRef<HTMLInputElement | null>(null);

  // 파일 input refs
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

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

  // 사용자 이미지 업로드 핸들러 (섹션 또는 슬롯)
  const handleUploadImage = useCallback((sectionId: string, file: File, slotIndex?: number) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;

      const updatedSections = analysis.sections.map(section => {
        if (section.id !== sectionId) return section;

        if (slotIndex !== undefined && section.imageSlots) {
          // 슬롯 이미지 업로드
          const newSlots = section.imageSlots.map((slot, idx) =>
            idx === slotIndex ? { ...slot, imageUrl: base64 } : slot
          );
          return { ...section, imageSlots: newSlots };
        } else {
          // 단일 섹션 이미지 업로드
          return { ...section, imageUrl: base64, isPreview: true };
        }
      });

      onUpdate({ ...analysis, sections: updatedSections });
      toast.success('이미지가 업로드되었습니다.');
    };
    reader.readAsDataURL(file);
  }, [analysis, onUpdate, toast]);

  // 이미지 뷰 모달 열기 (저장된 크롭 설정 불러오기)
  const openImageViewModal = useCallback((imageUrl: string, sectionTitle: string, sectionId: string, slotIndex?: number) => {
    // 해당 섹션/슬롯의 저장된 크롭 설정 찾기
    const section = analysis.sections.find(s => s.id === sectionId);
    let savedZoom = 1, savedPanX = 0, savedPanY = 0;

    if (section) {
      if (slotIndex !== undefined && section.imageSlots?.[slotIndex]) {
        // 슬롯 이미지
        const slot = section.imageSlots[slotIndex];
        savedZoom = slot.cropZoom || 1;
        savedPanX = slot.cropPanX || 0;
        savedPanY = slot.cropPanY || 0;
      } else {
        // 단일 이미지
        savedZoom = section.cropZoom || 1;
        savedPanX = section.cropPanX || 0;
        savedPanY = section.cropPanY || 0;
      }
    }

    setImageViewModal({
      imageUrl,
      sectionTitle,
      sectionId,
      slotIndex,
      zoom: savedZoom,
      panX: savedPanX,
      panY: savedPanY,
    });
  }, [analysis.sections]);

  // 크롭 설정 저장
  const handleSaveCrop = useCallback(() => {
    if (!imageViewModal) return;

    const { sectionId, slotIndex, zoom, panX, panY } = imageViewModal;

    const updatedSections = analysis.sections.map(section => {
      if (section.id !== sectionId) return section;

      if (slotIndex !== undefined && section.imageSlots) {
        // 슬롯 이미지 크롭 설정 저장
        const newSlots = section.imageSlots.map((slot, idx) =>
          idx === slotIndex
            ? { ...slot, cropZoom: zoom, cropPanX: panX, cropPanY: panY }
            : slot
        );
        return { ...section, imageSlots: newSlots };
      } else {
        // 단일 이미지 크롭 설정 저장
        return { ...section, cropZoom: zoom, cropPanX: panX, cropPanY: panY };
      }
    });

    onUpdate({ ...analysis, sections: updatedSections });
    toast.success(`크롭 설정이 저장되었습니다. (배율: ${Math.round(zoom * 100)}%)`);
  }, [imageViewModal, analysis, onUpdate, toast]);

  // 줌 핸들러
  const handleZoom = useCallback((delta: number) => {
    if (!imageViewModal) return;
    const newZoom = Math.max(0.5, Math.min(4, imageViewModal.zoom + delta));
    setImageViewModal({ ...imageViewModal, zoom: newZoom });
  }, [imageViewModal]);

  // 줌 리셋 (초기화)
  const handleResetZoom = useCallback(() => {
    if (!imageViewModal) return;
    setImageViewModal({ ...imageViewModal, zoom: 1, panX: 0, panY: 0 });
  }, [imageViewModal]);

  // 마우스 휠 줌
  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    handleZoom(delta);
  }, [handleZoom]);

  // 드래그 시작
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!imageViewModal || imageViewModal.zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - imageViewModal.panX, y: e.clientY - imageViewModal.panY });
  }, [imageViewModal]);

  // 드래그 중
  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !imageViewModal) return;
    const newPanX = e.clientX - dragStart.x;
    const newPanY = e.clientY - dragStart.y;
    setImageViewModal({ ...imageViewModal, panX: newPanX, panY: newPanY });
  }, [isDragging, dragStart, imageViewModal]);

  // 드래그 종료
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 레이아웃 추천 매핑
  const layoutRecommendations: { [key: string]: string } = {
    'hero': 'full-width',
    'description': 'full-width',
    'colors': 'grid-3',
    'material_detail': 'full-width',
    'styling': 'grid-2',
    'fit': 'full-width',
    'spec': 'text-only',
    'notice': 'text-only',
    'custom': 'full-width',
  };

  // 섹션 타입 한글 라벨
  const sectionTypeLabels: { [key: string]: string } = {
    'hero': '메인 비주얼',
    'description': '상품 설명',
    'colors': '컬러 옵션',
    'material_detail': '소재 상세',
    'styling': '스타일링',
    'fit': '핏/사이즈',
    'spec': '스펙/사양',
    'notice': '안내사항',
    'custom': '사용자 정의',
  };

  // 레이아웃 타입 한글 라벨
  const layoutTypeLabels: { [key: string]: string } = {
    'full-width': '전체 너비',
    'grid-2': '2열 그리드',
    'grid-3': '3열 그리드',
    'text-only': '텍스트만',
  };

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

  // 섹션 추가 모달 열기 (확장)
  const openAddSectionModal = useCallback(() => {
    // 프리셋 목록 새로고침
    setSectionPresets(getSectionPresets());

    setAddSectionModal({
      isOpen: true,
      activeTab: 'new',
      sectionType: 'custom',
      layoutType: 'full-width',
      slotCount: 1,
      fixedText: '',
      fixedImageBase64: undefined,
      fixedImageMimeType: undefined,
      showAdvanced: false,
      saveAsPreset: false,
      presetName: '',
    });
  }, []);

  // 모달 내 고정 이미지 업로드 핸들러
  const handleModalImageUpload = useCallback((file: File) => {
    if (!addSectionModal) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];

      setAddSectionModal({
        ...addSectionModal,
        fixedImageBase64: base64Data,
        fixedImageMimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  }, [addSectionModal]);

  // 모달 내 고정 이미지 제거
  const handleRemoveModalImage = useCallback(() => {
    if (!addSectionModal) return;

    setAddSectionModal({
      ...addSectionModal,
      fixedImageBase64: undefined,
      fixedImageMimeType: undefined,
    });
  }, [addSectionModal]);

  // 현재 설정을 프리셋으로 저장
  const handleSaveAsPreset = useCallback(() => {
    if (!addSectionModal || !addSectionModal.presetName.trim()) {
      toast.warning('프리셋 이름을 입력해주세요.');
      return;
    }

    const newPreset: SectionPreset = {
      id: `preset-${Date.now()}`,
      name: addSectionModal.presetName.trim(),
      sectionType: addSectionModal.sectionType as SectionType,
      layoutType: addSectionModal.layoutType as LayoutType,
      slotCount: addSectionModal.slotCount,
      fixedText: addSectionModal.fixedText || undefined,
      fixedImageBase64: addSectionModal.fixedImageBase64,
      fixedImageMimeType: addSectionModal.fixedImageMimeType,
      createdAt: Date.now(),
    };

    saveSectionPreset(newPreset);
    setSectionPresets(getSectionPresets());

    setAddSectionModal({
      ...addSectionModal,
      saveAsPreset: false,
      presetName: '',
    });

    toast.success(`'${newPreset.name}' 프리셋이 저장되었습니다.`);
  }, [addSectionModal, toast]);

  // 프리셋 삭제
  const handleDeletePreset = useCallback((presetId: string) => {
    if (confirm('이 프리셋을 삭제하시겠습니까?')) {
      deleteSectionPreset(presetId);
      setSectionPresets(getSectionPresets());
      toast.info('프리셋이 삭제되었습니다.');
    }
  }, [toast]);

  // 프리셋으로 섹션 추가
  const handleApplyPreset = useCallback((preset: SectionPreset) => {
    const isGrid = preset.layoutType === 'grid-2' || preset.layoutType === 'grid-3';
    const slotCount = preset.slotCount || (isGrid ? (preset.layoutType === 'grid-3' ? 3 : 2) : 1);

    const imageSlots: ImageSlot[] = isGrid
      ? Array.from({ length: slotCount }, (_, i) => ({
        id: `slot-${Date.now()}-${i}`,
        slotType: 'product' as const,
        prompt: '',
      }))
      : [{
        id: `slot-${Date.now()}-0`,
        slotType: 'product' as const,
        prompt: '',
      }];

    const newSection: SectionData = {
      id: `new-${Date.now()}`,
      title: preset.name,
      content: preset.description || '내용을 입력하세요.',
      imagePrompt: 'Product photo, professional quality',
      sectionType: preset.sectionType,
      layoutType: preset.layoutType,
      imageSlots,
      fixedText: preset.fixedText,
      fixedImageBase64: preset.fixedImageBase64,
      fixedImageMimeType: preset.fixedImageMimeType,
      useFixedImage: !!preset.fixedImageBase64,
    };

    handleFieldChange('sections', [...analysis.sections, newSection]);
    setAddSectionModal(null);

    setTimeout(() => {
      if (sectionsContainerRef.current) {
        const lastChild = sectionsContainerRef.current.lastElementChild;
        lastChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    toast.success(`'${preset.name}' 프리셋이 적용되었습니다.`);
  }, [analysis.sections, handleFieldChange, toast]);

  // 섹션 추가 확인 (확장)
  const confirmAddSection = useCallback(() => {
    if (!addSectionModal) return;

    const { sectionType, layoutType, slotCount, fixedText, fixedImageBase64, fixedImageMimeType } = addSectionModal;
    const isGrid = layoutType === 'grid-2' || layoutType === 'grid-3';

    // 슬롯 생성
    const imageSlots: ImageSlot[] = isGrid
      ? Array.from({ length: slotCount }, (_, i) => ({
        id: `slot-${Date.now()}-${i}`,
        slotType: 'product' as const,
        prompt: '',
      }))
      : [{
        id: `slot-${Date.now()}-0`,
        slotType: 'product' as const,
        prompt: '',
      }];

    const newSection: SectionData = {
      id: `new-${Date.now()}`,
      title: sectionTypeLabels[sectionType] || '새 섹션',
      content: '내용을 입력하세요.',
      imagePrompt: 'Product photo, professional quality',
      sectionType: sectionType as any,
      layoutType: layoutType as any,
      imageSlots,
      // 고정 요소 추가
      fixedText: fixedText || undefined,
      fixedImageBase64: fixedImageBase64,
      fixedImageMimeType: fixedImageMimeType,
      useFixedImage: !!fixedImageBase64,
    };

    handleFieldChange('sections', [...analysis.sections, newSection]);
    setAddSectionModal(null);

    // UX: 추가된 섹션이 보이도록 스크롤 이동
    setTimeout(() => {
      if (sectionsContainerRef.current) {
        const lastChild = sectionsContainerRef.current.lastElementChild;
        lastChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    toast.success('새 섹션이 추가되었습니다.');
  }, [addSectionModal, analysis.sections, handleFieldChange, sectionTypeLabels, toast]);

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

  // 섹션으로 스크롤 이동 (미니맵에서 클릭 시)
  const scrollToSection = useCallback((sectionId: string) => {
    setActiveSectionId(sectionId);
    const sectionEl = sectionRefs.current[sectionId];
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // 메모이제이션된 섹션 개수
  const sectionCount = useMemo(() => analysis.sections.length, [analysis.sections.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">상세페이지 기획안 검토</h2>
          <p className="text-gray-500">AI가 제안한 기획안을 검토하고 수정하세요. 이미지 미리보기를 생성하여 최종 시안을 확인할 수 있습니다.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Col: Section MiniMap (sticky) */}
        <div className="lg:col-span-1 hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <SectionMiniMap
              sections={analysis.sections}
              activeSectionId={activeSectionId || undefined}
              onSectionClick={scrollToSection}
              onMoveSection={moveSection}
              onDeleteSection={removeSection}
            />

            {/* 기본 정보 (접이식) */}
            <details className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <summary className="px-4 py-3 bg-gray-50 cursor-pointer text-sm font-bold text-gray-700 flex items-center hover:bg-gray-100 transition-colors list-none">
                <ChevronDown className="w-4 h-4 mr-2 text-gray-500" />
                기본 정보
              </summary>
              <div className="p-4 space-y-3 text-sm">
                <div>
                  <label className="text-xs text-gray-500">상품명</label>
                  <input
                    type="text"
                    value={analysis.productName}
                    onChange={(e) => handleFieldChange('productName', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-2 mt-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">카테고리</label>
                  <input
                    type="text"
                    value={analysis.detectedCategory || ''}
                    onChange={(e) => handleFieldChange('detectedCategory', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-2 mt-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">마케팅 문구</label>
                  <textarea
                    value={analysis.marketingCopy}
                    onChange={(e) => handleFieldChange('marketingCopy', e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg p-2 mt-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">주요 특징</label>
                  <div className="space-y-1 mt-1">
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
                        className="w-full border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Right Col: Sections */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-800">섹션 구성 ({sectionCount})</h3>
            <button
              onClick={openAddSectionModal}
              className="text-sm flex items-center text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" /> 섹션 추가
            </button>
          </div>

          <div className="space-y-4" ref={sectionsContainerRef}>
            {analysis.sections.map((section, index) => (
              <div
                key={section.id}
                ref={(el) => { sectionRefs.current[section.id] = el; }}
                className={`bg-white p-6 rounded-xl shadow-sm border-2 group transition-all duration-200 ${activeSectionId === section.id
                  ? 'border-indigo-400 ring-2 ring-indigo-100'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
                onClick={() => setActiveSectionId(section.id)}
              >
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
                        <div
                          className="w-full h-32 bg-white rounded border border-emerald-200 cursor-pointer hover:border-emerald-400 transition-colors overflow-hidden"
                          onClick={() => openImageViewModal(
                            `data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`,
                            `${section.title} (고정 이미지)`,
                            section.id
                          )}
                          title="클릭하여 크게 보기"
                        >
                          <img
                            src={`data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`}
                            alt="고정 이미지"
                            className="w-full h-full object-cover"
                            style={{
                              transform: section.cropZoom && section.cropZoom !== 1
                                ? `scale(${section.cropZoom}) translate(${-(section.cropPanX || 0) / section.cropZoom}px, ${-(section.cropPanY || 0) / section.cropZoom}px)`
                                : undefined,
                              transformOrigin: 'center center'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 이미지 슬롯들 (text-only 레이아웃에서는 숨김) */}
                    <div className={`bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 ${section.useFixedImage ? 'opacity-50' : ''} ${section.layoutType === 'text-only' ? 'hidden' : ''}`}>
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
                              <div className="flex gap-1">
                                {/* 직접 업로드 버튼 */}
                                <label className="text-[10px] px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded flex items-center gap-1 cursor-pointer transition-colors">
                                  <Upload className="w-3 h-3" />
                                  업로드
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadImage(section.id, file, slotIdx);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                {/* AI 생성 버튼 */}
                                <button
                                  onClick={() => handleGeneratePreview(section.id, undefined, slotIdx)}
                                  disabled={generatingPreviewId === section.id || !slot.prompt}
                                  className="text-[10px] px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded flex items-center gap-1 disabled:opacity-50 transition-colors"
                                >
                                  {generatingPreviewId === section.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3 h-3" />
                                  )}
                                  생성
                                </button>
                              </div>
                            </div>

                            {slot.imageUrl && (
                              <div className="mb-2 relative group/slot">
                                {/* 크롭 설정 저장됨 배지 */}
                                {(slot.cropZoom && slot.cropZoom !== 1) && (
                                  <div className="absolute top-1 left-1 z-10 bg-green-600 text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                    <ZoomIn className="w-2.5 h-2.5" />
                                    {Math.round(slot.cropZoom * 100)}%
                                  </div>
                                )}
                                <div
                                  className="w-full h-32 bg-gray-50 rounded-lg border border-indigo-200 cursor-pointer hover:border-indigo-400 transition-colors overflow-hidden"
                                  onClick={() => openImageViewModal(
                                    slot.imageUrl!,
                                    `${section.title} - 이미지 ${slotIdx + 1}`,
                                    section.id,
                                    slotIdx
                                  )}
                                  title="클릭하여 크게 보기"
                                >
                                  <img
                                    src={slot.imageUrl}
                                    alt={`이미지 ${slotIdx + 1}`}
                                    className="w-full h-full object-cover"
                                    style={{
                                      transform: slot.cropZoom && slot.cropZoom !== 1
                                        ? `scale(${slot.cropZoom}) translate(${-(slot.cropPanX || 0) / slot.cropZoom}px, ${-(slot.cropPanY || 0) / slot.cropZoom}px)`
                                        : undefined,
                                      transformOrigin: 'center center'
                                    }}
                                  />
                                </div>
                                {/* Hover 액션 버튼들 */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/slot:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2 pointer-events-none group-hover/slot:pointer-events-auto">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openImageViewModal(
                                        slot.imageUrl!,
                                        `${section.title} - 이미지 ${slotIdx + 1}`,
                                        section.id,
                                        slotIdx
                                      );
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
                                      const textarea = document.getElementById(`slot-prompt-${section.id}-${slotIdx}`);
                                      if (textarea) {
                                        textarea.focus();
                                        // 부드럽게 스크롤
                                        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }
                                    }}
                                    className="bg-white text-gray-800 px-2 py-1 rounded text-[10px] font-medium flex items-center hover:bg-gray-100 transition-colors"
                                    title="프롬프트 수정"
                                  >
                                    <Edit3 className="w-3 h-3 mr-0.5" />
                                    수정
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
                                    title="이미지 삭제"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                  {/* 업로드 버튼 */}
                                  <label className="bg-green-600 text-white p-1 rounded hover:bg-green-700 transition-colors cursor-pointer" title="직접 업로드">
                                    <Upload className="w-3 h-3" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        const file = e.target.files?.[0];
                                        if (file) handleUploadImage(section.id, file, slotIdx);
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                </div>
                                <p className="text-xs text-green-600 flex items-center mt-1">
                                  <Eye className="w-3 h-3 mr-1" />
                                  미리보기 생성 완료 - 마우스를 올려 수정/재생성
                                </p>
                              </div>
                            )}

                            <textarea
                              id={`slot-prompt-${section.id}-${slotIdx}`}
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
                          <div
                            className="w-full h-32 bg-white rounded border border-emerald-200 cursor-pointer hover:border-emerald-400 transition-colors overflow-hidden"
                            onClick={() => openImageViewModal(
                              `data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`,
                              `${section.title} (고정 이미지)`,
                              section.id
                            )}
                            title="클릭하여 크게 보기"
                          >
                            <img
                              src={`data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`}
                              alt="고정 이미지"
                              className="w-full h-full object-cover"
                              style={{
                                transform: section.cropZoom && section.cropZoom !== 1
                                  ? `scale(${section.cropZoom}) translate(${-(section.cropPanX || 0) / section.cropZoom}px, ${-(section.cropPanY || 0) / section.cropZoom}px)`
                                  : undefined,
                                transformOrigin: 'center center'
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className={`bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 ${section.useFixedImage ? 'opacity-50' : ''} ${section.layoutType === 'text-only' ? 'hidden' : ''}`}>
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
                                  <div className="flex gap-1">
                                    {/* 직접 업로드 버튼 */}
                                    <label className="text-[10px] px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded flex items-center gap-1 cursor-pointer transition-colors">
                                      <Upload className="w-3 h-3" />
                                      업로드
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleUploadImage(section.id, file, slotIdx);
                                          e.target.value = '';
                                        }}
                                      />
                                    </label>
                                    {/* 개별 슬롯 이미지 생성 버튼 */}
                                    <button
                                      onClick={() => handleGeneratePreview(section.id, undefined, slotIdx)}
                                      disabled={generatingPreviewId === section.id || !slot.prompt}
                                      className="text-[10px] px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded flex items-center gap-1 disabled:opacity-50 transition-colors"
                                    >
                                      {generatingPreviewId === section.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Sparkles className="w-3 h-3" />
                                      )}
                                      생성
                                    </button>
                                  </div>
                                </div>

                                {/* 슬롯 이미지 미리보기 */}
                                {slot.imageUrl && (
                                  <div className="mb-2 h-24 overflow-hidden rounded border border-gray-200 bg-gray-50">
                                    <img
                                      src={slot.imageUrl}
                                      alt={`이미지 ${slotIdx + 1}`}
                                      className="w-full h-full object-cover"
                                      style={{
                                        transform: slot.cropZoom && slot.cropZoom !== 1
                                          ? `scale(${slot.cropZoom}) translate(${-(slot.cropPanX || 0) / slot.cropZoom}px, ${-(slot.cropPanY || 0) / slot.cropZoom}px)`
                                          : undefined,
                                        transformOrigin: 'center center'
                                      }}
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
                          <div className="space-y-2">
                            {/* 업로드 및 생성 버튼 헤더 */}
                            <div className="flex justify-end gap-1">
                              {/* 직접 업로드 버튼 */}
                              <label className="text-[10px] px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded flex items-center gap-1 cursor-pointer transition-colors">
                                <Upload className="w-3 h-3" />
                                업로드
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadImage(section.id, file, 0);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                            <textarea
                              rows={section.useFixedImage ? 3 : 4}
                              value={section.imagePrompt}
                              onChange={(e) => handleSectionChange(index, 'imagePrompt', e.target.value)}
                              disabled={section.useFixedImage}
                              className={`w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none ${section.useFixedImage ? 'cursor-not-allowed' : ''}`}
                              placeholder="예: 나무 테이블 위의 상품, 미니멀한 배경, 고품질 사진&#10;또는: Product on wooden table, minimalist background, high quality"
                            />
                          </div>
                        )}

                        {/* 이미지 미리보기 버튼 및 결과 */}
                        {!section.useFixedImage && (
                          <div className="mt-3">
                            {section.imageUrl && !section.isOriginalImage ? (
                              // 이미지가 생성된 경우
                              <div className="space-y-2">
                                <div className="relative group">
                                  {/* 크롭 설정 저장됨 배지 */}
                                  {(section.cropZoom && section.cropZoom !== 1) && (
                                    <div className="absolute top-1 left-1 z-10 bg-green-600 text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                      <ZoomIn className="w-2.5 h-2.5" />
                                      {Math.round(section.cropZoom * 100)}%
                                    </div>
                                  )}
                                  <div
                                    className="w-full h-32 bg-white rounded-lg border border-indigo-200 cursor-pointer hover:border-indigo-400 transition-colors overflow-hidden"
                                    onClick={() => openImageViewModal(
                                      section.imageUrl!,
                                      section.title,
                                      section.id
                                    )}
                                    title="클릭하여 크게 보기"
                                  >
                                    <img
                                      src={section.imageUrl}
                                      alt="미리보기"
                                      className="w-full h-full object-cover"
                                      style={{
                                        transform: section.cropZoom && section.cropZoom !== 1
                                          ? `scale(${section.cropZoom}) translate(${-(section.cropPanX || 0) / section.cropZoom}px, ${-(section.cropPanY || 0) / section.cropZoom}px)`
                                          : undefined,
                                        transformOrigin: 'center center'
                                      }}
                                    />
                                  </div>
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openImageViewModal(
                                          section.imageUrl!,
                                          section.title,
                                          section.id
                                        );
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
                                    {/* 업로드 버튼 */}
                                    <label className="bg-green-600 text-white p-1.5 rounded-lg hover:bg-green-700 transition-colors cursor-pointer" title="직접 업로드">
                                      <Upload className="w-3 h-3" />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const file = e.target.files?.[0];
                                          if (file) handleUploadImage(section.id, file);
                                          e.target.value = '';
                                        }}
                                      />
                                    </label>
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
      {
        previewCount > 0 && (
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
        )
      }

      {/* 프롬프트 수정 모달 */}
      {
        editPromptModal && (
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
        )
      }

      {/* 이미지 확대 보기 모달 (Pan & Zoom) */}
      {
        imageViewModal && (
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
                <div className="flex items-center gap-2">
                  {/* 줌 컨트롤 */}
                  <div className="flex items-center bg-white/10 rounded-lg px-2 py-1 gap-1">
                    <button
                      onClick={() => handleZoom(-0.25)}
                      className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
                      title="축소"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-white text-sm font-medium min-w-[50px] text-center">
                      {Math.round(imageViewModal.zoom * 100)}%
                    </span>
                    <button
                      onClick={() => handleZoom(0.25)}
                      className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
                      title="확대"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleResetZoom}
                      className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors ml-1"
                      title="초기화"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setImageViewModal(null)}
                    className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* 이미지 영역 (Pan & Zoom) */}
              <div
                className={`flex-1 overflow-hidden p-6 bg-gray-100 flex items-center justify-center ${imageViewModal.zoom > 1 ? 'cursor-grab' : 'cursor-default'
                  } ${isDragging ? 'cursor-grabbing' : ''}`}
                onWheel={handleWheelZoom}
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
              >
                <div
                  style={{
                    transform: `scale(${imageViewModal.zoom}) translate(${imageViewModal.panX / imageViewModal.zoom}px, ${imageViewModal.panY / imageViewModal.zoom}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  }}
                >
                  <img
                    src={imageViewModal.imageUrl}
                    alt={imageViewModal.sectionTitle}
                    className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-lg select-none"
                    draggable={false}
                  />
                </div>
              </div>

              {/* 도움말 & 액션 버튼 */}
              <div className="bg-white border-t px-6 py-4 flex justify-between items-center">
                <div className="text-sm text-gray-500 flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <ZoomIn className="w-4 h-4" />
                    마우스 휠: 확대/축소
                  </span>
                  {imageViewModal.zoom > 1 && (
                    <span className="flex items-center gap-1">
                      <Move className="w-4 h-4" />
                      드래그: 이동
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  {/* 크롭 설정 저장 버튼 */}
                  <button
                    onClick={handleSaveCrop}
                    disabled={imageViewModal.zoom === 1 && imageViewModal.panX === 0 && imageViewModal.panY === 0}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="현재 확대/위치 설정을 저장하여 최종 출력물에 반영합니다"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    크롭 저장
                  </button>
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
        )
      }

      {/* 섹션 추가 모달 (확장) */}
      {addSectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-bold text-white">새 섹션 추가</h3>
              <button onClick={() => setAddSectionModal(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 탭 */}
            <div className="flex border-b flex-shrink-0">
              <button
                onClick={() => setAddSectionModal({ ...addSectionModal, activeTab: 'new' })}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${addSectionModal.activeTab === 'new'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Plus className="w-4 h-4 inline mr-1" />
                새로 만들기
              </button>
              <button
                onClick={() => setAddSectionModal({ ...addSectionModal, activeTab: 'preset' })}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${addSectionModal.activeTab === 'preset'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Bookmark className="w-4 h-4 inline mr-1" />
                프리셋에서 ({sectionPresets.length})
              </button>
            </div>

            {/* 콘텐츠 */}
            <div className="flex-1 overflow-y-auto">
              {/* 새로 만들기 탭 */}
              {addSectionModal.activeTab === 'new' && (
                <div className="p-6 space-y-5">
                  {/* 섹션 타입 선택 */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">섹션 타입</label>
                    <select
                      value={addSectionModal.sectionType}
                      onChange={(e) => {
                        const newType = e.target.value;
                        const recommendedLayout = layoutRecommendations[newType] || 'full-width';
                        setAddSectionModal({
                          ...addSectionModal,
                          sectionType: newType,
                          layoutType: recommendedLayout,
                          slotCount: recommendedLayout === 'grid-3' ? 3 : recommendedLayout === 'grid-2' ? 2 : 1
                        });
                      }}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {Object.entries(sectionTypeLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 레이아웃 선택 */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      레이아웃 <span className="text-xs font-normal text-gray-400">(타입에 따라 자동 추천)</span>
                    </label>
                    <select
                      value={addSectionModal.layoutType}
                      onChange={(e) => {
                        const newLayout = e.target.value;
                        setAddSectionModal({
                          ...addSectionModal,
                          layoutType: newLayout,
                          slotCount: newLayout === 'grid-3' ? 3 : newLayout === 'grid-2' ? 2 : 1
                        });
                      }}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {Object.entries(layoutTypeLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 이미지 슬롯 수 (Grid 레이아웃일 때만) */}
                  {(addSectionModal.layoutType === 'grid-2' || addSectionModal.layoutType === 'grid-3') && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">이미지 슬롯 수</label>
                      <div className="flex gap-2">
                        {[2, 3, 4].map((num) => (
                          <button
                            key={num}
                            onClick={() => setAddSectionModal({ ...addSectionModal, slotCount: num })}
                            className={`flex-1 py-2 rounded-lg border font-medium transition-colors ${addSectionModal.slotCount === num
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                          >
                            {num}개
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 고급 설정 토글 */}
                  <button
                    onClick={() => setAddSectionModal({ ...addSectionModal, showAdvanced: !addSectionModal.showAdvanced })}
                    className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-600 transition-colors"
                  >
                    <span className="flex items-center">
                      <Lock className="w-4 h-4 mr-2" />
                      고급 설정 (고정 문구/이미지)
                    </span>
                    {addSectionModal.showAdvanced ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {/* 고급 설정 영역 */}
                  {addSectionModal.showAdvanced && (
                    <div className="space-y-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                      {/* 고정 문구 */}
                      <div>
                        <label className="text-xs font-bold text-amber-700 block mb-1.5 flex items-center">
                          <Type className="w-3 h-3 mr-1" />
                          고정 문구
                        </label>
                        <textarea
                          rows={2}
                          value={addSectionModal.fixedText}
                          onChange={(e) => setAddSectionModal({ ...addSectionModal, fixedText: e.target.value })}
                          placeholder="예: '무료 배송', 'KC 인증 완료' 등"
                          className="w-full text-sm border border-amber-200 bg-white rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none resize-none"
                        />
                      </div>

                      {/* 고정 이미지 */}
                      <div>
                        <label className="text-xs font-bold text-emerald-700 block mb-1.5 flex items-center">
                          <ImageIcon className="w-3 h-3 mr-1" />
                          고정 이미지
                        </label>

                        <input
                          type="file"
                          ref={modalImageInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleModalImageUpload(file);
                            e.target.value = '';
                          }}
                        />

                        {addSectionModal.fixedImageBase64 ? (
                          <div className="relative group">
                            <img
                              src={`data:${addSectionModal.fixedImageMimeType || 'image/png'};base64,${addSectionModal.fixedImageBase64}`}
                              alt="고정 이미지"
                              className="w-full h-32 object-contain bg-white rounded-lg border border-emerald-200"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                              <button
                                onClick={() => modalImageInputRef.current?.click()}
                                className="px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium"
                              >
                                변경
                              </button>
                              <button
                                onClick={handleRemoveModalImage}
                                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => modalImageInputRef.current?.click()}
                            className="border-2 border-dashed border-emerald-200 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all"
                          >
                            <Upload className="w-6 h-6 mx-auto mb-1 text-emerald-300" />
                            <p className="text-xs font-medium text-emerald-600">클릭하여 업로드</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 프리셋으로 저장 옵션 */}
                  {addSectionModal.saveAsPreset ? (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
                      <label className="text-xs font-bold text-indigo-700 block flex items-center">
                        <Bookmark className="w-3 h-3 mr-1" />
                        프리셋 이름
                      </label>
                      <input
                        type="text"
                        value={addSectionModal.presetName}
                        onChange={(e) => setAddSectionModal({ ...addSectionModal, presetName: e.target.value })}
                        placeholder="예: 배송/반품 안내"
                        className="w-full text-sm border border-indigo-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-400 outline-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAddSectionModal({ ...addSectionModal, saveAsPreset: false, presetName: '' })}
                          className="flex-1 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleSaveAsPreset}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddSectionModal({ ...addSectionModal, saveAsPreset: true })}
                      className="w-full py-2 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg font-medium transition-colors flex items-center justify-center"
                    >
                      <Bookmark className="w-4 h-4 mr-1" />
                      이 설정을 프리셋으로 저장
                    </button>
                  )}
                </div>
              )}

              {/* 프리셋에서 탭 */}
              {addSectionModal.activeTab === 'preset' && (
                <div className="p-6">
                  {sectionPresets.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">저장된 프리셋이 없습니다</p>
                      <p className="text-sm mt-1">"새로 만들기" 탭에서 프리셋을 저장하세요</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sectionPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer"
                          onClick={() => handleApplyPreset(preset)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                                {preset.name}
                              </h4>
                              <div className="flex flex-wrap gap-1 mt-2">
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                  {sectionTypeLabels[preset.sectionType] || preset.sectionType}
                                </span>
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                  {layoutTypeLabels[preset.layoutType] || preset.layoutType}
                                </span>
                                {preset.fixedText && (
                                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded flex items-center">
                                    <Type className="w-2 h-2 mr-0.5" />
                                    고정문구
                                  </span>
                                )}
                                {preset.fixedImageBase64 && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded flex items-center">
                                    <ImageIcon className="w-2 h-2 mr-0.5" />
                                    고정이미지
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePreset(preset.id);
                              }}
                              className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="프리셋 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {preset.fixedImageBase64 && (
                            <div className="mt-3">
                              <img
                                src={`data:${preset.fixedImageMimeType || 'image/png'};base64,${preset.fixedImageBase64}`}
                                alt="프리셋 고정 이미지"
                                className="w-full h-20 object-contain bg-gray-50 rounded border border-gray-100"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 푸터 (새로 만들기 탭에서만 표시) */}
            {addSectionModal.activeTab === 'new' && !addSectionModal.saveAsPreset && (
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 flex-shrink-0 border-t">
                <button
                  onClick={() => setAddSectionModal(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={confirmAddSection}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  섹션 추가
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 하단 플로팅 액션 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-2xl z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* 섹션/이미지 상태 정보 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                <span className="font-bold text-sm">{analysis.sections.length}개 섹션</span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              이미지: {analysis.sections.filter(s => s.imageUrl || s.imageSlots?.some(slot => slot.imageUrl) || s.layoutType === 'text-only').length}/{analysis.sections.length} 완료
            </div>
          </div>

          {/* 상세페이지 생성 버튼 */}
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                상세페이지 생성 시작
              </>
            )}
          </button>
        </div>
      </div>

      {/* 하단 플로팅 바 공간 확보 */}
      <div className="h-24" />
    </div>
  );
});

StepAnalysis.displayName = 'StepAnalysis';