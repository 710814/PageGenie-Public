import { getGasUrl, setGasUrl, getSheetId, setSheetId, DEFAULT_GAS_URL } from './googleSheetService';
import { getTemplates, saveTemplate } from './templateService';
import { Template } from '../types';

// LocalStorage 키
const AUTO_BACKUP_KEY = 'pagegenie_auto_backup_enabled';
const LAST_BACKUP_DATE_KEY = 'pagegenie_last_backup_date';

/**
 * 백업할 설정 데이터 인터페이스
 */
export interface BackupSettings {
  gasUrl: string | null;
  sheetId: string;
  templates: Template[];
  backupDate: string;
}

/**
 * 자동 백업 활성화 여부 확인
 */
export const isAutoBackupEnabled = (): boolean => {
  return localStorage.getItem(AUTO_BACKUP_KEY) === 'true';
};

/**
 * 자동 백업 활성화/비활성화 설정
 */
export const setAutoBackupEnabled = (enabled: boolean): void => {
  localStorage.setItem(AUTO_BACKUP_KEY, enabled.toString());
};

/**
 * 마지막 백업 날짜 가져오기
 */
export const getLastBackupDate = (): string | null => {
  return localStorage.getItem(LAST_BACKUP_DATE_KEY);
};

/**
 * 마지막 백업 날짜 저장
 */
const setLastBackupDate = (date: string): void => {
  localStorage.setItem(LAST_BACKUP_DATE_KEY, date);
};

/**
 * URL 정규화 함수 (DEFAULT_GAS_URL과 비교용)
 */
const normalizeUrlForComparison = (url: string): string => {
  return url
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '')
    .replace(/-/g, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
};

/**
 * Base64 이미지 압축 (최대 너비 1024px, JPEG 0.6)
 */
const compressBase64Image = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    // 이미 압축된 키워드가 있거나 너무 짧으면 패스
    if (!base64 || base64.length < 5000) {
      resolve(base64);
      return;
    }

    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_WIDTH = 1024;

      // 크기 조정
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }
      ctx.fillStyle = '#FFFFFF'; // 투명 배경 방지
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // JPEG 0.6 품질로 압축
      const compressed = canvas.toDataURL('image/jpeg', 0.6);

      // 만약 압축 결과가 더 크다면 원본 사용
      resolve(compressed.length < base64.length ? compressed : base64);
    };
    img.onerror = () => resolve(base64);
  });
};

/**
 * 설정을 Google Drive에 백업
 * @returns 성공 여부
 */
export const backupSettingsToDrive = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const gasUrl = getGasUrl(true);

    if (!gasUrl) {
      return { success: false, message: 'GAS URL이 설정되지 않았습니다.' };
    }

    // 기본 데모 URL인지 확인
    const normalizedGasUrl = normalizeUrlForComparison(gasUrl);
    const normalizedDefaultUrl = normalizeUrlForComparison(DEFAULT_GAS_URL);

    if (normalizedGasUrl === normalizedDefaultUrl) {
      return { success: false, message: '개인 GAS URL을 먼저 설정해주세요.' };
    }

    // 템플릿 이미지 압축 처리 (비동기 병렬 처리)
    const rawTemplates = getTemplates();
    console.log('[Backup] 템플릿 이미지 압축 시작...');

    const compressedTemplates = await Promise.all(
      rawTemplates.map(async (tpl) => {
        const sections = await Promise.all(tpl.sections.map(async (sec) => {
          if (sec.fixedImageBase64) {
            try {
              const compressed = await compressBase64Image(sec.fixedImageBase64);
              return {
                ...sec,
                fixedImageBase64: compressed,
                // 압축으로 인해 MIME 타입이 변경될 수 있음 (JPEG)
                fixedImageMimeType: 'image/jpeg'
              };
            } catch (e) {
              console.warn('Image compression failed:', e);
              return sec;
            }
          }
          return sec;
        }));
        return { ...tpl, sections };
      })
    );

    // 백업할 설정 데이터 구성
    const settings: BackupSettings = {
      gasUrl: getGasUrl(false), // 기본값 제외하고 실제 저장된 값만
      sheetId: getSheetId(),
      templates: compressedTemplates,
      backupDate: new Date().toISOString()
    };

    console.log('[Backup] 설정 백업 시작...', {
      templatesCount: settings.templates.length
    });

    // GAS에 백업 요청 (타임아웃 설정)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    try {
      const response = await fetch(`${gasUrl}?action=backup-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ settings }),
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '응답을 읽을 수 없습니다');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // 응답 텍스트를 먼저 확인
      const responseText = await response.text();
      console.log('[Backup] 응답 텍스트:', responseText.substring(0, 200));

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[Backup] JSON 파싱 실패:', parseError, '응답:', responseText);
        throw new Error('서버 응답을 파싱할 수 없습니다: ' + responseText.substring(0, 100));
      }

      if (result.status === 'success') {
        setLastBackupDate(new Date().toISOString());
        console.log('[Backup] 백업 성공:', result);
        return { success: true, message: '설정이 Google Drive에 백업되었습니다.' };
      } else {
        throw new Error(result.message || '백업 실패');
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('백업 요청이 타임아웃되었습니다. 네트워크 연결을 확인하세요.');
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('[Backup] 백업 실패:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '백업 중 오류가 발생했습니다.'
    };
  }
};

/**
 * Google Drive에서 설정 복원
 * @returns 복원된 설정 또는 null
 */
export const restoreSettingsFromDrive = async (): Promise<{
  success: boolean;
  settings: BackupSettings | null;
  message: string;
  status?: 'success' | 'not_found' | 'error';
}> => {
  try {
    const gasUrl = getGasUrl(true);

    if (!gasUrl) {
      return { success: false, settings: null, message: 'GAS URL이 설정되지 않았습니다.' };
    }

    // 기본 데모 URL인지 확인
    const normalizedGasUrl = normalizeUrlForComparison(gasUrl);
    const normalizedDefaultUrl = normalizeUrlForComparison(DEFAULT_GAS_URL);

    if (normalizedGasUrl === normalizedDefaultUrl) {
      return { success: false, settings: null, message: '개인 GAS URL이 필요합니다.' };
    }

    console.log('[Restore] 설정 복원 시도...');

    // GAS에 복원 요청 (타임아웃 설정)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    try {
      const response = await fetch(`${gasUrl}?action=restore-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({}),
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '응답을 읽을 수 없습니다');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // 응답 텍스트를 먼저 확인
      const responseText = await response.text();
      console.log('[Restore] 응답 텍스트:', responseText.substring(0, 200));

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[Restore] JSON 파싱 실패:', parseError, '응답:', responseText);
        throw new Error('서버 응답을 파싱할 수 없습니다: ' + responseText.substring(0, 100));
      }

      if (result.status === 'success' && result.settings) {
        console.log('[Restore] 복원 성공:', {
          templatesCount: result.settings.templates?.length || 0,
          backupDate: result.settings.backupDate
        });
        return {
          success: true,
          settings: result.settings,
          message: '설정이 복원되었습니다.',
          status: 'success'
        };
      } else if (result.status === 'not_found') {
        return {
          success: false,
          settings: null,
          message: '백업 파일이 없습니다.',
          status: 'not_found'
        };
      } else {
        throw new Error(result.message || '복원 실패');
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('복원 요청이 타임아웃되었습니다. 네트워크 연결을 확인하세요.');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[Restore] 복원 실패:', error);
    return {
      success: false,
      settings: null,
      message: error instanceof Error ? error.message : '복원 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 복원된 설정을 로컬에 적용
 */
export const applyRestoredSettings = (settings: BackupSettings): void => {
  // GAS URL 복원 (있는 경우에만)
  if (settings.gasUrl) {
    setGasUrl(settings.gasUrl);
    console.log('[Restore] GAS URL 복원됨');
  }

  // Sheet ID 복원
  if (settings.sheetId) {
    setSheetId(settings.sheetId);
    console.log('[Restore] Sheet ID 복원됨');
  }

  // 템플릿 복원 (기존 템플릿과 병합)
  if (settings.templates && settings.templates.length > 0) {
    settings.templates.forEach(template => {
      saveTemplate(template);
    });
    console.log('[Restore] 템플릿 복원됨:', settings.templates.length);
  }
};

/**
 * 설정이 비어있는지 확인 (복원 필요 여부 판단)
 */
export const isSettingsEmpty = (): boolean => {
  const gasUrl = getGasUrl(false); // 기본값 제외
  const templates = getTemplates();

  return !gasUrl && templates.length === 0;
};

