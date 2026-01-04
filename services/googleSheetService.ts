import { ProductAnalysis, AppMode } from "../types";

// 기본 데모 시트 ID (사용자 설정이 없을 경우 Fallback용)
export const DEMO_SHEET_ID = '';

// 제공된 기본 GAS Web App URL (데모용)
export const DEFAULT_GAS_URL = import.meta.env.VITE_DEFAULT_GAS_URL || '';

// LocalStorage 키
const GAS_URL_KEY = 'gemini_commerce_gas_url';
const SHEET_ID_KEY = 'gemini_commerce_sheet_id';

// 시트에 저장할 데이터 행(Row) 기본 구조
export interface SheetRowData {
  timestamp: string;
  mode: string;
  productName: string;
  category: string;
  features: string;
  marketingCopy: string;
  sectionCount: number;
  sections_summary: string;
  image_prompts: string;
}

/**
 * 저장된 GAS Web App URL 가져오기
 * @param includeDefault - true면 저장된 값이 없을 때 기본값 반환, false면 null 반환
 */
export const getGasUrl = (includeDefault: boolean = true): string | null => {
  const savedUrl = localStorage.getItem(GAS_URL_KEY);
  // 빈 문자열이나 null인 경우
  if (!savedUrl || savedUrl.trim() === '') {
    return includeDefault ? DEFAULT_GAS_URL : null;
  }
  return savedUrl;
};

/**
 * GAS Web App URL 저장하기
 */
export const setGasUrl = (url: string) => {
  localStorage.setItem(GAS_URL_KEY, url);
};

/**
 * 저장된 시트 ID 가져오기 (없으면 데모 ID 반환)
 */
export const getSheetId = (): string => {
  const stored = localStorage.getItem(SHEET_ID_KEY);
  // 빈 문자열이 저장되어 있다면(사용자가 지운 경우) 빈 값 반환
  if (!stored || stored.trim() === '') {
    return '';
  }
  return stored;
};

/**
 * 시트 ID 저장하기
 */
export const setSheetId = (id: string) => {
  localStorage.setItem(SHEET_ID_KEY, id);
};

/**
 * 구글 시트 열기
 */
export const openGoogleSheet = () => {
  const sheetId = getSheetId();
  window.open(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`, '_blank');
};

/**
 * 분석 데이터를 시트 저장용 텍스트 포맷으로 변환 (요약 정보)
 */
export const formatDataForSheet = (data: ProductAnalysis, mode: AppMode): SheetRowData => {
  // 1. Summarize Sections
  const sectionsSummary = data.sections.map((s, i) => {
    return `[Section ${i + 1}: ${s.title}]\n${s.content}`;
  }).join('\n----------------\n');

  // 2. Collect Prompts
  const prompts = data.sections.map((s, i) => {
    return `[S${i + 1}] ${s.imagePrompt || 'No Prompt'}`;
  }).join('\n');

  return {
    timestamp: new Date().toLocaleString('ko-KR'),
    mode: mode === AppMode.CREATION ? '생성(Mode A)' : '현지화(Mode B)',
    productName: data.productName,
    category: data.detectedCategory || 'N/A',
    features: data.mainFeatures.join(', '),
    marketingCopy: data.marketingCopy,
    sectionCount: data.sections.length,
    sections_summary: sectionsSummary,
    image_prompts: prompts,
  };
};

/**
 * CSV 데이터 문자열 생성 (백업용)
 * NOTE: CSV는 셀 용량 제한이 있으므로, 대용량 Base64 이미지는 제외하고 저장합니다.
 */
export const generateCSV = (data: ProductAnalysis, mode: AppMode): string => {
  const row = formatDataForSheet(data, mode);

  // Clean JSON for CSV (Remove huge image strings to prevent CSV breakage)
  const cleanDataForCsv = {
    ...data,
    sections: data.sections.map(s => ({
      ...s,
      imageUrl: s.imageUrl ? '(Image Data Omitted for CSV - See Drive or Sheet)' : undefined
    }))
  };

  const headers = [
    '타임스탬프', '모드', '상품명', '카테고리',
    '주요특징', '마케팅문구', '섹션수',
    '섹션상세내용', '이미지프롬프트', '전체데이터_JSON(이미지제외)'
  ];

  const escapeCsv = (str: string | number) => {
    if (str === null || str === undefined) return '';
    const stringValue = String(str);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const values = [
    escapeCsv(row.timestamp),
    escapeCsv(row.mode),
    escapeCsv(row.productName),
    escapeCsv(row.category),
    escapeCsv(row.features),
    escapeCsv(row.marketingCopy),
    escapeCsv(row.sectionCount),
    escapeCsv(row.sections_summary),
    escapeCsv(row.image_prompts),
    escapeCsv(JSON.stringify(cleanDataForCsv))
  ];

  return headers.join(',') + '\n' + values.join(',');
};

/**
 * HTML 페이지 생성 함수
 */
const generateHTML = (data: ProductAnalysis): string => {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.productName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
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

        ${data.sections.map(section => `
        <section class="section">
            ${section.imageUrl ? `<img src="images/section_${section.id}.png" alt="${section.title}" />` : ''}
            <h2>${section.title}</h2>
            <p>${section.content}</p>
        </section>
        `).join('')}

        <footer class="footer">
            <p>© ${new Date().getFullYear()} ${data.productName}. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>`;
};

/**
 * Google Apps Script로 데이터 전송 (Real DB Save)
 * 이미지를 별도의 경량 배열로 변환하여 전송 성공률을 높입니다.
 * 전송 실패(Failed to fetch) 시 이미지 제외하고 재시도합니다.
 */
export const saveToGoogleSheet = async (data: ProductAnalysis, mode: AppMode): Promise<boolean> => {
  const scriptUrl = getGasUrl();

  if (!scriptUrl) {
    throw new Error("URL_NOT_SET");
  }

  // 1. 기본 텍스트 데이터 준비
  const rowData = formatDataForSheet(data, mode);

  // 2. 드라이브 폴더명 생성 (예: [2023-10-25] 상품명)
  const dateStr = new Date().toISOString().split('T')[0];
  const safeProductName = data.productName.replace(/[\/\\]/g, '_').substring(0, 30);
  const folderName = `[${dateStr}] ${safeProductName}`;

  // 3. 이미지 데이터 별도 추출 (전송 용량 최적화 및 명시적 구조화)
  // ★ 다중 슬롯(imageSlots) 이미지도 처리
  const imagesToSave: Array<{
    index: number;
    id: string;
    title: string;
    base64: string;
    slotIndex?: number;  // 슬롯 인덱스 (다중 이미지 구분용)
  }> = [];

  data.sections.forEach((section, sectionIndex) => {
    // 다중 이미지 슬롯 처리 (grid-2, grid-3)
    if (section.imageSlots && section.imageSlots.length > 1) {
      section.imageSlots.forEach((slot, slotIdx) => {
        if (slot.imageUrl && slot.imageUrl.startsWith('data:image')) {
          imagesToSave.push({
            index: sectionIndex,
            id: `${section.id}-slot-${slotIdx + 1}`,
            title: `${section.title}_img${slotIdx + 1}`,
            base64: slot.imageUrl.split(',')[1],
            slotIndex: slotIdx
          });
        }
      });
    }
    // 단일 이미지 (기존 방식)
    else if (section.imageUrl && section.imageUrl.startsWith('data:image')) {
      imagesToSave.push({
        index: sectionIndex,
        id: section.id,
        title: section.title,
        base64: section.imageUrl.split(',')[1]
      });
    }
  });

  // 4. 섹션 데이터도 전송 (HTML에서 이미지 경로 매칭을 위해)
  // ★ 슬롯 정보도 포함
  const sectionsData = data.sections.map((section, index) => ({
    id: section.id,
    index: index,
    title: section.title,
    layoutType: section.layoutType,
    slotCount: section.imageSlots?.length || 1
  }));

  // 4. HTML 파일 생성
  const htmlContent = generateHTML(data);
  const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent))); // UTF-8 인코딩 후 Base64 변환

  // Payload: Full (With Images and HTML)
  const payloadFull = {
    ...rowData,
    sheetId: getSheetId(),
    folderName: folderName,
    saveImagesToDrive: true,
    images: imagesToSave,
    sections: sectionsData, // 섹션 데이터 전송 (HTML 이미지 경로 매칭용)
    htmlContent: htmlBase64, // HTML 파일을 Base64로 인코딩하여 전송
    htmlFileName: `${safeProductName}_detail_page.html`
  };

  // Payload: Text Only (Fallback)
  const payloadTextOnly = {
    ...rowData,
    sheetId: getSheetId(),
    folderName: folderName,
    saveImagesToDrive: false,
    images: [],
    htmlContent: htmlBase64, // HTML은 텍스트만 있어도 저장 가능
    htmlFileName: `${safeProductName}_detail_page.html`
  };

  const postData = async (payload: any) => {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });
  };

  console.log('🔵 [Google Sheet Service] Sending optimized payload to GAS...');

  try {
    // Attempt 1: Full Upload
    await postData(payloadFull);
    return true;
  } catch (error) {
    console.warn('🟡 [Google Sheet Service] Full upload failed (likely due to payload size). Retrying text-only...', error);

    try {
      // Attempt 2: Text Only
      await postData(payloadTextOnly);
      // Toast는 호출하는 컴포넌트에서 처리
      throw new Error('IMAGE_SIZE_TOO_LARGE');
    } catch (retryError) {
      console.error('🔴 [Google Sheet Service] Error:', retryError);
      throw retryError;
    }
  }
};