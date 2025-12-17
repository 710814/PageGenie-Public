import React, { useState, useEffect, useRef } from 'react';
import { X, Table, LayoutTemplate, Plus, Trash2, Loader2, Save, Check, Info, Edit2, ArrowUp, ArrowDown, ChevronLeft, Layout, FileText, Image as ImageIcon } from 'lucide-react';
import { getGasUrl, setGasUrl as saveGasUrl, getSheetId, setSheetId as saveSheetId } from '../services/googleSheetService';
import { getTemplates, saveTemplate, deleteTemplate } from '../services/templateService';
import { extractTemplateFromImage, fileToGenerativePart } from '../services/geminiService';
import { useToastContext } from '../contexts/ToastContext';
import { Template, SectionData } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'templates'>('general');
  const toast = useToastContext();
  
  // General Settings State
  const [gasUrl, setGasUrlState] = useState('');
  const [sheetId, setSheetIdState] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  // Template State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Template Editing State
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // 기본값을 포함하지 않고 가져와서, 사용자가 실제로 입력한 값만 표시
      const savedUrl = getGasUrl(false);
      setGasUrlState(savedUrl || '');
      setSheetIdState(getSheetId()); 
      setTemplates(getTemplates());
      setSaveStatus('idle');
      setEditingTemplate(null); // Reset edit mode on open
      
      // 디버깅: localStorage에 저장된 실제 값 확인
      console.log('[Settings] localStorage에서 GAS URL 확인:', localStorage.getItem('gemini_commerce_gas_url'));
      console.log('[Settings] getGasUrl(false) 결과:', savedUrl);
      console.log('[Settings] getGasUrl(true) 결과:', getGasUrl(true));
    }
  }, [isOpen]);

  const handleSaveGeneral = () => {
    // 공백 제거 후 저장
    const cleanGasUrl = gasUrl.trim();
    const cleanSheetId = sheetId.trim();

    saveGasUrl(cleanGasUrl);
    
    // 항상 저장하도록 수정 (빈 값이라도 저장하여 사용자가 초기화할 수 있게 함)
    // 단, 서비스 로직상 빈 값이면 Default ID를 반환할 수 있음
    saveSheetId(cleanSheetId);

    setSaveStatus('saving');
    setTimeout(() => {
        setSaveStatus('success');
        toast.success('설정이 저장되었습니다.');
        setTimeout(() => {
            setSaveStatus('idle');
        }, 2000);
    }, 500);
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzing(true);
      const base64 = await fileToGenerativePart(file);
      const mimeType = file.type;
      const newTemplate = await extractTemplateFromImage(base64, mimeType);
      
      saveTemplate(newTemplate);
      setTemplates(getTemplates()); 
      toast.success(`'${newTemplate.name}' 템플릿이 추가되었습니다!`);

    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : '템플릿 분석에 실패했습니다.';
      toast.error(errorMessage + ' 다시 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteTemplate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('정말 이 템플릿을 삭제하시겠습니까?')) {
      deleteTemplate(id);
      setTemplates(getTemplates());
    }
  };

  // --- Template Editing Logic ---

  const startEditing = (template: Template) => {
    // Deep copy to avoid mutating state directly
    setEditingTemplate(JSON.parse(JSON.stringify(template)));
  };

  const saveEditing = () => {
    if (editingTemplate) {
      saveTemplate(editingTemplate);
      setTemplates(getTemplates());
      setEditingTemplate(null);
    }
  };

  const cancelEditing = () => {
    if (confirm('수정 사항을 저장하지 않고 나가시겠습니까?')) {
      setEditingTemplate(null);
    }
  };

  const updateEditField = (field: keyof Template, value: any) => {
    if (!editingTemplate) return;
    setEditingTemplate({ ...editingTemplate, [field]: value });
  };

  const updateSection = (index: number, field: keyof SectionData, value: string) => {
    if (!editingTemplate) return;
    const newSections = [...editingTemplate.sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (!editingTemplate) return;
    const newSections = [...editingTemplate.sections];
    if (direction === 'up' && index > 0) {
      [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    } else if (direction === 'down' && index < newSections.length - 1) {
      [newSections[index + 1], newSections[index]] = [newSections[index], newSections[index + 1]];
    }
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  const addSection = () => {
    if (!editingTemplate) return;
    const newSection: SectionData = {
      id: `sec-${Date.now()}`,
      title: '새 섹션',
      content: '섹션에 들어갈 내용 설명',
      imagePrompt: 'Clean product shot'
    };
    setEditingTemplate({
      ...editingTemplate,
      sections: [...editingTemplate.sections, newSection]
    });
  };

  const removeSection = (index: number) => {
    if (!editingTemplate) return;
    if (confirm('이 섹션을 삭제하시겠습니까?')) {
        const newSections = editingTemplate.sections.filter((_, i) => i !== index);
        setEditingTemplate({ ...editingTemplate, sections: newSections });
    }
  };

  // --- Helper: Wireframe Preview ---
  const TemplateWireframe = ({ sections }: { sections: SectionData[] }) => {
    const previewSections = sections.slice(0, 4);
    return (
        <div className="w-full h-32 bg-slate-50 border-b border-gray-100 flex flex-col p-3 gap-2 overflow-hidden relative select-none">
            {/* Fake Header */}
            <div className="w-3/4 h-2 bg-slate-200 rounded-sm mx-auto mb-1"></div>
            
            {/* Sections */}
            {previewSections.map((_, i) => (
                <div key={i} className="flex gap-2 h-8 w-full">
                    {/* Alternating Layouts for visual variety */}
                    {i % 2 === 0 ? (
                        <>
                            <div className="w-1/3 h-full bg-blue-100/50 border border-blue-100 rounded-sm flex items-center justify-center">
                                <ImageIcon className="w-3 h-3 text-blue-300" />
                            </div>
                            <div className="flex-1 h-full bg-white border border-gray-100 rounded-sm p-1 space-y-1">
                                <div className="w-1/2 h-1 bg-gray-100 rounded-full"></div>
                                <div className="w-full h-1 bg-gray-50 rounded-full"></div>
                                <div className="w-3/4 h-1 bg-gray-50 rounded-full"></div>
                            </div>
                        </>
                    ) : (
                         <>
                            <div className="flex-1 h-full bg-white border border-gray-100 rounded-sm p-1 space-y-1">
                                <div className="w-1/2 h-1 bg-gray-100 rounded-full mx-auto"></div>
                                <div className="w-full h-1 bg-gray-50 rounded-full"></div>
                            </div>
                            <div className="w-1/3 h-full bg-blue-100/50 border border-blue-100 rounded-sm flex items-center justify-center">
                                <ImageIcon className="w-3 h-3 text-blue-300" />
                            </div>
                        </>
                    )}
                </div>
            ))}
            
            {/* Fade Overlay */}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden transition-all">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            {editingTemplate ? <Edit2 className="w-5 h-5 mr-2 text-blue-600"/> : <Layout className="w-5 h-5 mr-2 text-gray-700"/>}
            {editingTemplate ? '템플릿 디자인 수정' : '설정 및 템플릿'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors p-1 rounded-full hover:bg-gray-100"
            disabled={isAnalyzing}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs (Only visible when not editing) */}
        {!editingTemplate && (
          <div className="flex border-b bg-gray-50/50">
            <button
              onClick={() => !isAnalyzing && setActiveTab('general')}
              disabled={isAnalyzing}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'general' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              } ${isAnalyzing ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <Table className="w-4 h-4" /> 구글 시트 연동
            </button>
            <button
              onClick={() => !isAnalyzing && setActiveTab('templates')}
              disabled={isAnalyzing}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'templates' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              } ${isAnalyzing ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <LayoutTemplate className="w-4 h-4" /> 템플릿 관리
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 relative custom-scrollbar">
          
          {/* TAB: General */}
          {!editingTemplate && activeTab === 'general' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 flex items-start leading-relaxed">
                  <Info className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 text-blue-600" />
                  <span>
                    <strong>안전한 데이터 저장:</strong> 입력하신 API 정보는 서버가 아닌 고객님의 <strong>브라우저(로컬 스토리지)</strong>에만 안전하게 저장됩니다.
                  </span>
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Google Apps Script (GAS) Web App URL
                    </label>
                    <input
                      type="text"
                      name="gasUrl"
                      autoComplete="off"
                      value={gasUrl}
                      onChange={(e) => setGasUrlState(e.target.value)}
                      placeholder="https://script.google.com/macros/s/..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
                    />
                    <p className="text-xs text-gray-500 mt-1">배포된 Apps Script의 웹 앱 URL을 입력하세요.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Google Sheet ID
                    </label>
                    <input
                      type="text"
                      name="sheetId"
                      autoComplete="off"
                      value={sheetId}
                      onChange={(e) => setSheetIdState(e.target.value)}
                      placeholder="구글 시트 ID를 입력하세요"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      구글 시트 주소 중 <code>/d/</code>와 <code>/edit</code> 사이의 문자열입니다.
                    </p>
                  </div>

                  <div className="pt-2">
                      <button
                        onClick={handleSaveGeneral}
                        disabled={saveStatus === 'saving' || saveStatus === 'success'}
                        className={`w-full py-3 rounded-lg font-bold transition-all flex justify-center items-center shadow-md ${
                            saveStatus === 'success' 
                            ? 'bg-green-600 hover:bg-green-700 text-white scale-[1.02]' 
                            : 'bg-gray-900 hover:bg-gray-800 text-white'
                        }`}
                      >
                        {saveStatus === 'saving' && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                        {saveStatus === 'success' && <Check className="w-5 h-5 mr-2" />}
                        {saveStatus === 'idle' && <Save className="w-5 h-5 mr-2" />}
                        
                        {saveStatus === 'saving' && '연동 정보 저장 중...'}
                        {saveStatus === 'success' && '저장되었습니다!'}
                        {saveStatus === 'idle' && '설정 저장하기'}
                      </button>
                  </div>
              </div>
            </div>
          )}

          {/* TAB: Templates - GRID VIEW */}
          {!editingTemplate && activeTab === 'templates' && (
            <div className="relative min-h-[400px]">
               {isAnalyzing && (
                 <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-in fade-in duration-300">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl border border-blue-100 flex flex-col items-center max-w-sm text-center">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">이미지 분석 중...</h3>
                        <p className="text-sm text-gray-600 animate-pulse">
                          AI가 이미지의 레이아웃 구조와 디자인 요소를 추출하여 템플릿을 생성하고 있습니다.
                        </p>
                    </div>
                 </div>
               )}

               <div className="mb-6 flex justify-between items-end">
                   <div>
                       <h3 className="text-lg font-bold text-gray-800">나만의 템플릿</h3>
                       <p className="text-sm text-gray-500">이미지에서 추출한 레이아웃을 관리하세요.</p>
                   </div>
                   <div className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200">
                       총 {templates.length}개
                   </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
                 
                 {/* 1. Upload/Add Card */}
                 <div 
                   onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                   className={`flex flex-col items-center justify-center min-h-[280px] border-2 border-dashed border-gray-300 rounded-xl transition-all group bg-white/50 ${
                     isAnalyzing ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer hover:shadow-lg'
                   }`}
                 >
                   <input 
                     type="file" 
                     ref={fileInputRef} 
                     className="hidden" 
                     accept="image/*"
                     onChange={handleTemplateUpload}
                     disabled={isAnalyzing}
                   />
                   <div className="p-4 bg-gray-100 rounded-full mb-3 group-hover:bg-blue-100 transition-colors">
                       <Plus className="w-8 h-8 text-gray-400 group-hover:text-blue-600" />
                   </div>
                   <span className="text-gray-900 font-bold mb-1">새 템플릿 추가</span>
                   <span className="text-xs text-gray-500">이미지 업로드</span>
                 </div>

                 {/* 2. Template Cards */}
                 {templates.map(tpl => (
                   <div 
                        key={tpl.id} 
                        onClick={() => startEditing(tpl)}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden group cursor-pointer flex flex-col"
                   >
                     {/* Preview Area */}
                     <TemplateWireframe sections={tpl.sections} />

                     {/* Info Area */}
                     <div className="p-4 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                             <h4 className="font-bold text-gray-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{tpl.name}</h4>
                             <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {tpl.sections.length} 섹션
                             </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">
                            {tpl.description || "설명이 없습니다."}
                        </p>
                        
                        <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                            <span className="text-[10px] text-gray-400 flex items-center">
                                {new Date(tpl.createdAt).toLocaleDateString()}
                            </span>
                            <div className="flex gap-1">
                                <button 
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="수정"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={(e) => handleDeleteTemplate(e, tpl.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="삭제"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {/* TAB: Templates - EDIT VIEW */}
          {editingTemplate && (
              <div className="space-y-6 max-w-3xl mx-auto">
                  {/* Top: Info */}
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">템플릿 이름</label>
                          <input 
                              type="text" 
                              value={editingTemplate.name}
                              onChange={(e) => updateEditField('name', e.target.value)}
                              className="w-full text-xl font-bold border-b-2 border-gray-200 focus:border-blue-600 outline-none py-2 bg-transparent transition-colors"
                              placeholder="템플릿 이름 입력"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">설명 (선택)</label>
                          <input 
                              type="text" 
                              value={editingTemplate.description || ''}
                              onChange={(e) => updateEditField('description', e.target.value)}
                              className="w-full text-sm text-gray-700 border-b border-gray-200 focus:border-blue-500 outline-none py-2 bg-transparent transition-colors"
                              placeholder="이 템플릿에 대한 간단한 설명"
                          />
                      </div>
                  </div>

                  {/* Middle: Sections */}
                  <div className="space-y-4 pb-20">
                      <div className="flex justify-between items-center px-1">
                          <h3 className="font-bold text-gray-800 flex items-center gap-2">
                              <Layout className="w-4 h-4 text-gray-500"/>
                              섹션 구성 
                              <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{editingTemplate.sections.length}</span>
                          </h3>
                          <button 
                              onClick={addSection}
                              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center transition-all shadow-sm hover:shadow"
                          >
                              <Plus className="w-4 h-4 mr-1" /> 섹션 추가
                          </button>
                      </div>

                      {editingTemplate.sections.map((section, idx) => (
                          <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                              <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                                  <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                    SECTION {idx + 1}
                                  </span>
                                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                      <button 
                                          onClick={() => moveSection(idx, 'up')}
                                          disabled={idx === 0}
                                          className="p-1 hover:bg-white rounded border border-transparent hover:border-gray-200 shadow-sm disabled:opacity-30 disabled:shadow-none"
                                          title="위로 이동"
                                      >
                                          <ArrowUp className="w-4 h-4" />
                                      </button>
                                      <button 
                                          onClick={() => moveSection(idx, 'down')}
                                          disabled={idx === editingTemplate.sections.length - 1}
                                          className="p-1 hover:bg-white rounded border border-transparent hover:border-gray-200 shadow-sm disabled:opacity-30 disabled:shadow-none"
                                          title="아래로 이동"
                                      >
                                          <ArrowDown className="w-4 h-4" />
                                      </button>
                                      <div className="w-px h-3 bg-gray-300 mx-2"></div>
                                      <button 
                                          onClick={() => removeSection(idx)}
                                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"
                                          title="섹션 삭제"
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              </div>
                              <div className="p-5 space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                          <label className="text-xs font-semibold text-gray-500 block mb-1.5">섹션 제목 (예시)</label>
                                          <input 
                                              type="text" 
                                              value={section.title}
                                              onChange={(e) => updateSection(idx, 'title', e.target.value)}
                                              className="w-full text-sm font-medium border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-xs font-semibold text-gray-500 block mb-1.5">내용 설명 (AI 가이드)</label>
                                          <div className="relative">
                                            <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                            <input 
                                                type="text" 
                                                value={section.content}
                                                onChange={(e) => updateSection(idx, 'content', e.target.value)}
                                                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 pl-9 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                            />
                                          </div>
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-indigo-600 block mb-1.5 flex items-center">
                                        <ImageIcon className="w-3 h-3 mr-1"/>
                                        이미지 스타일 프롬프트 (English)
                                      </label>
                                      <textarea 
                                          rows={2}
                                          value={section.imagePrompt}
                                          onChange={(e) => updateSection(idx, 'imagePrompt', e.target.value)}
                                          className="w-full text-sm border border-indigo-100 bg-indigo-50/30 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-700 font-mono resize-none"
                                      />
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>

                  {/* Bottom: Action Buttons */}
                  <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t p-4 flex justify-between items-center z-20">
                      <button 
                          onClick={cancelEditing}
                          className="px-5 py-2.5 text-gray-600 hover:text-gray-900 font-medium flex items-center hover:bg-gray-100 rounded-lg transition-colors"
                      >
                          <ChevronLeft className="w-4 h-4 mr-1" /> 취소
                      </button>
                      <button 
                          onClick={saveEditing}
                          className="px-8 py-2.5 bg-gray-900 hover:bg-black text-white rounded-lg font-bold shadow-lg hover:shadow-xl transition-all flex items-center transform hover:-translate-y-0.5"
                      >
                          <Save className="w-4 h-4 mr-2" /> 변경사항 저장
                      </button>
                  </div>
              </div>
          )}

        </div>
      </div>
    </div>
  );
};