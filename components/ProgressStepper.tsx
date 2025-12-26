import React from 'react';
import { Check, Upload, FileText, CheckCircle, ChevronRight } from 'lucide-react';

interface ProgressStepperProps {
    currentStep: number;
}

const steps = [
    { id: 1, title: '상품 등록', icon: Upload },
    { id: 2, title: '기획안 검토', icon: FileText },
    { id: 3, title: '제작 완료', icon: CheckCircle },
];

export const ProgressStepper: React.FC<ProgressStepperProps> = ({ currentStep }) => {
    return (
        <div className="w-full border-b bg-white">
            <div className="max-w-6xl mx-auto px-4 py-3">
                <div className="flex items-center justify-center space-x-2 sm:space-x-8 text-sm">
                    {steps.map((step, index) => {
                        const isActive = currentStep === step.id;
                        const isCompleted = currentStep > step.id;
                        const Icon = step.icon;

                        return (
                            <div key={step.id} className="flex items-center">
                                {/* Step Item */}
                                <div className={`flex items-center ${isActive ? 'text-blue-600 font-bold' :
                                        isCompleted ? 'text-gray-500 font-medium' : 'text-gray-400'
                                    }`}>
                                    <div className={`
                                        flex items-center justify-center w-6 h-6 rounded-full mr-2
                                        ${isActive ? 'bg-blue-100' : isCompleted ? 'bg-gray-100' : 'bg-transparent'}
                                    `}>
                                        {isCompleted ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                                        )}
                                    </div>
                                    <span className="whitespace-nowrap">{step.title}</span>
                                </div>

                                {/* Divider Arrow (except for the last item) */}
                                {index < steps.length - 1 && (
                                    <ChevronRight className="w-4 h-4 text-gray-300 ml-2 sm:ml-8" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
