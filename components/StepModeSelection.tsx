import React, { useCallback } from 'react';
import { AppMode } from '../types';
import { Sparkles, Globe, ArrowRight, Image as ImageIcon } from 'lucide-react';

interface Props {
  onSelectMode: (mode: AppMode) => void;
}

export const StepModeSelection: React.FC<Props> = React.memo(({ onSelectMode }) => {
  const handleCreationClick = useCallback(() => {
    onSelectMode(AppMode.CREATION);
  }, [onSelectMode]);

  const handleLocalizationClick = useCallback(() => {
    onSelectMode(AppMode.LOCALIZATION);
  }, [onSelectMode]);

  const handleImageEditClick = useCallback(() => {
    onSelectMode(AppMode.IMAGE_EDIT);
  }, [onSelectMode]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 16px' }}>
      <div className="text-center mb-12" style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>
          PageGenie
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          상품 이미지만 있으면 AI가 상세페이지를 자동으로 설계하고 디자인합니다.<br />
          현지화가 필요한 해외 상품 페이지도 완벽하게 한국어 버전으로 재탄생합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Mode A: Creation */}
        <button
          onClick={handleCreationClick}
          className="group relative flex flex-col items-start p-8 bg-white border-2 border-transparent hover:border-blue-500 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles size={120} className="text-blue-600" />
          </div>
          <div className="p-3 bg-blue-100 rounded-lg mb-6">
            <Sparkles className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            상품 이미지로 생성 (Mode A)
          </h3>
          <p className="text-gray-600 mb-6">
            상품 사진 한 장만 업로드하세요. <br />
            AI가 상품명, 특징, 마케팅 문구를 분석하여 상세페이지 전체를 새롭게 창조합니다.
          </p>
          <div className="mt-auto flex items-center text-blue-600 font-semibold group-hover:translate-x-2 transition-transform">
            시작하기 <ArrowRight className="ml-2 w-4 h-4" />
          </div>
        </button>

        {/* Mode B: Localization */}
        <button
          onClick={handleLocalizationClick}
          className="group relative flex flex-col items-start p-8 bg-white border-2 border-transparent hover:border-indigo-500 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Globe size={120} className="text-indigo-600" />
          </div>
          <div className="p-3 bg-indigo-100 rounded-lg mb-6">
            <Globe className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            기존 페이지 현지화 (Mode B) <span className="text-base font-medium text-gray-500">(준비중)</span>
          </h3>
          <p className="text-gray-600 mb-6">
            해외 상품 상세페이지(스크린샷)를 업로드하세요. <br />
            기존 레이아웃 흐름을 유지하면서 자연스러운 한국어로 내용을 재구성합니다.
          </p>
          <div className="mt-auto flex items-center text-indigo-600 font-semibold group-hover:translate-x-2 transition-transform">
            시작하기 <ArrowRight className="ml-2 w-4 h-4" />
          </div>
        </button>

        {/* Mode C: Image Edit */}
        <button
          onClick={handleImageEditClick}
          className="group relative flex flex-col items-start p-8 bg-white border-2 border-transparent hover:border-green-500 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ImageIcon size={120} className="text-green-600" />
          </div>
          <div className="p-3 bg-green-100 rounded-lg mb-6">
            <ImageIcon className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            이미지 수정 (Mode C) <span className="text-base font-medium text-gray-500">(준비중)</span>
          </h3>
          <p className="text-gray-600 mb-6">
            단일 이미지를 업로드하세요. <br />
            이미지의 외국어 텍스트를 한국어로 번역하거나 삭제하여 수정된 이미지를 생성합니다.
          </p>
          <div className="mt-auto flex items-center text-green-600 font-semibold group-hover:translate-x-2 transition-transform">
            시작하기 <ArrowRight className="ml-2 w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );
});

StepModeSelection.displayName = 'StepModeSelection';