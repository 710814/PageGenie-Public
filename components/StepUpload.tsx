import React, { useRef, useState, useEffect } from 'react';
import { Upload, Link as LinkIcon, Image as ImageIcon, LayoutTemplate, Loader2, AlertCircle, RefreshCw, ArrowRight, X, Layers } from 'lucide-react';
import { AppMode, UploadedFile, Template } from '../types';
import { getTemplates } from '../services/templateService';
import { optimizeImages, needsOptimization, optimizeImage } from '../utils/imageOptimizer';
import { useToastContext } from '../contexts/ToastContext';

interface Props {
  mode: AppMode;
  onFileSelect: (files: UploadedFile[], templateId?: string) => void;
}

export const StepUpload: React.FC<Props> = ({ mode, onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const toast = useToastContext();
  
  // Upload Method State
  const [activeMethod, setActiveMethod] = useState<'upload' | 'url' | 'drive'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Preview State (Now supports multiple files)
  const [previewFiles, setPreviewFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    setTemplates(getTemplates());
  }, []);

  // --- Helper Methods ---

  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        if (res) {
            resolve(res.split(',')[1]);
        } else {
            reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Helper to create the file object without submitting yet
  const createUploadedFile = async (blob: Blob, source: 'url' | 'drive' | 'file', fileName?: string): Promise<UploadedFile> => {
      const base64 = await convertBlobToBase64(blob);
      
      const finalName = fileName || (source === 'drive' ? 'drive_image.jpg' : 'imported_image.jpg');
      const file = new File([blob], finalName, { type: blob.type });

      return {
        file,
        previewUrl: URL.createObjectURL(blob),
        base64,
        mimeType: blob.type
      };
  };

  const processUrl = async (url: string, source: 'url' | 'drive') => {
    if (!url.trim()) return;
    
    setIsLoading(true);
    setErrorMsg('');

    try {
      let targetUrl = url;
      
      // --- Google Drive URL Parsing ---
      if (source === 'drive') {
        let driveId = '';
        const match1 = url.match(/\/d\/([-\w]{25,})/);
        const match2 = url.match(/id=([-\w]{25,})/);
        // Fallback for ID-only input
        const match3 = url.match(/^([-\w]{25,})$/); 

        if (match1) driveId = match1[1];
        else if (match2) driveId = match2[1];
        else if (match3) driveId = match3[1];

        if (!driveId) throw new Error("유효한 구글 드라이브 파일 ID를 찾을 수 없습니다. 링크를 다시 확인해주세요.");
        
        // Construct Direct Download Link
        targetUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
      }

      // --- Fetch Strategies ---
      const fetchWithTimeout = async (u: string) => {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), 15000); // 15s timeout
          try {
            const res = await fetch(u, { signal: controller.signal });
            clearTimeout(id);
            if (!res.ok) throw new Error(`Status ${res.status}`);
            return await res.blob();
          } catch (e) {
            clearTimeout(id);
            throw e;
          }
      };

      let blob: Blob | null = null;
      let errorLog: string[] = [];

      // ... (Fetch Logic kept same as before for URL/Drive - returns single blob) ...
      // Simplified for brevity, reusing the existing logic structure
      if (source === 'drive') {
          try {
              const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}&t=${Date.now()}`;
              const b = await fetchWithTimeout(proxyUrl);
              if (b.type.includes('text/html')) throw new Error("Google Drive warning page.");
              if (b.type.startsWith('image/')) blob = b;
          } catch (e) { errorLog.push(`AllOrigins: ${e}`); }
          if (!blob) {
              try {
                  const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(targetUrl)}&output=jpg&we=true&il=true`;
                  const b = await fetchWithTimeout(proxyUrl);
                  if (b.type.startsWith('image/')) blob = b;
              } catch (e) { errorLog.push(`Weserv: ${e}`); }
          }
      } else {
          try {
              const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(targetUrl)}&w=2000&we=true&il=true`;
              const b = await fetchWithTimeout(proxyUrl);
              if (b.type.startsWith('image/')) blob = b;
          } catch (e) { errorLog.push(`Weserv: ${e}`); }
          if (!blob) {
              try {
                  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
                  const b = await fetchWithTimeout(proxyUrl);
                  if (b.type.startsWith('image/')) blob = b;
              } catch (e) { errorLog.push(`AllOrigins: ${e}`); }
          }
          if (!blob) {
              try {
                  const b = await fetchWithTimeout(targetUrl);
                  if (b.type.startsWith('image/')) blob = b;
              } catch (e) { errorLog.push(`Direct: ${e}`); }
          }
      }

      if (!blob) {
          console.warn("Fetch failed details:", errorLog);
          if (source === 'drive') {
              throw new Error("구글 드라이브 이미지를 가져올 수 없습니다. '링크가 있는 모든 사용자에게 공개' 상태인지 확인해주세요.");
          } else {
              throw new Error("이미지를 불러올 수 없습니다. 링크가 유효하지 않거나 외부 접근이 차단된 이미지입니다.");
          }
      }

      // 이미지 최적화 (필요한 경우)
      let optimizedBlob = blob;
      try {
        const tempFile = new File([blob], 'temp.jpg', { type: blob.type });
        if (needsOptimization(tempFile)) {
          const optimizedFile = await optimizeImage(tempFile);
          optimizedBlob = await optimizedFile.arrayBuffer().then(buf => new Blob([buf], { type: blob.type }));
          toast.success('이미지가 최적화되었습니다.');
        }
      } catch (optError) {
        console.warn('이미지 최적화 실패, 원본 사용:', optError);
      }

      // Append to existing files instead of replacing
      const uploadedData = await createUploadedFile(optimizedBlob, source);
      setPreviewFiles(prev => [...prev, uploadedData]);
      setUrlInput(''); // Clear input on success
      toast.success('이미지가 추가되었습니다.');

    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "이미지 로드 중 알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = async (files: File[]) => {
    setIsLoading(true);
    setErrorMsg('');
    
    try {
        // 이미지 최적화가 필요한 파일 확인
        const needsOpt = files.some(file => needsOptimization(file));
        
        if (needsOpt) {
          toast.info('대용량 이미지를 최적화하고 있습니다...', 3000);
        }

        // 이미지 최적화 (필요한 경우)
        let optimizedFiles: File[];
        try {
          optimizedFiles = await optimizeImages(files);
          
          // 최적화 결과 알림
          const originalSize = files.reduce((sum, f) => sum + f.size, 0);
          const optimizedSize = optimizedFiles.reduce((sum, f) => sum + f.size, 0);
          const savedPercent = Math.round((1 - optimizedSize / originalSize) * 100);
          
          if (savedPercent > 5) {
            toast.success(`이미지 최적화 완료! ${savedPercent}% 용량 절감`, 3000);
          }
        } catch (optError) {
          console.warn('이미지 최적화 실패, 원본 파일 사용:', optError);
          optimizedFiles = files; // 최적화 실패 시 원본 사용
        }

        // 최적화된 파일을 base64로 변환
        const newUploadedFiles = await Promise.all(optimizedFiles.map(async (file) => {
            return new Promise<UploadedFile>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        const base64 = (e.target.result as string).split(',')[1];
                        resolve({
                            file,
                            previewUrl: e.target.result as string,
                            base64,
                            mimeType: file.type
                        });
                    } else {
                        reject(new Error('파일을 읽을 수 없습니다.'));
                    }
                };
                reader.onerror = () => reject(new Error('파일 읽기 실패'));
                reader.readAsDataURL(file);
            });
        }));
        
        setPreviewFiles(prev => [...prev, ...newUploadedFiles]);
        toast.success(`${newUploadedFiles.length}개 파일이 추가되었습니다.`);
    } catch (e) {
        console.error(e);
        const errorMessage = e instanceof Error ? e.message : "파일 처리 중 오류가 발생했습니다.";
        setErrorMsg(errorMessage);
        toast.error(errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (activeMethod === 'upload' && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleResetPreview = () => {
    setPreviewFiles([]);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setPreviewFiles(prev => prev.filter((_, i) => i !== index));
    if (previewFiles.length <= 1 && fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleConfirmUpload = () => {
    if (previewFiles.length > 0) {
      onFileSelect(previewFiles, selectedTemplateId || undefined);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          {mode === AppMode.CREATION ? '상품 이미지 업로드' : '상세페이지 이미지 업로드'}
        </h2>
        <p className="text-gray-500">
          {mode === AppMode.CREATION 
            ? '상품의 다양한 각도(정면, 측면, 상세 등) 사진을 여러 장 올려주세요.' 
            : '번역할 상세페이지 스크린샷들을 순서대로 올려주세요.'}
        </p>
      </div>

      {/* Template Selection */}
      {templates.length > 0 && mode === AppMode.CREATION && previewFiles.length === 0 && (
        <div className="mb-8 bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between shadow-sm">
           <div className="flex items-center gap-3">
             <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600">
                <LayoutTemplate className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-sm font-bold text-gray-800">템플릿 적용 (선택)</h3>
               <p className="text-xs text-gray-500">저장된 템플릿의 레이아웃에 맞춰 생성합니다.</p>
             </div>
           </div>
           <select 
             className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none min-w-[200px]"
             value={selectedTemplateId}
             onChange={(e) => setSelectedTemplateId(e.target.value)}
           >
             <option value="">템플릿 사용 안함 (AI 자동)</option>
             {templates.map(t => (
               <option key={t.id} value={t.id}>{t.name} ({t.sections.length} 섹션)</option>
             ))}
           </select>
        </div>
      )}

      {/* --- PREVIEW MODE --- */}
      {previewFiles.length > 0 ? (
         <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                 <h3 className="font-bold text-gray-700 flex items-center">
                     <Layers className="w-5 h-5 mr-2 text-blue-600" />
                     이미지 확인 ({previewFiles.length}장)
                 </h3>
                 <button 
                    onClick={handleResetPreview}
                    className="text-gray-400 hover:text-gray-600 flex items-center text-xs"
                    title="전체 초기화"
                 >
                    <X className="w-4 h-4 mr-1" /> 전체 삭제
                 </button>
             </div>
             
             <div className="p-8 flex flex-col items-center">
                 {/* Grid View for Multiple Files */}
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full mb-8 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                     {previewFiles.map((file, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-square bg-checkerboard">
                            <img 
                                src={file.previewUrl} 
                                alt={`Preview ${idx}`} 
                                className="w-full h-full object-contain bg-white"
                            />
                            <button 
                                onClick={() => removeFile(idx)}
                                className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white p-1 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <X className="w-3 h-3" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 text-center truncate px-2">
                                {idx + 1}. {file.file.name}
                            </div>
                        </div>
                     ))}
                     {/* Add More Button Style */}
                     <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors aspect-square"
                     >
                        <Upload className="w-6 h-6 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">추가하기</span>
                     </div>
                 </div>
                 
                 <div className="flex gap-4 w-full max-w-md">
                     <button
                        onClick={handleResetPreview}
                        className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors flex items-center justify-center"
                     >
                         <RefreshCw className="w-4 h-4 mr-2" /> 초기화
                     </button>
                     <button
                        onClick={handleConfirmUpload}
                        className="flex-2 w-full py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-md transition-all hover:scale-[1.02] flex items-center justify-center"
                     >
                         분석 시작 <ArrowRight className="w-5 h-5 ml-2" />
                     </button>
                 </div>
             </div>
             {/* Hidden input for "Add More" functionality */}
             <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileChange}
             />
         </div>
      ) : (
         /* --- UPLOAD MODE --- */
         <>
            {/* Method Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
                <button
                onClick={() => { setActiveMethod('upload'); setErrorMsg(''); }}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                    activeMethod === 'upload' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                >
                <Upload className="w-4 h-4" /> 파일 업로드
                </button>
                <button
                onClick={() => { setActiveMethod('url'); setErrorMsg(''); setUrlInput(''); }}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                    activeMethod === 'url' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                >
                <LinkIcon className="w-4 h-4" /> 이미지 URL
                </button>
                <button
                onClick={() => { setActiveMethod('drive'); setErrorMsg(''); setUrlInput(''); }}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                    activeMethod === 'drive' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                >
                <ImageIcon className="w-4 h-4" /> Google Drive
                </button>
            </div>

            {/* Main Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 min-h-[300px] flex flex-col items-center justify-center p-8 transition-all relative overflow-hidden">
                
                {/* Method: Upload */}
                {activeMethod === 'upload' && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                    w-full h-full min-h-[250px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors
                    ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
                    `}
                >
                    <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    />
                    <div className="p-4 bg-gray-100 rounded-full mb-4">
                    <Upload className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-700 font-medium mb-1">클릭하여 업로드하거나 이미지를 드래그하세요</p>
                    <p className="text-xs text-gray-400">여러 장 선택 가능 (Max 10MB/file)</p>
                </div>
                )}

                {/* Method: URL */}
                {activeMethod === 'url' && (
                <div className="w-full max-w-md space-y-4">
                    <div className="text-center mb-2">
                        <div className="inline-block p-3 bg-gray-100 rounded-full mb-3">
                        <LinkIcon className="w-6 h-6 text-gray-600" />
                        </div>
                        <h3 className="font-bold text-gray-800">이미지 링크 입력</h3>
                        <p className="text-xs text-gray-500">웹상의 이미지 주소를 입력하여 목록에 추가합니다.</p>
                    </div>
                    <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="https://example.com/image.jpg"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && processUrl(urlInput, 'url')}
                    />
                    <button 
                        onClick={() => processUrl(urlInput, 'url')}
                        disabled={!urlInput || isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '목록에 추가'}
                    </button>
                </div>
                )}

                {/* Method: Drive */}
                {activeMethod === 'drive' && (
                <div className="w-full max-w-md space-y-4">
                    <div className="text-center mb-2">
                        <div className="inline-block p-3 bg-gray-100 rounded-full mb-3">
                        <ImageIcon className="w-6 h-6 text-gray-600" />
                        </div>
                        <h3 className="font-bold text-gray-800">Google Drive 공유 링크</h3>
                        <p className="text-xs text-gray-500">
                            '링크가 있는 모든 사용자에게 공개' 설정된 파일의 공유 링크를 입력하세요.
                        </p>
                    </div>
                    <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && processUrl(urlInput, 'drive')}
                    />
                    <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg text-xs text-yellow-800 flex items-start">
                        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>비공개 파일은 불러올 수 없습니다. 반드시 링크 공유 설정을 '공개'로 변경해주세요.</span>
                    </div>
                    <button 
                        onClick={() => processUrl(urlInput, 'drive')}
                        disabled={!urlInput || isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '목록에 추가'}
                    </button>
                </div>
                )}

                {/* Error Message */}
                {errorMsg && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center animate-in fade-in slide-in-from-top-2 w-full max-w-md">
                        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}
            </div>
         </>
      )}

    </div>
  );
};