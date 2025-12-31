import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { AppMode, Step, UploadedFile, ProductAnalysis, ProductInputData } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider, useToastContext } from './contexts/ToastContext';
import { StepModeSelection } from './components/StepModeSelection';
import { StepUpload } from './components/StepUpload';
import { StepAnalysis } from './components/StepAnalysis';
import { StepResult } from './components/StepResult';
import { StepImageEditResult } from './components/StepImageEditResult';
import { SettingsModal } from './components/SettingsModal';
import { GeneratingProgress, GenerationProgress } from './components/GeneratingProgress';
import { analyzeProductImage, generateSectionImage, editSingleImageWithProgress, findMatchingColorOption, buildCollagePrompt } from './services/geminiService';
import { getTemplates, initializeBuiltInTemplates } from './services/templateService';
import {
  isAutoBackupEnabled,
  isSettingsEmpty,
  restoreSettingsFromDrive,
  applyRestoredSettings
} from './services/settingsBackupService';
import { Loader2, Settings } from 'lucide-react';
import { ProgressStepper } from './components/ProgressStepper';

const AppContent: React.FC = () => {
  const [step, setStep] = useState<Step>(Step.SELECT_MODE);
  const [mode, setMode] = useState<AppMode>(AppMode.CREATION);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]); // Changed to Array
  const [analysisResult, setAnalysisResult] = useState<ProductAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 자동 복원 상태
  const [isAutoRestoring, setIsAutoRestoring] = useState(false);

  // 이미지 생성 진행 상태
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    current: 0,
    total: 0,
    currentSectionId: '',
    currentSectionTitle: '',
    completedSectionIds: [],
    startTime: null
  });

  // Toast 알림 시스템
  const toast = useToastContext();

  // 앱 시작 시 빌트인 템플릿 초기화 및 자동 복원 시도
  useEffect(() => {
    // 빌트인 템플릿 초기화 (한 번만 실행)
    initializeBuiltInTemplates();

    const tryAutoRestore = async () => {
      // 자동 백업이 활성화되어 있고, 현재 설정이 비어있을 때만 복원 시도
      if (isAutoBackupEnabled() && isSettingsEmpty()) {
        console.log('[App] 자동 복원 시도...');
        setIsAutoRestoring(true);

        try {
          const result = await restoreSettingsFromDrive();

          if (result.success && result.settings) {
            applyRestoredSettings(result.settings);

            const backupDateStr = result.settings.backupDate
              ? new Date(result.settings.backupDate).toLocaleString('ko-KR')
              : '';

            toast.success(`설정이 자동으로 복원되었습니다!${backupDateStr ? ` (${backupDateStr})` : ''}`);
            console.log('[App] 자동 복원 성공');
          } else if (result.status !== 'not_found') {
            console.log('[App] 자동 복원 실패:', result.message);
          }
        } catch (error) {
          console.error('[App] 자동 복원 오류:', error);
        } finally {
          setIsAutoRestoring(false);
        }
      }
    };

    tryAutoRestore();
  }, [toast]);

  const handleModeSelect = useCallback((selectedMode: AppMode) => {
    setMode(selectedMode);
    setStep(Step.UPLOAD_DATA);
  }, []);

  // 상품 정보 상태 (새로운 Phase 7 데이터)
  const [productInputData, setProductInputData] = useState<ProductInputData | null>(null);

  const handleProductSubmit = useCallback(async (data: ProductInputData) => {
    setProductInputData(data);

    // 모든 이미지 합치기 (메인 + 컬러옵션)
    const allImages = [...data.mainImages];
    data.colorOptions.forEach(opt => allImages.push(...opt.images));
    setUploadedFiles(allImages);

    // 모드 C: 이미지 수정 - 바로 이미지 수정 시작
    if (mode === AppMode.IMAGE_EDIT) {
      if (allImages.length === 0) {
        toast.error('이미지를 업로드해주세요.');
        return;
      }

      setStep(Step.GENERATING);
      setIsLoading(true);

      try {
        const firstFile = allImages[0];

        // 1단계: 이미지 분석
        setLoadingMessage('이미지를 분석하고 텍스트를 감지하는 중...');
        console.log('[Mode C] 1단계: 이미지 분석 시작');

        // 진행 상태 업데이트 콜백과 함께 이미지 수정 실행
        // 이미지 생성은 시간이 오래 걸릴 수 있으므로 6분 타임아웃 적용
        const editedImageUrl = await Promise.race([
          editSingleImageWithProgress(
            firstFile.base64,
            firstFile.mimeType,
            (step: string, message: string) => {
              setLoadingMessage(message);
              console.log(`[Mode C] ${step}: ${message}`);
            }
          ),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('이미지 수정이 시간 초과되었습니다 (6분). 이미지 생성은 시간이 오래 걸릴 수 있습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.')), 360000) // 6분 타임아웃
          )
        ]);

        // 모드 C는 단일 이미지 수정 결과만 저장
        // 원본 이미지 URL 저장 (다운로드용)
        const originalImageUrl = firstFile.previewUrl || `data:${firstFile.mimeType};base64,${firstFile.base64}`;

        // ProductAnalysis 형식으로 변환 (호환성 유지)
        const result: ProductAnalysis = {
          productName: '이미지 수정 결과',
          mainFeatures: [],
          marketingCopy: '이미지의 외국어 텍스트를 한국어로 번역하거나 삭제한 결과입니다.',
          sections: [
            {
              id: 'edited-image',
              title: '수정된 이미지',
              content: '외국어 텍스트가 한국어로 번역되었거나 제거된 이미지입니다.',
              imagePrompt: '',
              imageUrl: editedImageUrl,
              isOriginalImage: false
            }
          ],
          detectedCategory: undefined
        };

        // 원본 이미지 URL을 uploadedFiles에 저장 (결과 화면에서 사용)
        setUploadedFiles([{ ...firstFile, previewUrl: originalImageUrl }]);
        setAnalysisResult(result);
        setStep(Step.RESULT);
        toast.success('이미지 수정이 완료되었습니다!');
      } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "이미지 수정 중 오류가 발생했습니다.";
        toast.error(errorMessage + " 다시 시도해주세요.");
        setStep(Step.UPLOAD_DATA);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 모드 A, B: 기존 플로우
    setStep(Step.ANALYSIS_REVIEW);
    setIsLoading(true);

    const templates = getTemplates();
    const selectedTemplate = data.selectedTemplateId ? templates.find(t => t.id === data.selectedTemplateId) : null;

    let message = mode === AppMode.CREATION
      ? `상품 이미지 ${allImages.length}장을 분석하고 컨셉을 도출하고 있습니다...`
      : `상세페이지 이미지 ${allImages.length}장을 분석하여 현지화 작업을 설계 중입니다...`;

    if (selectedTemplate) {
      message = `'${selectedTemplate.name}' 템플릿 구조에 맞춰 상세페이지를 기획하고 있습니다...`;
    }

    // 상품 정보가 있으면 메시지에 포함
    if (data.productName) {
      message = `'${data.productName}' 상품을 분석 중입니다...`;
    }

    setLoadingMessage(message);

    try {
      // Pass arrays of base64 and mimeTypes
      const base64List = allImages.map(f => f.base64);
      const mimeTypeList = allImages.map(f => f.mimeType);

      const result = await analyzeProductImage(
        base64List,
        mimeTypeList,
        mode,
        selectedTemplate,
        data  // 상품 정보 전달
      );
      setAnalysisResult(result);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.";
      toast.error(errorMessage + " 다시 시도해주세요.");
      setStep(Step.UPLOAD_DATA);
    } finally {
      setIsLoading(false);
    }
  }, [mode, toast]);

  const handleGenerate = useCallback(async () => {
    if (!analysisResult) return;

    setStep(Step.GENERATING);
    setIsLoading(true);

    // 생성할 섹션 계산 (고정 이미지, 미리보기, text-only 레이아웃 제외)
    const sectionsToGenerate = analysisResult.sections.filter(
      s => !s.isOriginalImage && !s.isPreview && s.imagePrompt && !s.imageUrl && s.layoutType !== 'text-only'
    );

    // 진행 상태 초기화
    setGenerationProgress({
      current: 0,
      total: sectionsToGenerate.length,
      currentSectionId: '',
      currentSectionTitle: '',
      completedSectionIds: [],
      startTime: Date.now()
    });

    try {
      // Deep copy to modify
      const finalResult = { ...analysisResult };
      const primaryFile = uploadedFiles.length > 0 ? uploadedFiles[0] : null;

      // ⭐ DEBUG: 이미지 생성 전 참조 이미지 상태 확인
      console.log('[App.handleGenerate] ===== 이미지 생성 시작 =====');
      console.log('[App.handleGenerate] uploadedFiles 개수:', uploadedFiles.length);
      console.log('[App.handleGenerate] primaryFile 존재:', !!primaryFile);
      console.log('[App.handleGenerate] primaryFile.base64 크기:', primaryFile?.base64 ? `${Math.round(primaryFile.base64.length / 1024)}KB` : 'N/A');

      const newSections = [];
      let completedCount = 0;

      for (const section of finalResult.sections) {
        // ★ 고정 이미지(fixedImageBase64)가 있는 경우: imageUrl로 변환하여 사용
        if (section.useFixedImage && section.fixedImageBase64) {
          // fixedImageBase64를 data URL로 변환하여 imageUrl에 설정
          const fixedImageUrl = `data:${section.fixedImageMimeType || 'image/png'};base64,${section.fixedImageBase64}`;
          console.log(`[Generate] 섹션 "${section.title}": 고정 이미지 사용 (AI 생성 건너뜀)`);
          newSections.push({
            ...section,
            imageUrl: fixedImageUrl,
            isOriginalImage: true
          });
          // 완료 목록에 추가
          setGenerationProgress(prev => ({
            ...prev,
            completedSectionIds: [...prev.completedSectionIds, section.id]
          }));
        }
        // 이미 imageUrl이 있는 고정 이미지 섹션
        else if (section.isOriginalImage && section.imageUrl) {
          console.log(`[Generate] 섹션 "${section.title}": 고정 이미지 사용 (AI 생성 건너뜀)`);
          newSections.push(section);
          // 완료 목록에 추가
          setGenerationProgress(prev => ({
            ...prev,
            completedSectionIds: [...prev.completedSectionIds, section.id]
          }));
        }
        // 미리보기로 이미 생성된 이미지가 있는 섹션도 건너뛰기
        else if (section.isPreview && section.imageUrl) {
          console.log(`[Generate] 섹션 "${section.title}": 미리보기 이미지 사용 (재생성 건너뜀)`);
          newSections.push({ ...section, isPreview: false }); // 최종 확정으로 변경
          // 완료 목록에 추가
          setGenerationProgress(prev => ({
            ...prev,
            completedSectionIds: [...prev.completedSectionIds, section.id]
          }));
        }
        // ★ 콜라주 레이아웃 처리 (AI가 1장의 콜라주 이미지 생성)
        else if (section.layoutType?.startsWith('collage-')) {
          console.log(`[Generate] 섹션 "${section.title}": 콜라주 레이아웃 (${section.layoutType}) - 단일 이미지 생성`);

          setGenerationProgress(prev => ({
            ...prev,
            currentSectionId: section.id,
            currentSectionTitle: `${section.title} (콜라주)`
          }));

          // 상품 설명 추출 (analysisResult에서)
          const productDescription = analysisResult?.productVisualDescription || analysisResult?.productName || 'the product';

          // 콜라주 프롬프트 생성
          const collagePrompt = buildCollagePrompt(
            section.layoutType,
            productDescription,
            section.imagePrompt
          );

          console.log(`[Generate] 콜라주 프롬프트: ${collagePrompt.slice(0, 100)}...`);

          const imageUrl = await generateSectionImage(
            collagePrompt,
            primaryFile?.base64,
            primaryFile?.mimeType,
            mode,
            productInputData?.modelSettings
          );

          newSections.push({ ...section, imageUrl });
          completedCount++;

          setGenerationProgress(prev => ({
            ...prev,
            current: completedCount,
            completedSectionIds: [...prev.completedSectionIds, section.id],
            currentSectionId: '',
            currentSectionTitle: ''
          }));
        }
        // ★ 다중 이미지 슬롯 처리 (grid-2, grid-3 레이아웃)
        else if (section.imageSlots && section.imageSlots.length > 0) {
          console.log(`[Generate] 섹션 "${section.title}": ${section.imageSlots.length}개 이미지 슬롯 생성 시작`);

          setGenerationProgress(prev => ({
            ...prev,
            currentSectionId: section.id,
            currentSectionTitle: `${section.title} (${section.imageSlots?.length}개 이미지)`
          }));

          const updatedSlots = [];
          for (let i = 0; i < section.imageSlots.length; i++) {
            const slot = section.imageSlots[i];

            // 이미 이미지가 있으면 건너뛰기
            if (slot.imageUrl) {
              updatedSlots.push(slot);
              continue;
            }

            // ★ 프롬프트에서 컬러명을 추출하여 해당 컬러옵션 이미지를 참조
            let slotPrompt = slot.prompt || section.imagePrompt || '';

            // [Bugfix] 템플릿의 {{COLOR_N}} 플레이스홀더를 실제 컬러명으로 치환
            if (productInputData?.colorOptions) {
              productInputData.colorOptions.forEach((opt, idx) => {
                const placeholder = `{{COLOR_${idx + 1}}}`;
                slotPrompt = slotPrompt.replace(new RegExp(placeholder, 'gi'), opt.colorName);
              });
            }

            const matchedColorOption = findMatchingColorOption(slotPrompt, productInputData?.colorOptions);
            const colorOptionImage = matchedColorOption?.images?.[0];
            const refImage = colorOptionImage || primaryFile;

            console.log(`[Generate] 섹션 "${section.title}" - 슬롯 ${i + 1}/${section.imageSlots.length}: "${slotPrompt.slice(0, 50)}..." (참조: ${matchedColorOption ? `컬러옵션[${matchedColorOption.colorName}]` : '기본이미지'})`);

            try {
              const imageUrl = await generateSectionImage(
                slot.prompt || section.imagePrompt || '',
                refImage?.base64,
                refImage?.mimeType,
                mode,
                productInputData?.modelSettings
              );
              updatedSlots.push({ ...slot, imageUrl });
            } catch (slotError) {
              console.error(`[Generate] 슬롯 ${i + 1} 생성 실패:`, slotError);
              updatedSlots.push(slot); // 실패해도 원본 슬롯 유지
            }
          }

          // 첫 번째 슬롯의 이미지를 section.imageUrl에도 저장 (호환성)
          const firstSlotImage = updatedSlots.find(s => s.imageUrl)?.imageUrl;

          newSections.push({
            ...section,
            imageSlots: updatedSlots,
            imageUrl: firstSlotImage
          });

          completedCount++;
          setGenerationProgress(prev => ({
            ...prev,
            current: completedCount,
            completedSectionIds: [...prev.completedSectionIds, section.id],
            currentSectionId: '',
            currentSectionTitle: ''
          }));
        }
        // 단일 이미지 프롬프트 처리 (기존 방식) - text-only 레이아웃은 건너뛰기
        else if (section.imagePrompt && section.layoutType !== 'text-only') {
          // 현재 생성 중인 섹션 표시
          setGenerationProgress(prev => ({
            ...prev,
            currentSectionId: section.id,
            currentSectionTitle: section.title
          }));

          console.log(`[Generate] 섹션 "${section.title}": AI 이미지 생성 중...`);
          // 프롬프트 치환 및 참조 이미지 선택
          let sectionPrompt = section.imagePrompt;
          if (productInputData?.colorOptions) {
            productInputData.colorOptions.forEach((opt, idx) => {
              const placeholder = `{{COLOR_${idx + 1}}}`;
              sectionPrompt = sectionPrompt.replace(new RegExp(placeholder, 'gi'), opt.colorName);
            });
          }
          const matchedColor = findMatchingColorOption(sectionPrompt, productInputData?.colorOptions);
          const refImg = matchedColor?.images?.[0] || primaryFile;

          const imageUrl = await generateSectionImage(
            sectionPrompt,
            refImg?.base64, // Use matched color image or default
            refImg?.mimeType,
            mode,
            productInputData?.modelSettings
          );
          newSections.push({ ...section, imageUrl });
          completedCount++;

          // 진행률 업데이트
          setGenerationProgress(prev => ({
            ...prev,
            current: completedCount,
            completedSectionIds: [...prev.completedSectionIds, section.id],
            currentSectionId: '',
            currentSectionTitle: ''
          }));
        } else {
          newSections.push(section);
        }
      }
      finalResult.sections = newSections;

      setAnalysisResult(finalResult);
      setStep(Step.RESULT);
      toast.success("상세페이지 생성이 완료되었습니다!");
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "이미지 생성 중 오류가 발생했습니다.";
      toast.warning(errorMessage + " 텍스트 결과만 표시합니다.");
      setStep(Step.RESULT);
    } finally {
      setIsLoading(false);
      // 진행 상태 초기화
      setGenerationProgress({
        current: 0,
        total: 0,
        currentSectionId: '',
        currentSectionTitle: '',
        completedSectionIds: [],
        startTime: null
      });
    }
  }, [analysisResult, uploadedFiles, mode, toast]);

  const restart = useCallback(() => {
    setStep(Step.SELECT_MODE);
    setUploadedFiles([]);
    setAnalysisResult(null);
  }, []);

  // 이전 단계로 돌아가기 (상태 유지)
  const goBack = useCallback(() => {
    setStep(Step.ANALYSIS_REVIEW);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  // 메모이제이션된 모드 표시 텍스트
  const modeDisplayText = useMemo(() => {
    if (mode === AppMode.CREATION) return '모드 A: 신규 생성';
    if (mode === AppMode.LOCALIZATION) return '모드 B: 현지화';
    if (mode === AppMode.IMAGE_EDIT) return '모드 C: 이미지 수정';
    return '모드 선택';
  }, [mode]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-50" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={restart}>
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              G
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">PageGenie</span>
          </div>

          <div className="flex items-center gap-4">
            {step > Step.SELECT_MODE && (
              <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {modeDisplayText}
              </div>
            )}
            <button
              onClick={handleOpenSettings}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="설정 (구글 시트 / 템플릿)"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Progress Stepper (모드 선택 단계 이후 표시) */}
      {step > Step.SELECT_MODE && step <= Step.RESULT && mode !== AppMode.IMAGE_EDIT && (
        <div className="bg-white border-b border-gray-100 py-6 mb-2">
          <ProgressStepper
            currentStep={
              step === Step.UPLOAD_DATA ? 1 :
                (step === Step.ANALYSIS_REVIEW || step === Step.GENERATING) ? 2 :
                  step === Step.RESULT ? 3 : 0
            }
          />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1" style={{ minHeight: 'calc(100vh - 80px)' }}>
        {/* Step.GENERATING일 때 진행 상태 표시 */}
        {step === Step.GENERATING && analysisResult && (
          <GeneratingProgress
            sections={analysisResult.sections}
            progress={generationProgress}
          />
        )}

        {/* 모드 C: 이미지 수정 중 로딩 화면 */}
        {step === Step.GENERATING && mode === AppMode.IMAGE_EDIT && !analysisResult && (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <Loader2 className="w-16 h-16 text-green-600 animate-spin mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">이미지 분석 및 수정 중...</h3>
            <p className="text-gray-500 animate-pulse mb-4">{loadingMessage || '이미지의 외국어 텍스트를 감지하고 있습니다...'}</p>
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  이미지 분석 중...
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                  텍스트 감지 및 번역 가능 여부 판단
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                  수정된 이미지 생성 중
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading && step !== Step.GENERATING ? (
          <div className="flex flex-col items-center justify-center h-[70vh] px-4">
            {/* 메인 로딩 애니메이션 */}
            <div className="relative mb-8">
              <div className="w-20 h-20 border-4 border-blue-200 rounded-full"></div>
              <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <span className="text-2xl">🤖</span>
              </div>
            </div>

            {/* 메인 제목 */}
            <h3 className="text-2xl font-bold text-gray-900 mb-3">전자상거래 전문 AI가 작업 중입니다</h3>

            {/* 현재 진행 상태 */}
            <p className="text-lg text-blue-600 font-medium mb-6 text-center animate-pulse">{loadingMessage}</p>

            {/* 진행 정보 카드 */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 max-w-md w-full mb-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">~15-30초</div>
                  <div className="text-xs text-gray-500 mt-1">예상 분석 시간</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">6개</div>
                  <div className="text-xs text-gray-500 mt-1">생성될 섹션 수</div>
                </div>
              </div>

              {/* 진행 단계 */}
              <div className="mt-5 space-y-2">
                <div className="flex items-center text-sm">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs mr-3">✓</div>
                  <span className="text-gray-700">이미지 분석 중...</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs mr-3 animate-pulse">2</div>
                  <span className="text-gray-500">상품 정보 추출 및 구조화</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center text-xs mr-3">3</div>
                  <span className="text-gray-400">섹션별 콘텐츠 생성</span>
                </div>
              </div>
            </div>

            {/* 팁 */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 max-w-md w-full">
              <div className="flex items-start">
                <span className="mr-2">💡</span>
                <p className="text-sm text-amber-800">
                  <strong>Tip:</strong> 분석 완료 후 섹션별로 내용을 수정하고 레이아웃을 변경할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {step === Step.SELECT_MODE && <StepModeSelection onSelectMode={handleModeSelect} />}
            {step === Step.UPLOAD_DATA && <StepUpload mode={mode} onProductSubmit={handleProductSubmit} />}
            {step === Step.ANALYSIS_REVIEW && analysisResult && (
              <StepAnalysis
                analysis={analysisResult}
                onUpdate={setAnalysisResult}
                onConfirm={handleGenerate}
                isLoading={isLoading}
                uploadedFiles={uploadedFiles}
                mode={mode}
                productInputData={productInputData}
              />
            )}
            {step === Step.RESULT && analysisResult && (
              mode === AppMode.IMAGE_EDIT ? (
                <StepImageEditResult
                  originalImageUrl={uploadedFiles[0]?.previewUrl || uploadedFiles[0]?.imageUrl || ''}
                  editedImageUrl={analysisResult.sections[0]?.imageUrl || ''}
                  onRestart={restart}
                />
              ) : (
                <StepResult
                  data={analysisResult}
                  onRestart={restart}
                  onGoBack={goBack}
                  mode={mode}
                  uploadedFiles={uploadedFiles}
                  onUpdate={setAnalysisResult}
                  onOpenSettings={handleOpenSettings}
                />
              )
            )}
            {/* 디버깅: step이 예상과 다른 경우 (GENERATING 제외) */}
            {step !== Step.SELECT_MODE && step !== Step.UPLOAD_DATA && step !== Step.ANALYSIS_REVIEW && step !== Step.RESULT && step !== Step.GENERATING && (
              <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                  <p className="text-gray-500">현재 Step: {step}</p>
                  <p className="text-sm text-gray-400 mt-2">예상치 못한 상태입니다.</p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;