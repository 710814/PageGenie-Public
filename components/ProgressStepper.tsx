import React from 'react';
import { Check, Upload, FileText, CheckCircle } from 'lucide-react';

interface ProgressStepperProps {
    currentStep: number;
}

const steps = [
    { id: 1, title: '상품 등록', icon: Upload, description: '기본 정보 입력' },
    { id: 2, title: '기획안 검토', icon: FileText, description: '상세페이지 시안' },
    { id: 3, title: '제작 완료', icon: CheckCircle, description: '결과물 확인' },
];

export const ProgressStepper: React.FC<ProgressStepperProps> = ({ currentStep }) => {
    return (
        <div className="w-full max-w-4xl mx-auto mb-10">
            <div className="relative flex justify-between items-center">
                {/* Progress Bar Background */}
                <div className="absolute top-5 left-0 w-full h-1 bg-gray-200 -z-10 rounded-full" />

                {/* Progress Bar Active */}
                <div
                    className="absolute top-5 left-0 h-1 bg-blue-600 -z-10 rounded-full transition-all duration-500"
                    style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step) => {
                    const isActive = currentStep === step.id;
                    const isCompleted = currentStep > step.id;
                    const Icon = step.icon;

                    return (
                        <div key={step.id} className="flex flex-col items-center group">
                            {/* Step Circle */}
                            <div
                                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-all duration-300
                  ${isActive
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110'
                                        : isCompleted
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'bg-white border-gray-300 text-gray-400'}
                `}
                            >
                                {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                            </div>

                            {/* Step Title & Description */}
                            <div className="mt-3 text-center">
                                <p
                                    className={`text-sm font-bold transition-colors duration-300 ${isActive || isCompleted ? 'text-gray-900' : 'text-gray-400'
                                        }`}
                                >
                                    {step.title}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
                                    {step.description}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
