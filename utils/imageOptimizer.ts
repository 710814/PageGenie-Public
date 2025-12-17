/**
 * 이미지 최적화 유틸리티
 * 업로드 전 이미지 압축 및 리사이징으로 메모리 사용량 최적화
 */

export interface ImageOptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 ~ 1.0
  maxSizeMB?: number; // 최대 파일 크기 (MB)
}

const DEFAULT_OPTIONS: Required<ImageOptimizeOptions> = {
  maxWidth: 2000,
  maxHeight: 2000,
  quality: 0.85,
  maxSizeMB: 5,
};

/**
 * 이미지를 압축하고 최적화
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizeOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Canvas를 사용하여 이미지 리사이징 및 압축
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 비율 유지하면서 리사이징
          if (width > opts.maxWidth || height > opts.maxHeight) {
            const ratio = Math.min(
              opts.maxWidth / width,
              opts.maxHeight / height
            );
            width = width * ratio;
            height = height * ratio;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context를 가져올 수 없습니다.'));
            return;
          }

          // 고품질 리샘플링
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // 이미지 그리기
          ctx.drawImage(img, 0, 0, width, height);

          // Canvas를 Blob으로 변환 (압축)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('이미지 압축에 실패했습니다.'));
                return;
              }

              // 최대 크기 체크 및 추가 압축
              const maxSizeBytes = opts.maxSizeMB * 1024 * 1024;
              
              if (blob.size > maxSizeBytes) {
                // 품질을 낮춰서 재압축
                const reducedQuality = Math.max(0.3, opts.quality * 0.7);
                canvas.toBlob(
                  (reducedBlob) => {
                    if (!reducedBlob) {
                      resolve(new File([blob], file.name, { type: blob.type }));
                      return;
                    }
                    
                    const optimizedFile = new File(
                      [reducedBlob],
                      file.name,
                      { type: blob.type }
                    );
                    resolve(optimizedFile);
                  },
                  blob.type,
                  reducedQuality
                );
              } else {
                const optimizedFile = new File(
                  [blob],
                  file.name,
                  { type: blob.type }
                );
                resolve(optimizedFile);
              }
            },
            file.type || 'image/jpeg',
            opts.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('이미지를 로드할 수 없습니다.'));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('파일을 읽을 수 없습니다.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일 읽기 중 오류가 발생했습니다.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 여러 이미지를 일괄 최적화
 */
export async function optimizeImages(
  files: File[],
  options?: ImageOptimizeOptions
): Promise<File[]> {
  // 병렬 처리로 성능 향상 (최대 3개씩)
  const batchSize = 3;
  const results: File[] = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const optimizedBatch = await Promise.all(
      batch.map(file => optimizeImage(file, options))
    );
    results.push(...optimizedBatch);
  }

  return results;
}

/**
 * 이미지 파일 크기 확인 (MB)
 */
export function getFileSizeMB(file: File): number {
  return file.size / (1024 * 1024);
}

/**
 * 이미지가 최적화가 필요한지 확인
 */
export function needsOptimization(
  file: File,
  options: ImageOptimizeOptions = {}
): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sizeMB = getFileSizeMB(file);
  
  return sizeMB > opts.maxSizeMB;
}

