import React, { useState, useCallback } from 'react';
import { ProductAnalysis, AppMode, UploadedFile } from '../types';
import { Download, Code, CheckCircle, ExternalLink, Table, Loader2, RefreshCw, Settings, X, MessageSquare, Image as ImageIcon, Eye } from 'lucide-react';
import { saveToGoogleSheet, openGoogleSheet, generateCSV, getGasUrl, DEFAULT_GAS_URL } from '../services/googleSheetService';
import { generateSectionImage } from '../services/geminiService';
import { useToastContext } from '../contexts/ToastContext';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface Props {
  data: ProductAnalysis;
  onRestart: () => void;
  mode: AppMode;
  uploadedFiles: UploadedFile[]; // Changed to Array
  onUpdate: (data: ProductAnalysis) => void;
  onOpenSettings: () => void;
}

export const StepResult: React.FC<Props> = ({ data, onRestart, mode, uploadedFiles, onUpdate, onOpenSettings }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveType, setSaveType] = useState<'sheet' | 'drive' | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const toast = useToastContext();

  // 프롬프트 수정 모달 상태
  const [editModal, setEditModal] = useState<{ isOpen: boolean; sectionId: string; prompt: string } | null>(null);

  // HTML 생성 함수 (다운로드용 - 이미지는 상대 경로)
  const generateHTML = () => {
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.productName}</title>
    <style>
        body { font-family: 'Noto Sans KR', sans-serif; margin: 0; padding: 0; color: #333; line-height: 1.6; }
        .container { max-width: 800px; margin: 0 auto; }
        .hero { text-align: center; padding: 60px 20px; background-color: #f9fafb; }
        .hero h1 { font-size: 2.5rem; margin-bottom: 20px; color: #111; }
        .hero p { font-size: 1.2rem; color: #555; max-width: 600px; margin: 0 auto; }
        .features { padding: 40px 20px; background: #fff; }
        .features ul { max-width: 600px; margin: 0 auto; padding-left: 20px; }
        .features li { margin-bottom: 10px; font-size: 1.1rem; }
        .section { padding: 60px 20px; border-bottom: 1px solid #eee; text-align: center; }
        .section img { max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .section h2 { font-size: 2rem; margin-bottom: 20px; }
        .section p { font-size: 1.1rem; color: #666; max-width: 700px; margin: 0 auto; white-space: pre-wrap; }
        .footer { padding: 40px; text-align: center; font-size: 0.9rem; color: #999; background: #f1f1f1; }
    </style>
</head>
<body>
    <div class="container">
        <header class="hero">
            <h1>${data.productName}</h1>
            <p>${data.marketingCopy}</p>
        </header>

        <section class="features">
            <ul>
                ${data.mainFeatures.map(f => `<li>${f}</li>`).join('')}
            </ul>
        </section>

        ${data.sections.map(section => {
      const isGrid = (section.layoutType === 'grid-2' || section.layoutType === 'grid-3') && section.imageSlots && section.imageSlots.length > 0;
      const gridCols = section.layoutType === 'grid-3' ? 3 : 2;

      if (isGrid) {
        return `
            <section class="section">
                <div style="display: grid; grid-template-columns: repeat(${gridCols}, 1fr); gap: 15px; margin-bottom: 30px;">
                    ${section.imageSlots?.map((slot, idx) =>
          slot.imageUrl ? `<img src="images/section_${section.id}_slot_${idx}.png" alt="${section.title} - ${idx + 1}" style="width: 100%; height: auto; aspect-ratio: 1/1; object-fit: cover; margin-bottom: 0;" />` : ''
        ).join('')}
                </div>
                <h2>${section.title}</h2>
                <p>${section.content}</p>
            </section>
            `;
      }

      return `
          <section class="section">
              ${section.imageUrl ? `<img src="images/section_${section.id}.png" alt="${section.title}" />` : ''}
              <h2>${section.title}</h2>
              <p>${section.content}</p>
          </section>
          `;
    }).join('')}

        <footer class="footer">
            <p>© ${new Date().getFullYear()} ${data.productName}. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>
    `;
  };

  // HTML 생성 함수 (미리보기용 - 이미지 data URL 직접 포함)
  const generateHTMLForPreview = useCallback(() => {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.productName} - 미리보기</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: 'Noto Sans KR', sans-serif; 
            margin: 0; 
            padding: 0; 
            color: #333; 
            line-height: 1.8;
            background: #fff;
        }
        .container { max-width: 860px; margin: 0 auto; }
        .hero { 
            text-align: center; 
            padding: 80px 30px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .hero h1 { 
            font-size: 2.8rem; 
            margin-bottom: 20px; 
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .hero p { 
            font-size: 1.3rem; 
            max-width: 650px; 
            margin: 0 auto; 
            opacity: 0.95;
            line-height: 1.8;
        }
        .features { 
            padding: 50px 30px; 
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }
        .features h3 {
            text-align: center;
            font-size: 1.5rem;
            margin-bottom: 30px;
            color: #1e293b;
        }
        .features ul { 
            max-width: 650px; 
            margin: 0 auto; 
            padding-left: 0;
            list-style: none;
        }
        .features li { 
            margin-bottom: 15px; 
            font-size: 1.1rem; 
            padding: 15px 20px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            position: relative;
            padding-left: 50px;
        }
        .features li::before {
            content: "✓";
            position: absolute;
            left: 20px;
            color: #10b981;
            font-weight: bold;
        }
        .section { 
            padding: 70px 30px; 
            border-bottom: 1px solid #e5e7eb; 
            text-align: center;
        }
        .section:nth-child(even) {
            background: #fafafa;
        }
        .section img { 
            max-width: 100%; 
            height: auto; 
            border-radius: 12px; 
            margin-bottom: 35px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.12);
        }
        .section h2 { 
            font-size: 2rem; 
            margin-bottom: 20px;
            color: #1e293b;
            font-weight: 600;
        }
        .section p { 
            font-size: 1.15rem; 
            color: #64748b; 
            max-width: 750px; 
            margin: 0 auto; 
            white-space: pre-wrap;
            line-height: 1.9;
        }
        .footer { 
            padding: 50px 30px; 
            text-align: center; 
            font-size: 0.95rem; 
            color: #94a3b8; 
            background: #1e293b;
        }
        .preview-badge {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            z-index: 1000;
        }
    </style>
</head>
<body>
    <div class="preview-badge">🔍 미리보기</div>
    <div class="container">
        <header class="hero">
            <h1>${data.productName}</h1>
            <p>${data.marketingCopy}</p>
        </header>

        <section class="features">
            <h3>✨ 주요 특징</h3>
            <ul>
                ${data.mainFeatures.map(f => `<li>${f}</li>`).join('')}
            </ul>
        </section>

        ${data.sections.map((section, index) => {
      const layoutType = section.layoutType || 'full-width';
      const isGridLayout = layoutType === 'grid-2' || layoutType === 'grid-3';
      const isTextOnly = layoutType === 'text-only';
      const gridCols = layoutType === 'grid-3' ? 3 : layoutType === 'grid-2' ? 2 : 1;
      const hasMultipleSlots = section.imageSlots && section.imageSlots.length > 1;

      if (isGridLayout && hasMultipleSlots) {
        return `
        <section class="section">
            <div style="display: grid; grid-template-columns: repeat(${gridCols}, 1fr); gap: 15px; margin-bottom: 30px;">
                ${section.imageSlots?.map((slot, slotIdx) =>
          slot.imageUrl
            ? `<img src="${slot.imageUrl}" alt="${section.title} - ${slotIdx + 1}" style="width: 100%; height: auto; border-radius: 8px; object-fit: cover; aspect-ratio: 1/1;" />`
            : `<div style="width: 100%; aspect-ratio: 1/1; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #9ca3af;">이미지 ${slotIdx + 1}</div>`
        ).join('')}
            </div>
            <h2>${section.title}</h2>
            <p>${section.content}</p>
        </section>`;
      } else if (isTextOnly) {
        return `
        <section class="section">
            <h2>${section.title}</h2>
            <p>${section.content}</p>
        </section>`;
      } else {
        return `
        <section class="section">
            ${section.imageUrl ? `<img src="${section.imageUrl}" alt="${section.title}" />` : ''}
            <h2>${section.title}</h2>
            <p>${section.content}</p>
        </section>`;
      }
    }).join('')}

        <footer class="footer">
            <p>© ${new Date().getFullYear()} ${data.productName}. All rights reserved.</p>
            <p style="margin-top: 10px; font-size: 0.8rem;">이 페이지는 PageGenie로 생성되었습니다.</p>
        </footer>
    </div>
</body>
</html>`;
  }, [data]);

  // 새 창에서 미리보기
  const handlePreviewInNewWindow = useCallback(() => {
    const html = generateHTMLForPreview();
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
      toast.success('새 창에서 미리보기가 열렸습니다.');
    } else {
      toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
    }
  }, [generateHTMLForPreview, toast]);

  const downloadHtml = () => {
    const html = generateHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.productName.replace(/\s+/g, '_')}_detail_page.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Google Drive용 ZIP 파일 생성 및 다운로드
  const handleDriveSave = async () => {
    setIsSaving(true);
    setSaveType('drive');
    try {
      const zip = new JSZip();

      const infoContent = `상품명: ${data.productName}
카테고리: ${data.detectedCategory}
모드: ${mode === AppMode.CREATION ? '생성(Creation)' : '현지화(Localization)'}
생성일시: ${new Date().toLocaleString()}

[주요 특징]
${data.mainFeatures.map(f => `- ${f}`).join('\n')}

[마케팅 카피]
${data.marketingCopy}
      `;
      zip.file("product_info.txt", infoContent);

      const imgFolder = zip.folder("images");
      if (imgFolder) {
        data.sections.forEach((section) => {
          // 단일 이미지 저장
          if (section.imageUrl) {
            const base64Data = section.imageUrl.split(',')[1];
            if (base64Data) {
              imgFolder.file(`section_${section.id}.png`, base64Data, { base64: true });
            }
          }

          // 그리드 이미지 저장
          if ((section.layoutType === 'grid-2' || section.layoutType === 'grid-3') && section.imageSlots) {
            section.imageSlots.forEach((slot, idx) => {
              if (slot.imageUrl) {
                const base64Data = slot.imageUrl.split(',')[1];
                if (base64Data) {
                  imgFolder.file(`section_${section.id}_slot_${idx}.png`, base64Data, { base64: true });
                }
              }
            });
          }
        });
      }

      const htmlContent = generateHTML();
      zip.file("index.html", htmlContent);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `[Gemini]_${data.productName.replace(/\s+/g, '_')}_package.zip`);

      toast.success("📦 드라이브 업로드용 패키지(ZIP)가 생성되었습니다. 구글 드라이브에 이 파일을 업로드하세요.");
    } catch (e) {
      console.error(e);
      toast.error("파일 생성 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
      setSaveType(null);
    }
  };

  // 구글 시트 데이터 저장 (GAS 연동 + CSV 다운로드 Fallback)
  const handleSheetSave = async () => {
    setIsSaving(true);
    setSaveType('sheet');

    try {
      // 1. Google Apps Script 연동 시도
      try {
        let gasUrl = getGasUrl();

        // --- [NEW] URL 안전장치 추가 ---
        if (!gasUrl || gasUrl === DEFAULT_GAS_URL) {
          const confirmSettings = window.confirm(
            "⚠️ 주의: 현재 '기본 데모 서버(Default)'로 설정되어 있습니다.\n\n" +
            "회원님의 구글 시트/드라이브에 저장하려면 [설정]에서\n" +
            "새로 배포한 '웹 앱 URL'을 입력해야 합니다.\n\n" +
            "설정 창으로 이동하시겠습니까? (취소 시 데모 서버로 전송 시도)"
          );
          if (confirmSettings) {
            onOpenSettings(); // 공통 설정 모달 열기
            throw new Error("SETTINGS_OPENED");
          }
        }

        if (gasUrl) {
          console.log("Starting full data upload with images...");

          await saveToGoogleSheet(data, mode);

          toast.success(
            '✅ 저장 성공!\n\n' +
            '1. 구글 시트에 텍스트 데이터가 저장되었습니다.\n' +
            '2. 구글 드라이브에 상품명으로 폴더가 생성되었습니다.\n' +
            '3. 생성된 이미지가 드라이브 폴더에 저장되었습니다.',
            8000
          );

          // 시트 열기 확인
          setTimeout(() => {
            if (window.confirm('시트를 열어 확인하시겠습니까?')) {
              openGoogleSheet();
            }
          }, 500);

          return;
        }
      } catch (e) {
        if (e instanceof Error && e.message === "SETTINGS_OPENED") {
          return;
        } else if (e instanceof Error && e.message === "URL_NOT_SET") {
          // Fallthrough to CSV
        } else {
          console.error('GAS Error', e);
          if (e instanceof Error && e.message === 'IMAGE_SIZE_TOO_LARGE') {
            toast.warning('⚠️ 이미지 용량이 너무 커서 텍스트 데이터만 저장되었습니다. (구글 드라이브 이미지 저장은 건너뛰었습니다.)', 8000);
          } else {
            toast.error(
              '구글 시트 전송 중 문제가 발생했습니다.\n\n' +
              '[체크사항]\n' +
              '1. GAS 스크립트가 최신 버전("GOOGLE_APPS_SCRIPT_CODE.js")인지 확인하세요.\n' +
              '2. [설정] 메뉴의 웹 앱 URL이 정확한지 확인하세요.\n\n' +
              '데이터 보존을 위해 CSV 파일로 다운로드합니다.',
              10000
            );
          }
        }
      }

      // 2. CSV 다운로드 (Fallback)
      const csvContent = generateCSV(data, mode);
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `[DATA]_${data.productName}_sheet.csv`);
      toast.info('CSV 파일로 다운로드되었습니다.');

    } catch (e) {
      toast.error('저장 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
      setSaveType(null);
    }
  };

  // 1. 재생성 모달 열기
  const handleOpenRegenModal = (sectionId: string, currentPrompt: string) => {
    setEditModal({
      isOpen: true,
      sectionId,
      prompt: currentPrompt
    });
  };

  // 2. 실제 이미지 재생성 실행
  const handleConfirmRegenerate = async () => {
    if (!editModal || !editModal.prompt) return;

    const { sectionId, prompt } = editModal;
    setEditModal(null); // 모달 닫기
    setRegeneratingId(sectionId); // 해당 섹션 로딩 시작

    try {
      // Use first uploaded file as reference
      const primaryFile = uploadedFiles.length > 0 ? uploadedFiles[0] : null;

      const newImageUrl = await generateSectionImage(
        prompt,
        primaryFile?.base64,
        primaryFile?.mimeType,
        mode
      );

      const newSections = data.sections.map(section =>
        section.id === sectionId
          ? { ...section, imageUrl: newImageUrl, imagePrompt: prompt } // 프롬프트도 업데이트
          : section
      );

      onUpdate({ ...data, sections: newSections });
      toast.success("이미지가 재생성되었습니다.");
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "이미지 재생성 중 오류가 발생했습니다.";
      toast.error(errorMessage);
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 relative">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <CheckCircle className="w-8 h-8 text-green-500 mr-2" />
            상세페이지 생성 완료
          </h2>
          <p className="text-gray-500 mt-1">모든 이미지가 생성되었고 코드가 준비되었습니다.</p>
        </div>
        <div className="flex gap-3 flex-wrap justify-end">
          {/* 새 창 미리보기 버튼 */}
          <button
            onClick={handlePreviewInNewWindow}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Eye className="w-4 h-4 mr-2" />
            새 창 미리보기
          </button>

          <button
            onClick={downloadHtml}
            className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Code className="w-4 h-4 mr-2" />
            HTML 다운로드
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={handleSheetSave}
              disabled={isSaving}
              className={`flex items-center px-4 py-2 text-white rounded-l-lg transition-colors disabled:opacity-50 min-w-[160px] justify-center ${isSaving && saveType === 'sheet' ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isSaving && saveType === 'sheet' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  업로드 중...
                </>
              ) : (
                <>
                  <Table className="w-4 h-4 mr-2" />
                  DB/이미지 저장
                </>
              )}
            </button>
            <button
              onClick={onOpenSettings}
              className="bg-green-700 hover:bg-green-800 text-white p-2 rounded-r-lg h-full transition-colors relative"
              title="구글 시트 연동 설정 (URL/ID 변경)"
            >
              <Settings className="w-5 h-5" />
              {/* 설정 알림 도트: URL이 기본값이면 빨간 점 표시 */}
              {getGasUrl() === DEFAULT_GAS_URL && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-400 border-2 border-green-700 rounded-full"></span>
              )}
            </button>
          </div>

          <button
            onClick={handleDriveSave}
            disabled={isSaving}
            className={`flex items-center px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${isSaving && saveType === 'drive' ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSaving && saveType === 'drive' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
            Drive 패키지(ZIP)
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 h-[800px]">
        {/* Preview Panel - Scrollable */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 flex flex-col h-full">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <span className="font-semibold text-gray-700">미리보기</span>
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-white">
            {/* Actual rendered preview */}
            <div className="max-w-[800px] mx-auto bg-white min-h-full">
              {/* Hero */}
              <div className="text-center py-16 px-6 bg-slate-50">
                <h1 className="text-4xl font-bold text-gray-900 mb-6">{data.productName}</h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">{data.marketingCopy}</p>
              </div>

              {/* Features */}
              <div className="py-12 px-6">
                <div className="max-w-2xl mx-auto bg-white border border-gray-100 rounded-xl p-8 shadow-sm">
                  <h3 className="text-sm font-bold text-blue-600 uppercase mb-4 tracking-wider text-center">주요 특징 (Key Features)</h3>
                  <ul className="space-y-3">
                    {data.mainFeatures.map((feat, i) => (
                      <li key={i} className="flex items-start text-gray-700">
                        <span className="mr-2 text-blue-500">•</span>
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-0">
                {data.sections.map((section) => {
                  const layoutType = section.layoutType || 'full-width';
                  const isGridLayout = layoutType === 'grid-2' || layoutType === 'grid-3';
                  const isTextOnly = layoutType === 'text-only';
                  const gridCols = layoutType === 'grid-3' ? 3 : layoutType === 'grid-2' ? 2 : 1;
                  const hasMultipleSlots = section.imageSlots && section.imageSlots.length > 1;

                  return (
                    <div key={section.id} className="py-16 px-6 border-b border-gray-100 last:border-0">
                      <div className="max-w-3xl mx-auto text-center">
                        {/* Grid Layout: 여러 이미지 표시 */}
                        {isGridLayout && hasMultipleSlots ? (
                          <div className={`grid gap-4 mb-8 ${gridCols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            {section.imageSlots?.map((slot, slotIdx) => (
                              <div key={slotIdx} className="relative group aspect-square">
                                {slot.imageUrl ? (
                                  <>
                                    <img
                                      src={slot.imageUrl}
                                      alt={`${section.title} - ${slotIdx + 1}`}
                                      className="w-full h-full object-cover rounded-lg shadow-sm"
                                    />
                                    {/* Grid Slot Overlay Actions */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity rounded-lg">
                                      <a
                                        href={slot.imageUrl}
                                        download={`section_${section.id}_slot_${slotIdx}.png`}
                                        className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                                        title="다운로드"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Download className="w-4 h-4" />
                                      </a>
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                                    이미지 없음
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : !isTextOnly && section.imageUrl ? (
                          /* Single Image Layout */
                          <div className="relative group inline-block w-full max-w-full">
                            <img
                              src={section.imageUrl}
                              alt={section.title}
                              className="w-full h-auto rounded-lg shadow-md mb-8 object-cover"
                            />
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleOpenRegenModal(section.id, section.imagePrompt)}
                                disabled={!!regeneratingId}
                                className="bg-white/90 hover:bg-white text-gray-700 p-2.5 rounded-full shadow-lg border border-gray-200 transition-all hover:scale-105 disabled:opacity-70 disabled:scale-100"
                                title="이미지 다시 생성 (프롬프트 수정)"
                              >
                                <RefreshCw className={`w-5 h-5 ${regeneratingId === section.id ? 'animate-spin text-blue-600' : ''}`} />
                              </button>
                            </div>
                            {regeneratingId === section.id && (
                              <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
                                <div className="bg-white px-4 py-2 rounded-full shadow-lg flex items-center text-sm font-medium text-blue-600">
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  재생성 중...
                                </div>
                              </div>
                            )}
                          </div>
                        ) : !isTextOnly && !section.imageUrl ? (
                          /* No Image Placeholder */
                          <div className="w-full h-64 bg-gray-100 rounded-lg flex flex-col items-center justify-center mb-8 text-gray-400 group relative">
                            <span className="mb-2">이미지 없음 (No Image)</span>
                            <button
                              onClick={() => handleOpenRegenModal(section.id, section.imagePrompt)}
                              disabled={!!regeneratingId}
                              className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center font-medium bg-white px-3 py-1.5 rounded-full border shadow-sm"
                            >
                              <RefreshCw className={`w-4 h-4 mr-1.5 ${regeneratingId === section.id ? 'animate-spin' : ''}`} />
                              이미지 생성
                            </button>
                          </div>
                        ) : null}
                        <h2 className="text-3xl font-bold text-gray-900 mb-6">{section.title}</h2>
                        <p className="text-lg text-gray-600 whitespace-pre-line leading-relaxed">{section.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="py-12 text-center text-gray-400 bg-gray-50 text-sm">
                Generated by PageGenie
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Assets */}
        <div className="lg:col-span-1 space-y-4 h-full overflow-y-auto custom-scrollbar">
          <h3 className="font-bold text-gray-700 sticky top-0 bg-gray-50 py-2 z-10 flex items-center">
            <ImageIcon className="w-4 h-4 mr-2 text-blue-600" />
            생성된 이미지 에셋
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {data.sections.map((section, idx) => {
              const items = [];

              // 단일 이미지
              if (section.imageUrl) {
                items.push(
                  <div key={`${section.id}-single`} className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                    <img src={section.imageUrl} alt={section.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <a
                        href={section.imageUrl}
                        download={`section_${idx + 1}.png`}
                        className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                        title="다운로드"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                      <button
                        onClick={() => handleOpenRegenModal(section.id, section.imagePrompt)}
                        className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                        title="프롬프트 수정 및 다시 생성"
                        disabled={!!regeneratingId}
                      >
                        <RefreshCw className={`w-5 h-5 ${regeneratingId === section.id ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-white text-xs truncate">
                      {section.title}
                    </div>
                  </div>
                );
              }

              // 그리드 이미지들
              if ((section.layoutType === 'grid-2' || section.layoutType === 'grid-3') && section.imageSlots) {
                section.imageSlots.forEach((slot, slotIdx) => {
                  if (slot.imageUrl) {
                    items.push(
                      <div key={`${section.id}-slot-${slotIdx}`} className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                        <img src={slot.imageUrl} alt={`${section.title} - ${slotIdx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                          <a
                            href={slot.imageUrl}
                            download={`section_${idx + 1}_slot_${slotIdx + 1}.png`}
                            className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                            title="다운로드"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-white text-xs truncate">
                          {section.title} ({slotIdx + 1})
                        </div>
                      </div>
                    );
                  }
                });
              }

              return items;
            })}
          </div>

          <button
            onClick={onRestart}
            className="w-full mt-8 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
          >
            처음으로 돌아가기
          </button>
        </div>
      </div>

      {/* Prompt Edit Modal */}
      {
        editModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-800 flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
                  이미지 프롬프트 수정
                </h3>
                <button
                  onClick={() => setEditModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Gemini에게 요청할 이미지 설명을 수정하거나 추가하세요.<br />
                    <span className="text-xs text-gray-400">(영어 프롬프트가 더 정확한 결과를 생성합니다)</span>
                  </p>
                  <textarea
                    value={editModal.prompt}
                    onChange={(e) => setEditModal({ ...editModal, prompt: e.target.value })}
                    className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm leading-relaxed"
                    placeholder="이미지에 대한 설명을 입력하세요..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setEditModal(null)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleConfirmRegenerate}
                    disabled={!editModal.prompt.trim()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    이미지 생성하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};