import React, { useMemo } from 'react';
import { SectionData } from '../types';
import { Sparkles, CheckCircle, Loader2, Clock, Zap } from 'lucide-react';

export interface GenerationProgress {
  current: number;
  total: number;
  currentSectionId: string;
  currentSectionTitle: string;
  completedSectionIds: string[];
  startTime: number | null;
}

interface Props {
  sections: SectionData[];
  progress: GenerationProgress;
}

export const GeneratingProgress: React.FC<Props> = ({ sections, progress }) => {
  const percentage = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;
  
  // 예상 남은 시간 계산
  const estimatedTimeRemaining = useMemo(() => {
    if (!progress.startTime || progress.current === 0) return null;
    
    const elapsed = Date.now() - progress.startTime;
    const timePerSection = elapsed / progress.current;
    const remaining = (progress.total - progress.current) * timePerSection;
    
    return Math.ceil(remaining / 1000); // 초 단위
  }, [progress.startTime, progress.current, progress.total]);

  // 경과 시간 계산
  const elapsedTime = useMemo(() => {
    if (!progress.startTime) return 0;
    return Math.floor((Date.now() - progress.startTime) / 1000);
  }, [progress.startTime, progress.current]); // current가 변경될 때마다 재계산

  // 시간 포맷
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}초`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/95 to-indigo-900/95 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full mx-4 relative overflow-hidden">
        {/* 배경 장식 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-green-100 to-blue-100 rounded-full blur-2xl opacity-50 translate-y-1/2 -translate-x-1/2" />
        
        {/* 헤더 */}
        <div className="text-center mb-8 relative">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg animate-pulse">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">상세페이지 생성 중</h2>
          <p className="text-gray-500 text-sm mt-2">AI가 각 섹션의 이미지를 생성하고 있습니다</p>
        </div>
        
        {/* 프로그레스 바 */}
        <div className="mb-8 relative">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-600 font-medium">진행률</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {percentage}%
            </span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-700 ease-out relative"
              style={{ width: `${percentage}%` }}
            >
              {/* 반짝이는 효과 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500 flex items-center">
              <Zap className="w-3 h-3 mr-1 text-amber-500" />
              {progress.current}/{progress.total} 섹션 완료
            </span>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>경과: {formatTime(elapsedTime)}</span>
              {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
                <span className="text-blue-600 font-medium">
                  남음: 약 {formatTime(estimatedTimeRemaining)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* 섹션별 상태 */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
          {sections.filter(s => s.imagePrompt && !s.isOriginalImage).map((section, index) => {
            const isCompleted = progress.completedSectionIds.includes(section.id);
            const isCurrent = progress.currentSectionId === section.id;
            const isWaiting = !isCompleted && !isCurrent;
            
            return (
              <div 
                key={section.id}
                className={`flex items-center p-3 rounded-xl transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' 
                    : isCurrent 
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 shadow-md scale-[1.02]' 
                      : 'bg-gray-50 border border-gray-100'
                }`}
              >
                <div className="mr-3 flex-shrink-0">
                  {isCompleted ? (
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-checkmark">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium block truncate ${
                    isCompleted ? 'text-green-700' 
                    : isCurrent ? 'text-blue-700' 
                    : 'text-gray-400'
                  }`}>
                    섹션 {index + 1}: {section.title}
                  </span>
                  {isCurrent && (
                    <span className="text-xs text-blue-500 animate-pulse">이미지 생성 중...</span>
                  )}
                </div>
                <span className={`text-xs font-medium flex-shrink-0 ml-2 ${
                  isCompleted ? 'text-green-500' 
                  : isCurrent ? 'text-blue-500' 
                  : 'text-gray-400'
                }`}>
                  {isCompleted ? '✓ 완료' : isCurrent ? '생성 중' : '대기'}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* 팁 */}
        <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
          <p className="text-sm text-amber-800 flex items-start">
            <span className="text-lg mr-2">💡</span>
            <span>
              <strong>팁:</strong> 이미지 생성은 섹션당 약 5-10초가 소요됩니다. 
              페이지를 벗어나지 마세요.
            </span>
          </p>
        </div>
      </div>
      
      {/* CSS for animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        @keyframes checkmark {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-checkmark {
          animation: checkmark 0.3s ease-out forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

