import React, { useState, useCallback } from 'react';
import { Download, RefreshCw, ArrowLeft, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { useToastContext } from '../contexts/ToastContext';

interface Props {
  originalImageUrl: string;
  editedImageUrl: string;
  onRestart: () => void;
}

export const StepImageEditResult: React.FC<Props> = ({ originalImageUrl, editedImageUrl, onRestart }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const toast = useToastContext();

  // 이미지 다운로드 함수
  const handleDownload = useCallback(async (imageUrl: string, filename: string) => {
    try {
      setIsDownloading(true);
      
      // Base64 데이터 URL인 경우
      if (imageUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('이미지가 다운로드되었습니다.');
        return;
      }

      // 일반 URL인 경우
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('이미지가 다운로드되었습니다.');
    } catch (error) {
      console.error('이미지 다운로드 실패:', error);
      toast.error('이미지 다운로드에 실패했습니다.');
    } finally {
      setIsDownloading(false);
    }
  }, [toast]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">이미지 수정 완료</h1>
        <p className="text-gray-600">외국어 텍스트가 한국어로 번역되었거나 제거된 이미지입니다.</p>
      </div>

      {/* 이미지 비교 영역 */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-6">
        <div className="grid md:grid-cols-2 gap-0">
          {/* 원본 이미지 */}
          <div className="p-6 border-r border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center">
                <ImageIcon className="w-5 h-5 mr-2 text-gray-500" />
                원본 이미지
              </h3>
              <button
                onClick={() => handleDownload(originalImageUrl, 'original-image.png')}
                disabled={isDownloading}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-1" />
                다운로드
              </button>
            </div>
            <div className="relative bg-gray-50 rounded-lg overflow-hidden aspect-square flex items-center justify-center">
              <img
                src={originalImageUrl}
                alt="원본 이미지"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>

          {/* 수정된 이미지 */}
          <div className="p-6 bg-green-50/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-green-700 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                수정된 이미지
              </h3>
              <button
                onClick={() => handleDownload(editedImageUrl, 'edited-image.png')}
                disabled={isDownloading}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-1" />
                다운로드
              </button>
            </div>
            <div className="relative bg-white rounded-lg overflow-hidden aspect-square flex items-center justify-center border-2 border-green-200">
              <img
                src={editedImageUrl}
                alt="수정된 이미지"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-center gap-4">
        <button
          onClick={onRestart}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors flex items-center"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          다른 이미지 수정하기
        </button>
        <button
          onClick={() => handleDownload(editedImageUrl, 'edited-image.png')}
          disabled={isDownloading}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center disabled:opacity-50"
        >
          <Download className="w-5 h-5 mr-2" />
          {isDownloading ? '다운로드 중...' : '수정된 이미지 다운로드'}
        </button>
      </div>

      {/* 안내 메시지 */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">💡 안내</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li>수정된 이미지는 원본 이미지의 제품 일관성을 유지한 상태에서 텍스트만 변경되었습니다.</li>
          <li>텍스트가 불명확하거나 번역이 어려운 경우 자동으로 제거되었습니다.</li>
          <li>다른 이미지를 수정하려면 "다른 이미지 수정하기" 버튼을 클릭하세요.</li>
        </ul>
      </div>
    </div>
  );
};

