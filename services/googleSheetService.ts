import { ProductAnalysis, AppMode } from "../types";

// 기본 데모 시트 ID (사용자 설정이 없을 경우 Fallback용)
export const DEMO_SHEET_ID = '1DvQtasp2aQ5vC-PwKVDQt7LM1P8F5tiI6dgDGNFqUWE';

// 제공된 기본 GAS Web App URL (데모용)
export const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwaOL3xBQiE7uLhbRHLbrlitf5xMYTA-Lmo5p2XB9HkGNkKYYvy_4nK_ee2JtYUY_Fddw/exec';

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
 */
export const getGasUrl = (): string | null => {
  return localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_URL;
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
  // 빈 문자열이 저장되어 있다면(사용자가 지운 경우) 데모 ID 반환
  if (!stored || stored.trim() === '') {
    return DEMO_SHEET_ID;
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
    return `[Section ${i+1}: ${s.title}]\n${s.content}`;
  }).join('\n----------------\n');

  // 2. Collect Prompts
  const prompts = data.sections.map((s, i) => {
    return `[S${i+1}] ${s.imagePrompt || 'No Prompt'}`;
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
  const imagesToSave = data.sections.map((section, index) => {
    if (section.imageUrl && section.imageUrl.startsWith('data:image')) {
      return {
        index: index,
        title: section.title,
        base64: section.imageUrl.split(',')[1] // 헤더(data:image...) 제거 후 순수 데이터만 전송
      };
    }
    return null;
  }).filter(item => item !== null);

  // Payload: Full (With Images)
  const payloadFull = {
    ...rowData, 
    sheetId: getSheetId(),
    folderName: folderName,
    saveImagesToDrive: true,
    images: imagesToSave
  };

  // Payload: Text Only (Fallback)
  const payloadTextOnly = {
    ...rowData,
    sheetId: getSheetId(),
    folderName: folderName,
    saveImagesToDrive: false,
    images: []
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
      alert('⚠️ 이미지 용량이 너무 커서 텍스트 데이터만 저장되었습니다.\n(구글 드라이브 이미지 저장은 건너뛰었습니다.)');
      return true;
    } catch (retryError) {
      console.error('🔴 [Google Sheet Service] Error:', retryError);
      throw retryError;
    }
  }
};