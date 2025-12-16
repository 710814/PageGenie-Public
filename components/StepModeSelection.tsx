import React from 'react';
import { AppMode } from '../types';
import { Sparkles, Globe, ArrowRight } from 'lucide-react';

interface Props {
  onSelectMode: (mode: AppMode) => void;
}

export const StepModeSelection: React.FC<Props> = ({ onSelectMode }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Gemini Commerce Architect
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          상품 이미지만 있으면 AI가 상세페이지를 자동으로 설계하고 디자인합니다.<br/>
          현지화가 필요한 해외 상품 페이지도 완벽하게 한국어 버전으로 재탄생합니다.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Mode A: Creation */}
        <button
          onClick={() => onSelectMode(AppMode.CREATION)}
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
            상품 사진 한 장만 업로드하세요. <br/>
            AI가 상품명, 특징, 마케팅 문구를 분석하여 상세페이지 전체를 새롭게 창조합니다.
          </p>
          <div className="mt-auto flex items-center text-blue-600 font-semibold group-hover:translate-x-2 transition-transform">
            시작하기 <ArrowRight className="ml-2 w-4 h-4" />
          </div>
        </button>

        {/* Mode B: Localization */}
        <button
          onClick={() => onSelectMode(AppMode.LOCALIZATION)}
          className="group relative flex flex-col items-start p-8 bg-white border-2 border-transparent hover:border-indigo-500 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Globe size={120} className="text-indigo-600" />
          </div>
          <div className="p-3 bg-indigo-100 rounded-lg mb-6">
            <Globe className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            기존 페이지 현지화 (Mode B)
          </h3>
          <p className="text-gray-600 mb-6">
            해외 상품 상세페이지(스크린샷)를 업로드하세요. <br/>
            기존 레이아웃 흐름을 유지하면서 자연스러운 한국어로 내용을 재구성합니다.
          </p>
          <div className="mt-auto flex items-center text-indigo-600 font-semibold group-hover:translate-x-2 transition-transform">
            시작하기 <ArrowRight className="ml-2 w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );
};