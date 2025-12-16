import React, { useState } from 'react';
import { AppMode, Step, UploadedFile, ProductAnalysis } from './types';
import { StepModeSelection } from './components/StepModeSelection';
import { StepUpload } from './components/StepUpload';
import { StepAnalysis } from './components/StepAnalysis';
import { StepResult } from './components/StepResult';
import { SettingsModal } from './components/SettingsModal';
import { analyzeProductImage, generateSectionImage } from './services/geminiService';
import { getTemplates } from './services/templateService';
import { Loader2, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<Step>(Step.SELECT_MODE);
  const [mode, setMode] = useState<AppMode>(AppMode.CREATION);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]); // Changed to Array
  const [analysisResult, setAnalysisResult] = useState<ProductAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleModeSelect = (selectedMode: AppMode) => {
    setMode(selectedMode);
    setStep(Step.UPLOAD_DATA);
  };

  const handleFilesSelect = async (filesData: UploadedFile[], templateId?: string) => {
    setUploadedFiles(filesData);
    setStep(Step.ANALYSIS_REVIEW);
    setIsLoading(true);

    const templates = getTemplates();
    const selectedTemplate = templateId ? templates.find(t => t.id === templateId) : null;
    
    let message = mode === AppMode.CREATION 
      ? `상품 이미지 ${filesData.length}장을 분석하고 컨셉을 도출하고 있습니다...` 
      : `상세페이지 이미지 ${filesData.length}장을 분석하여 현지화 작업을 설계 중입니다...`;
    
    if (selectedTemplate) {
      message = `'${selectedTemplate.name}' 템플릿 구조에 맞춰 상세페이지를 기획하고 있습니다...`;
    }

    setLoadingMessage(message);

    try {
      // Pass arrays of base64 and mimeTypes
      const base64List = filesData.map(f => f.base64);
      const mimeTypeList = filesData.map(f => f.mimeType);

      const result = await analyzeProductImage(
        base64List, 
        mimeTypeList, 
        mode,
        selectedTemplate
      );
      setAnalysisResult(result);
    } catch (error) {
      console.error(error);
      alert("분석 중 오류가 발생했습니다. 다시 시도해주세요.");
      setStep(Step.UPLOAD_DATA);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!analysisResult) return;
    
    setStep(Step.GENERATING);
    setIsLoading(true);
    setLoadingMessage("섹션별 상세 이미지를 생성하고 레이아웃을 구성하고 있습니다... (약 10-20초 소요)");

    try {
      // Deep copy to modify
      const finalResult = { ...analysisResult };
      const primaryFile = uploadedFiles.length > 0 ? uploadedFiles[0] : null;

      const newSections = [];
      for (const section of finalResult.sections) {
         if (section.imagePrompt) {
           const imageUrl = await generateSectionImage(
             section.imagePrompt,
             primaryFile?.base64, // Use the first image as reference style
             primaryFile?.mimeType,
             mode
           );
           newSections.push({ ...section, imageUrl });
         } else {
           newSections.push(section);
         }
      }
      finalResult.sections = newSections;
      
      setAnalysisResult(finalResult);
      setStep(Step.RESULT);
    } catch (error) {
      console.error(error);
      alert("이미지 생성 중 오류가 발생했습니다. 텍스트 결과만 표시합니다.");
      setStep(Step.RESULT);
    } finally {
      setIsLoading(false);
    }
  };

  const restart = () => {
    setStep(Step.SELECT_MODE);
    setUploadedFiles([]);
    setAnalysisResult(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={restart}>
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              G
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">Gemini Commerce</span>
          </div>
          
          <div className="flex items-center gap-4">
            {step > Step.SELECT_MODE && (
              <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {mode === AppMode.CREATION ? '모드 A: 신규 생성' : '모드 B: 현지화'}
              </div>
            )}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="설정 (구글 시트 / 템플릿)"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Gemini가 작업 중입니다</h3>
            <p className="text-gray-500 animate-pulse">{loadingMessage}</p>
          </div>
        ) : (
          <>
            {step === Step.SELECT_MODE && <StepModeSelection onSelectMode={handleModeSelect} />}
            {step === Step.UPLOAD_DATA && <StepUpload mode={mode} onFileSelect={handleFilesSelect} />}
            {step === Step.ANALYSIS_REVIEW && analysisResult && (
              <StepAnalysis 
                analysis={analysisResult} 
                onUpdate={setAnalysisResult} 
                onConfirm={handleGenerate}
                isLoading={isLoading}
              />
            )}
            {step === Step.RESULT && analysisResult && (
              <StepResult 
                data={analysisResult} 
                onRestart={restart} 
                mode={mode} 
                uploadedFiles={uploadedFiles} 
                onUpdate={setAnalysisResult} 
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
};

export default App;