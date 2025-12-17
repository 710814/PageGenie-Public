// ----------------------------------------------------------------
// [필수] 이 코드를 Google Apps Script의 Code.gs에 덮어씌우세요.
// ★중요★: 코드를 붙여넣은 후 반드시 [배포] -> [새 배포(New Deployment)]를 해야 적용됩니다.
// 
// [보안 설정]
// 1. 스크립트 속성에 GEMINI_API_KEY를 추가하세요:
//    - 파일 > 프로젝트 설정 > 스크립트 속성
//    - 속성: GEMINI_API_KEY
//    - 값: (Google AI Studio에서 발급받은 API 키)
// 2. 배포 시 "실행 사용자"를 "나"로 설정하세요.
// ----------------------------------------------------------------

// Gemini API 엔드포인트
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Gemini API 호출 프록시 함수
 * 클라이언트에서 직접 API 키를 사용하지 않고 GAS를 통해 호출
 */
function callGeminiAPI(requestData) {
  try {
    // 스크립트 속성에서 API 키 가져오기
    var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY가 스크립트 속성에 설정되지 않았습니다. 파일 > 프로젝트 설정 > 스크립트 속성에서 설정하세요.');
    }

    var model = requestData.model || 'gemini-2.5-flash';
    var url = GEMINI_API_BASE + '/models/' + model + ':generateContent?key=' + apiKey;
    
    var options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify({
        contents: requestData.contents,
        generationConfig: requestData.config || {}
      }),
      'muteHttpExceptions': true
    };

    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error('Gemini API 오류: ' + responseCode + ' - ' + responseText);
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error('Gemini API 호출 실패:', error);
    throw error;
  }
}

/**
 * Gemini API 프록시 엔드포인트
 * 클라이언트에서 /gemini 경로로 요청 시 이 함수가 호출됨
 */
function handleGeminiRequest(e) {
  try {
    var requestData = JSON.parse(e.postData.contents);
    var result = callGeminiAPI(requestData);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: result
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  // 경로에 따라 라우팅
  var path = e.parameter.path || '';
  
  if (path === 'gemini' || e.parameter.action === 'gemini') {
    return handleGeminiRequest(e);
  }
  
    // 기존 시트 저장 로직
    var resultLog = {
      folderCreated: false,
      imagesSaved: 0,
      htmlSaved: false,
      htmlUrl: null,
      errors: []
    };

  try {
    // 1. 데이터 파싱
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.openById(data.sheetId).getActiveSheet();
    var folderUrl = "Not Saved";
    var imageUrlsLog = [];

    // 2. 드라이브 폴더 생성 및 이미지 저장
    if (data.saveImagesToDrive && data.folderName) {
      try {
        // 폴더 생성 (중복 방지: 같은 이름의 폴더가 있으면 기존 폴더 사용)
        var folders = DriveApp.getFoldersByName(data.folderName);
        var folder;
        if (folders.hasNext()) {
          folder = folders.next();
          Logger.log('기존 폴더 사용: ' + data.folderName);
        } else {
          folder = DriveApp.createFolder(data.folderName);
          Logger.log('새 폴더 생성: ' + data.folderName);
        }
        
        folderUrl = folder.getUrl();
        resultLog.folderCreated = true;

        // 이미지 URL 매핑 (이중 키 구조: byIndex와 byId)
        var imageUrlMap = {
          byIndex: {},
          byId: {}
        };

        // 이미지 배열 처리 (Frontend에서 'images' 배열로 보냄)
        if (data.images && data.images.length > 0) {
          data.images.forEach(function(imgItem) {
            try {
              if (imgItem.base64) {
                // 파일명 생성 (섹션 번호와 제목 포함)
                var safeTitle = (imgItem.title || 'Section').replace(/[\/\\:*?"<>|]/g, '_').substring(0, 30);
                var fileName = "Section_" + (imgItem.index + 1) + "_" + safeTitle + ".png";
                
                // Base64 디코딩 및 Blob 생성
                var decodedBlob = Utilities.newBlob(
                  Utilities.base64Decode(imgItem.base64), 
                  "image/png", 
                  fileName
                );
                
                // 파일 생성 및 공유 설정
                var file = folder.createFile(decodedBlob);
                file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                
                // 이미지 URL을 직접 사용 가능한 형태로 변환 (lh3 형식 - 더 안정적)
                var fileId = file.getId();
                var imageUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
                
                // 이미지 URL 매핑 저장 (이중 키 구조)
                imageUrlMap.byIndex[imgItem.index] = imageUrl;
                if (imgItem.id) {
                  imageUrlMap.byId[imgItem.id] = imageUrl;
                  Logger.log('이미지 URL 매핑 저장: index=' + imgItem.index + ', id=' + imgItem.id + ' -> ' + imageUrl);
                } else {
                  Logger.log('이미지 URL 매핑 저장: index=' + imgItem.index + ' (id 없음) -> ' + imageUrl);
                }
                
                // 이미지 URL 로그 형식: "섹션1: [링크]"
                imageUrlsLog.push("섹션" + (imgItem.index + 1) + ": " + imageUrl);
                resultLog.imagesSaved++;
                
                Logger.log('이미지 저장 완료: ' + fileName + ' -> ' + imageUrl);
              }
            } catch (imgErr) {
              var errorMsg = "섹션" + (imgItem.index + 1) + " 이미지 저장 실패: " + imgErr.toString();
              imageUrlsLog.push(errorMsg);
              resultLog.errors.push(errorMsg);
              Logger.log('이미지 저장 오류: ' + errorMsg);
            }
          });
        } else {
          imageUrlsLog.push("전송된 이미지가 없습니다.");
          Logger.log('이미지 데이터가 없습니다.');
        }

        // HTML 파일 저장 (이미지 URL 교체)
        if (data.htmlContent && data.htmlFileName) {
          try {
            // Base64 디코딩
            var htmlDecoded = Utilities.base64Decode(data.htmlContent);
            var htmlText = Utilities.newBlob(htmlDecoded, 'text/html').getDataAsString();
            
            // HTML에서 이미지 경로를 실제 드라이브 URL로 교체
            // section.id를 우선적으로 사용하여 정확한 매칭 보장
            var replacementCount = 0;
            if (data.sections && data.sections.length > 0) {
              data.sections.forEach(function(section, idx) {
                // section.id를 우선적으로 사용하여 이미지 URL 찾기
                var imageUrl = imageUrlMap.byId[section.id] || imageUrlMap.byIndex[idx];
                
                if (imageUrl) {
                  // 정규식 패턴 단순화: section.id 기반으로 우선 매칭
                  var pattern = new RegExp('images/section_' + section.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.png', 'gi');
                  
                  // 교체 전 확인
                  var beforeReplace = htmlText;
                  htmlText = htmlText.replace(pattern, imageUrl);
                  
                  // 교체가 이루어졌는지 확인
                  if (beforeReplace !== htmlText) {
                    replacementCount++;
                    Logger.log('HTML 이미지 경로 교체 성공: 섹션 id=' + section.id + ' (index=' + idx + ') -> ' + imageUrl);
                  } else {
                    // section.id로 매칭 실패 시 index 기반으로 시도
                    var indexPattern = new RegExp('images/section_' + idx + '\\.png', 'gi');
                    htmlText = htmlText.replace(indexPattern, imageUrl);
                    if (beforeReplace !== htmlText) {
                      replacementCount++;
                      Logger.log('HTML 이미지 경로 교체 성공 (index 기반): 섹션 index=' + idx + ' -> ' + imageUrl);
                    } else {
                      Logger.log('HTML 이미지 경로 교체 실패: 섹션 id=' + section.id + ', index=' + idx + ' (패턴 매칭 실패)');
                    }
                  }
                } else {
                  Logger.log('HTML 이미지 URL 없음: 섹션 id=' + section.id + ', index=' + idx);
                }
              });
            }
            
            Logger.log('HTML 이미지 경로 교체 완료: 총 ' + replacementCount + '개 교체됨');
            
            // 교체된 HTML을 Blob으로 변환
            var htmlBlob = Utilities.newBlob(htmlText, "text/html", data.htmlFileName);
            
            var htmlFile = folder.createFile(htmlBlob);
            htmlFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            
            var htmlUrl = htmlFile.getUrl();
            imageUrlsLog.push("HTML 파일: " + htmlUrl);
            resultLog.htmlSaved = true;
            resultLog.htmlUrl = htmlUrl;
            
            Logger.log('HTML 파일 저장 완료 (이미지 URL 교체됨): ' + data.htmlFileName + ' -> ' + htmlUrl);
          } catch (htmlErr) {
            var htmlErrorMsg = "HTML 파일 저장 실패: " + htmlErr.toString();
            imageUrlsLog.push(htmlErrorMsg);
            resultLog.errors.push(htmlErrorMsg);
            Logger.log('HTML 파일 저장 오류: ' + htmlErrorMsg);
          }
        }

      } catch (folderErr) {
        folderUrl = "폴더 생성 오류: " + folderErr.toString();
        resultLog.errors.push(folderErr.toString());
        Logger.log('폴더 생성 오류: ' + folderErr.toString());
        // 폴더 생성 실패해도 텍스트 데이터는 저장하도록 계속 진행
      }
    } else {
      Logger.log('이미지 저장 옵션이 비활성화되었거나 폴더명이 없습니다.');
      
      // 폴더가 없어도 HTML만 저장할 수 있도록 (폴더 생성)
      if (data.htmlContent && data.htmlFileName && data.folderName) {
        try {
          var folders = DriveApp.getFoldersByName(data.folderName);
          var folder;
          if (folders.hasNext()) {
            folder = folders.next();
          } else {
            folder = DriveApp.createFolder(data.folderName);
          }
          
          var htmlDecoded = Utilities.newBlob(
            Utilities.base64Decode(data.htmlContent),
            "text/html",
            data.htmlFileName
          );
          
          var htmlFile = folder.createFile(htmlDecoded);
          htmlFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          folderUrl = folder.getUrl();
          imageUrlsLog.push("HTML 파일: " + htmlFile.getUrl());
          Logger.log('HTML 파일 저장 완료 (폴더만 생성): ' + htmlFile.getUrl());
        } catch (htmlErr) {
          Logger.log('HTML 파일 저장 오류: ' + htmlErr.toString());
        }
      }
    }

    // 3. 시트에 데이터 저장
    // 헤더 확인 및 생성
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "타임스탬프", "모드", "상품명", "카테고리", 
        "주요특징", "마케팅카피", "섹션수", 
        "섹션요약", "프롬프트", "드라이브_폴더_링크", "이미지_개별_링크", "HTML_파일_링크"
      ]);
      
      // 헤더 행 스타일링 (선택사항)
      var headerRange = sheet.getRange(1, 1, 1, 12);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f0f0f0');
    }

    // 이미지 링크 포맷팅 (각 섹션별로 줄바꿈)
    var imageLinksText = imageUrlsLog.length > 0 
      ? imageUrlsLog.join("\n") 
      : "저장된 이미지 없음";
    
    // HTML 파일 링크
    var htmlLink = resultLog.htmlUrl || "저장 안됨";

    // 행 추가 (순서 중요)
    sheet.appendRow([
      data.timestamp || new Date().toLocaleString('ko-KR'),
      data.mode || 'N/A',
      data.productName || 'N/A',
      data.category || 'N/A',
      data.features || 'N/A',
      data.marketingCopy || 'N/A',
      data.sectionCount || 0,
      data.sections_summary || 'N/A', // Frontend에서 보낸 요약 텍스트
      data.image_prompts || 'N/A',    // Frontend에서 보낸 프롬프트 텍스트
      folderUrl || "저장 안됨",
      imageLinksText,
      htmlLink
    ]);
    
    Logger.log('시트에 데이터 저장 완료: ' + data.productName);

    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      result: resultLog 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET 요청 처리 (웹 앱 접속 시 표시)
 */
function doGet(e) {
  var html = '<html><head><meta charset="UTF-8"><title>Product Pagebuilder API</title></head>';
  html += '<body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">';
  html += '<h1>✅ Product Pagebuilder API</h1>';
  html += '<p style="color: green; font-size: 18px;">웹 앱이 정상적으로 배포되었습니다!</p>';
  html += '<hr style="margin: 30px 0;">';
  html += '<h3>설정 확인</h3>';
  
  // API 키 설정 확인
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (apiKey) {
    html += '<p style="color: green;">✅ GEMINI_API_KEY가 설정되어 있습니다.</p>';
  } else {
    html += '<p style="color: red;">❌ GEMINI_API_KEY가 설정되지 않았습니다.</p>';
    html += '<p>파일 > 프로젝트 설정 > 스크립트 속성에서 GEMINI_API_KEY를 추가하세요.</p>';
  }
  
  html += '<hr style="margin: 30px 0;">';
  html += '<p style="color: gray;">이 URL을 애플리케이션 설정의 "GAS Web App URL" 필드에 입력하세요.</p>';
  html += '</body></html>';
  
  return HtmlService.createHtmlOutput(html);
}

function doOptions(e) {
  // 보안 강화: 특정 도메인만 허용하도록 변경 권장
  // 실제 배포 시에는 '*' 대신 특정 도메인을 지정하세요
  var allowedOrigins = '*'; // 예: 'https://yourdomain.com'
  
  var headers = {
    'Access-Control-Allow-Origin': allowedOrigins,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  return ContentService.createTextOutput(' ').setMimeType(ContentService.MimeType.TEXT).setHeaders(headers);
}

/**
 * 권한 승인용 테스트 함수
 * 이 함수를 실행하면 외부 API 호출 및 Google Drive 권한을 승인할 수 있습니다
 */
function testPermissions() {
  try {
    // 1. 외부 API 호출 권한 테스트
    var response = UrlFetchApp.fetch('https://www.google.com');
    Logger.log('✅ 외부 API 호출 권한 승인 완료! 응답 코드: ' + response.getResponseCode());
    
    // 2. 스크립트 속성 접근 권한 테스트
    var props = PropertiesService.getScriptProperties();
    var apiKey = props.getProperty('GEMINI_API_KEY');
    if (apiKey) {
      Logger.log('✅ 스크립트 속성 접근 가능 (GEMINI_API_KEY 설정됨)');
    } else {
      Logger.log('⚠️ GEMINI_API_KEY가 설정되지 않았습니다.');
    }
    
    // 3. Google Drive 권한 테스트
    try {
      var testFolder = DriveApp.createFolder('권한_테스트_' + new Date().getTime());
      var folderUrl = testFolder.getUrl();
      Logger.log('✅ Google Drive 권한 승인 완료! 테스트 폴더: ' + folderUrl);
      // 테스트 폴더 삭제
      DriveApp.removeFolder(testFolder);
      Logger.log('✅ 테스트 폴더 삭제 완료');
    } catch (driveError) {
      Logger.log('❌ Google Drive 권한 오류: ' + driveError.toString());
      throw driveError;
    }
    
    Logger.log('✅ 모든 권한이 정상적으로 승인되었습니다!');
    return 'Success';
  } catch (error) {
    Logger.log('❌ 오류 발생: ' + error.toString());
    throw error;
  }
}

/**
 * Google Drive 권한만 테스트하는 함수
 * 이 함수를 실행하면 Google Drive 권한 승인 팝업이 나타날 수 있습니다
 */
function testDrivePermission() {
  try {
    Logger.log('Google Drive 권한 테스트 시작...');
    
    // 폴더 생성 시도 (권한이 없으면 여기서 오류 발생)
    var testFolderName = 'Drive_권한_테스트_' + new Date().getTime();
    var testFolder = DriveApp.createFolder(testFolderName);
    var folderUrl = testFolder.getUrl();
    
    Logger.log('✅ Google Drive 권한 승인 완료!');
    Logger.log('✅ 테스트 폴더 생성 성공: ' + folderUrl);
    
    // 테스트 폴더 삭제
    DriveApp.removeFolder(testFolder);
    Logger.log('✅ 테스트 폴더 삭제 완료');
    
    return 'Success - Google Drive 권한이 정상적으로 승인되었습니다!';
  } catch (error) {
    Logger.log('❌ Google Drive 권한 오류: ' + error.toString());
    Logger.log('⚠️ 이 오류가 발생하면 권한 승인 팝업이 나타나야 합니다.');
    Logger.log('⚠️ 팝업이 나타나지 않으면, 실제 애플리케이션에서 사용할 때 권한이 요청될 수 있습니다.');
    throw error;
  }
}