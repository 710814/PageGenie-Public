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
//
// ★★★ CORS 설정 (매우 중요!) ★★★
// 웹 앱 배포 시 반드시 다음 설정을 확인하세요:
// - 실행 사용자: "나" (Me)
// - 액세스 권한: "모든 사용자" (Anyone) ← 이 설정이 CORS를 허용합니다!
//
// "나만" 또는 "조직 내 사용자만"으로 설정하면 CORS 오류가 발생합니다.
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
      'muteHttpExceptions': true,
      'timeout': 300000 // 5분 타임아웃 (Gemini API 응답 대기)
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

    // GAS 웹 앱을 "모든 사용자"로 배포하면 CORS가 자동 처리됨
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
  // ★중요★: GAS 웹 앱을 "모든 사용자"로 배포하면 CORS가 자동 처리됨
  // setHeaders()는 GAS에서 지원되지 않으므로 사용하지 않음

  // 경로에 따라 라우팅
  var path = e.parameter.path || '';
  var action = e.parameter.action || '';

  if (path === 'gemini' || action === 'gemini') {
    return handleGeminiRequest(e);
  }

  // 설정 백업/복원 라우팅
  if (action === 'backup-settings') {
    return handleBackupSettings(e);
  }

  if (action === 'restore-settings') {
    return handleRestoreSettings(e);
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
    // 1. 데이터 파싱 및 검증
    if (!e.postData || !e.postData.contents) {
      throw new Error('요청 데이터가 없습니다.');
    }

    var data = JSON.parse(e.postData.contents);

    // 필수 필드 검증
    if (!data.sheetId) {
      throw new Error('Sheet ID가 제공되지 않았습니다. 애플리케이션 설정에서 Google Sheet ID를 입력하세요.');
    }

    // Sheet 접근 시도
    var sheet;
    try {
      var spreadsheet = SpreadsheetApp.openById(data.sheetId);
      sheet = spreadsheet.getActiveSheet();
    } catch (sheetError) {
      throw new Error('Google Sheet에 접근할 수 없습니다. Sheet ID를 확인하고 접근 권한이 있는지 확인하세요: ' + sheetError.toString());
    }

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
        // ★ 다중 슬롯 이미지 지원 (slotIndex 포함)
        if (data.images && data.images.length > 0) {
          data.images.forEach(function (imgItem) {
            try {
              if (imgItem.base64) {
                // 파일명 생성 (섹션 번호, 슬롯 번호, 제목 포함)
                var safeTitle = (imgItem.title || 'Section').replace(/[\/\\:*?"<>|]/g, '_').substring(0, 30);
                var slotSuffix = (imgItem.slotIndex !== undefined) ? '_slot' + (imgItem.slotIndex + 1) : '';
                var fileName = "Section_" + (imgItem.index + 1) + slotSuffix + "_" + safeTitle + ".png";

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
              data.sections.forEach(function (section, idx) {
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

    // GAS 웹 앱을 "모든 사용자"로 배포하면 CORS가 자동 처리됨
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      result: resultLog
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('❌ doPost 오류: ' + error.toString());
    Logger.log('오류 스택: ' + (error.stack || '스택 정보 없음'));

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
  var html = '<html><head><meta charset="UTF-8"><title>PageGenie API</title></head>';
  html += '<body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">';
  html += '<h1>✅ PageGenie API</h1>';
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
  html += '<hr style="margin: 30px 0;">';
  html += '<h3>권한 확인</h3>';
  html += '<p style="color: blue;">권한 테스트를 하려면 Apps Script 편집기에서 다음 함수를 실행하세요:</p>';
  html += '<ul style="text-align: left; display: inline-block;">';
  html += '<li><code>testPermissions()</code> - 모든 권한 테스트</li>';
  html += '<li><code>setupSheetPermission()</code> - Google Sheets 권한 설정 (간편 실행) ⭐</li>';
  html += '<li><code>testSheetsPermission("YOUR_SHEET_ID")</code> - Google Sheets 권한 테스트</li>';
  html += '<li><code>forceSheetsPermission("YOUR_SHEET_ID")</code> - Google Sheets 권한 강제 요청</li>';
  html += '<li><code>testDrivePermission()</code> - Google Drive 권한 테스트</li>';
  html += '</ul>';
  html += '<p style="color: gray; font-size: 12px; margin-top: 20px;">💡 Google Sheets 권한이 필요하면 <code>setupSheetPermission()</code> 함수를 실행하세요. (매개변수 입력 불필요)</p>';
  html += '</body></html>';

  return HtmlService.createHtmlOutput(html);
}

// ★참고★: GAS 웹 앱은 OPTIONS 요청을 자동으로 처리합니다.
// doOptions 함수는 GAS에서 호출되지 않습니다.
// CORS는 웹 앱을 "모든 사용자"로 배포하면 자동으로 처리됩니다.

/**
 * 권한 승인용 테스트 함수
 * 이 함수를 실행하면 외부 API 호출, Google Sheets, Google Drive 권한을 승인할 수 있습니다
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

    // 3. Google Sheets 권한 테스트
    try {
      // 스크립트 속성에서 Sheet ID 가져오기 (선택사항)
      var sheetId = props.getProperty('DEFAULT_SHEET_ID');
      if (sheetId) {
        Logger.log('📋 DEFAULT_SHEET_ID로 시트 접근 시도: ' + sheetId);
        var testSheet = SpreadsheetApp.openById(sheetId);
        var testSheetName = testSheet.getName();
        var testSheetUrl = testSheet.getUrl();
        Logger.log('✅ Google Sheets 권한 승인 완료! 시트 접근 가능: ' + testSheetName);
        Logger.log('✅ 시트 URL: ' + testSheetUrl);
      } else {
        Logger.log('⚠️ DEFAULT_SHEET_ID가 설정되지 않았습니다. (선택사항)');
        Logger.log('⚠️ Google Sheets 권한은 실제 사용 시 자동으로 요청됩니다.');
        Logger.log('💡 권한을 강제로 요청하려면: forceSheetsPermission("YOUR_SHEET_ID") 함수를 실행하세요.');
      }
    } catch (sheetError) {
      Logger.log('❌ Google Sheets 권한 오류: ' + sheetError.toString());
      Logger.log('⚠️ 이 오류가 발생하면 권한 승인 팝업이 나타나야 합니다.');
      Logger.log('⚠️ 팝업이 나타나지 않으면, forceSheetsPermission("YOUR_SHEET_ID") 함수를 실행하세요.');
      Logger.log('⚠️ 또는 실제 애플리케이션에서 사용할 때 권한이 요청될 수 있습니다.');
    }

    // 4. Google Drive 권한 테스트
    try {
      var testFolder = DriveApp.createFolder('권한_테스트_' + new Date().getTime());
      var folderUrl = testFolder.getUrl();
      Logger.log('✅ Google Drive 권한 승인 완료! 테스트 폴더: ' + folderUrl);
      // 테스트 폴더 삭제
      DriveApp.removeFolder(testFolder);
      Logger.log('✅ 테스트 폴더 삭제 완료');
    } catch (driveError) {
      Logger.log('❌ Google Drive 권한 오류: ' + driveError.toString());
      Logger.log('⚠️ 이 오류가 발생하면 권한 승인 팝업이 나타나야 합니다.');
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
 * Google Sheets 권한만 테스트하는 함수
 * 이 함수를 실행하면 Google Sheets 권한 승인 팝업이 나타날 수 있습니다
 * @param {string} sheetId - 테스트할 Sheet ID (선택사항, 없으면 스크립트 속성에서 가져옴)
 */
function testSheetsPermission(sheetId) {
  try {
    Logger.log('Google Sheets 권한 테스트 시작...');

    var props = PropertiesService.getScriptProperties();

    // 파라미터로 Sheet ID가 전달되지 않으면 스크립트 속성에서 가져오기
    if (!sheetId) {
      sheetId = props.getProperty('DEFAULT_SHEET_ID');
    }

    if (!sheetId) {
      Logger.log('⚠️ Sheet ID가 제공되지 않았습니다.');
      Logger.log('⚠️ 사용법: testSheetsPermission("YOUR_SHEET_ID")');
      Logger.log('⚠️ 또는 스크립트 속성에 DEFAULT_SHEET_ID를 추가하세요.');
      return 'Warning - Sheet ID가 필요합니다. testSheetsPermission("YOUR_SHEET_ID") 형식으로 호출하세요.';
    }

    Logger.log('📋 테스트할 Sheet ID: ' + sheetId);

    // 시트 접근 시도 (권한이 없으면 여기서 오류 발생 및 권한 승인 팝업 표시)
    try {
      var testSheet = SpreadsheetApp.openById(sheetId);
      var sheetName = testSheet.getName();
      var sheetUrl = testSheet.getUrl();

      Logger.log('✅ Google Sheets 권한 승인 완료!');
      Logger.log('✅ 시트 접근 성공: ' + sheetName);
      Logger.log('✅ 시트 URL: ' + sheetUrl);

      return 'Success - Google Sheets 권한이 정상적으로 승인되었습니다! 시트: ' + sheetName;
    } catch (sheetError) {
      Logger.log('❌ Google Sheets 접근 오류: ' + sheetError.toString());
      Logger.log('⚠️ 이 오류가 발생하면 권한 승인 팝업이 나타나야 합니다.');
      Logger.log('⚠️ 팝업이 나타나지 않으면 다음을 확인하세요:');
      Logger.log('   1. Sheet ID가 올바른지 확인');
      Logger.log('   2. 해당 Sheet에 대한 접근 권한이 있는지 확인');
      Logger.log('   3. Sheet가 삭제되지 않았는지 확인');
      throw new Error('Google Sheets 접근 실패: ' + sheetError.toString() + '\nSheet ID: ' + sheetId);
    }
  } catch (error) {
    Logger.log('❌ Google Sheets 권한 테스트 실패: ' + error.toString());
    throw error;
  }
}

/**
 * Google Sheets 권한을 강제로 요청하는 함수
 * Sheet ID를 받아서 즉시 접근을 시도하여 권한 승인 팝업을 표시합니다
 * @param {string} sheetId - 접근할 Sheet ID (선택사항, 없으면 스크립트 속성에서 가져옴)
 */
function forceSheetsPermission(sheetId) {
  var props = PropertiesService.getScriptProperties();

  // Sheet ID가 제공되지 않으면 스크립트 속성에서 가져오기
  if (!sheetId || sheetId.trim() === '') {
    sheetId = props.getProperty('DEFAULT_SHEET_ID');
  }

  if (!sheetId || sheetId.trim() === '') {
    throw new Error('Sheet ID가 필요합니다. forceSheetsPermission("YOUR_SHEET_ID") 형식으로 호출하거나, 스크립트 속성에 DEFAULT_SHEET_ID를 설정하세요.');
  }

  Logger.log('🔐 Google Sheets 권한 강제 요청 시작...');
  Logger.log('📋 Sheet ID: ' + sheetId);

  try {
    // 1. SpreadsheetApp.openById() 호출 - 권한이 없으면 여기서 팝업 표시
    var spreadsheet = SpreadsheetApp.openById(sheetId);
    var sheetName = spreadsheet.getName();
    var sheetUrl = spreadsheet.getUrl();

    Logger.log('✅ Google Sheets 권한 승인 완료!');
    Logger.log('✅ 시트 이름: ' + sheetName);
    Logger.log('✅ 시트 URL: ' + sheetUrl);

    // 2. 추가 권한 확인을 위해 시트 읽기/쓰기 테스트
    var activeSheet = spreadsheet.getActiveSheet();
    var lastRow = activeSheet.getLastRow();
    Logger.log('✅ 시트 읽기 성공 (마지막 행: ' + lastRow + ')');

    // 3. 쓰기 권한 테스트 (선택사항 - 주석 처리 가능)
    // var testRange = activeSheet.getRange(1, 1);
    // testRange.setValue('권한 테스트');
    // Logger.log('✅ 시트 쓰기 성공');

    return {
      success: true,
      message: 'Google Sheets 권한이 정상적으로 승인되었습니다!',
      sheetName: sheetName,
      sheetUrl: sheetUrl,
      lastRow: lastRow
    };
  } catch (error) {
    Logger.log('❌ Google Sheets 권한 요청 실패: ' + error.toString());
    Logger.log('⚠️ 권한 승인 팝업이 나타나지 않았다면:');
    Logger.log('   1. Sheet ID가 올바른지 확인: ' + sheetId);
    Logger.log('   2. 해당 Sheet에 대한 접근 권한이 있는지 확인');
    Logger.log('   3. Sheet가 공유되어 있는지 확인');
    Logger.log('   4. Sheet가 삭제되지 않았는지 확인');

    throw new Error('Google Sheets 권한 요청 실패: ' + error.toString());
  }
}

/**
 * Sheet ID를 스크립트 속성에 저장하는 함수
 * @param {string} sheetId - 저장할 Sheet ID
 */
function setDefaultSheetId(sheetId) {
  if (!sheetId || sheetId.trim() === '') {
    throw new Error('Sheet ID가 필요합니다. setDefaultSheetId("YOUR_SHEET_ID") 형식으로 호출하세요.');
  }

  var props = PropertiesService.getScriptProperties();
  props.setProperty('DEFAULT_SHEET_ID', sheetId.trim());

  Logger.log('✅ DEFAULT_SHEET_ID가 스크립트 속성에 저장되었습니다: ' + sheetId);

  // 저장 후 즉시 권한 요청 시도
  try {
    var result = forceSheetsPermission(sheetId);
    Logger.log('✅ Sheet ID 저장 및 권한 승인 완료!');
    return {
      success: true,
      message: 'Sheet ID가 저장되었고 권한이 승인되었습니다.',
      sheetId: sheetId,
      sheetInfo: result
    };
  } catch (error) {
    Logger.log('⚠️ Sheet ID는 저장되었지만 권한 승인에 실패했습니다: ' + error.toString());
    return {
      success: false,
      message: 'Sheet ID는 저장되었지만 권한 승인에 실패했습니다.',
      sheetId: sheetId,
      error: error.toString()
    };
  }
}

/**
 * Sheet ID 설정 및 권한 요청 (간편 실행용)
 * 이 함수를 실행하면 미리 설정된 Sheet ID로 권한을 요청합니다.
 * Sheet ID를 변경하려면 아래 코드의 sheetId 값을 수정하세요.
 */
function setupSheetPermission() {
  // 여기에 Sheet ID를 입력하세요
  // 예시: var sheetId = 'YOUR_SHEET_ID_HERE';
  var sheetId = 'YOUR_SHEET_ID_HERE';

  Logger.log('🚀 Sheet ID 설정 및 권한 요청 시작...');
  Logger.log('📋 Sheet ID: ' + sheetId);

  try {
    // 1. Sheet ID를 스크립트 속성에 저장
    var props = PropertiesService.getScriptProperties();
    props.setProperty('DEFAULT_SHEET_ID', sheetId);
    Logger.log('✅ Sheet ID가 스크립트 속성에 저장되었습니다.');

    // 2. 권한 요청
    var result = forceSheetsPermission(sheetId);

    Logger.log('✅✅✅ 모든 설정이 완료되었습니다! ✅✅✅');
    Logger.log('✅ Sheet ID: ' + sheetId);
    Logger.log('✅ 시트 이름: ' + result.sheetName);
    Logger.log('✅ 시트 URL: ' + result.sheetUrl);

    return {
      success: true,
      message: 'Sheet ID 설정 및 권한 승인이 완료되었습니다!',
      sheetId: sheetId,
      sheetInfo: result
    };
  } catch (error) {
    Logger.log('❌ 오류 발생: ' + error.toString());
    Logger.log('⚠️ 권한 승인 팝업이 나타나지 않았다면:');
    Logger.log('   1. Sheet ID가 올바른지 확인: ' + sheetId);
    Logger.log('   2. 해당 Sheet에 대한 접근 권한이 있는지 확인');
    Logger.log('   3. Sheet가 공유되어 있는지 확인');
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

// ----------------------------------------------------------------
// [설정 백업/복원 기능]
// 사용자 설정과 템플릿을 Google Drive에 자동 백업합니다.
// ----------------------------------------------------------------

/**
 * 설정 백업 저장
 * 사용자의 설정(GAS URL, Sheet ID, 템플릿)을 Google Drive에 저장
 */
function handleBackupSettings(e) {
  // ★중요★: GAS 웹 앱을 "모든 사용자"로 배포하면 CORS가 자동 처리됨
  // setHeaders()는 GAS ContentService에서 지원되지 않으므로 사용하지 않음

  try {
    Logger.log('📦 [Backup] 백업 요청 수신');

    if (!e.postData || !e.postData.contents) {
      Logger.log('❌ [Backup] 요청 데이터가 없습니다.');
      throw new Error('요청 데이터가 없습니다.');
    }

    Logger.log('📦 [Backup] 데이터 파싱 시작...');
    var data = JSON.parse(e.postData.contents);
    var settings = data.settings;

    if (!settings) {
      Logger.log('❌ [Backup] 백업할 설정 데이터가 없습니다.');
      throw new Error('백업할 설정 데이터가 없습니다.');
    }

    Logger.log('📦 [Backup] 설정 데이터 확인:', {
      hasGasUrl: !!settings.gasUrl,
      hasSheetId: !!settings.sheetId,
      templatesCount: settings.templates ? settings.templates.length : 0
    });

    // 숨김 폴더 찾기 또는 생성
    Logger.log('📁 [Backup] Drive 폴더 확인/생성 시작...');
    var folderName = '.pagegenie_backup';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;

    if (folders.hasNext()) {
      folder = folders.next();
      Logger.log('✅ [Backup] 기존 백업 폴더 사용: ' + folderName + ' (URL: ' + folder.getUrl() + ')');
    } else {
      try {
        folder = DriveApp.createFolder(folderName);
        Logger.log('✅ [Backup] 새 백업 폴더 생성: ' + folderName + ' (URL: ' + folder.getUrl() + ')');
      } catch (driveError) {
        Logger.log('❌ [Backup] 폴더 생성 실패: ' + driveError.toString());
        throw new Error('Google Drive 폴더 생성 실패: ' + driveError.toString() + '. Drive 접근 권한을 확인하세요.');
      }
    }

    // 기존 백업 파일 삭제 (최신 하나만 유지)
    Logger.log('🗑️ [Backup] 기존 백업 파일 삭제 중...');
    var existingFiles = folder.getFilesByName('settings.json');
    var deletedCount = 0;
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
      deletedCount++;
    }
    Logger.log('✅ [Backup] 기존 파일 삭제 완료: ' + deletedCount + '개');

    // 새 백업 파일 생성
    Logger.log('💾 [Backup] 새 백업 파일 생성 중...');
    var settingsJson = JSON.stringify(settings, null, 2);
    Logger.log('📊 [Backup] 백업 데이터 크기: ' + settingsJson.length + ' bytes');

    try {
      var blob = Utilities.newBlob(settingsJson, 'application/json', 'settings.json');
      var file = folder.createFile(blob);
      Logger.log('✅ [Backup] 설정 백업 완료: ' + file.getUrl() + ' (파일 ID: ' + file.getId() + ')');
    } catch (fileError) {
      Logger.log('❌ [Backup] 파일 생성 실패: ' + fileError.toString());
      throw new Error('백업 파일 생성 실패: ' + fileError.toString());
    }

    var successResponse = ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: '설정이 Google Drive에 백업되었습니다.',
      fileId: file.getId(),
      backupDate: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

    return successResponse;

  } catch (error) {
    Logger.log('❌ [Backup] 설정 백업 실패: ' + error.toString());
    Logger.log('❌ [Backup] 에러 스택: ' + (error.stack || '스택 정보 없음'));

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      errorType: error.name || 'UnknownError'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 설정 복원
 * Google Drive에서 백업된 설정을 읽어옴
 */
function handleRestoreSettings(e) {
  // ★중요★: GAS 웹 앱을 "모든 사용자"로 배포하면 CORS가 자동 처리됨

  try {
    var folderName = '.pagegenie_backup';
    var folders = DriveApp.getFoldersByName(folderName);

    if (!folders.hasNext()) {
      Logger.log('백업 폴더가 없습니다.');
      return ContentService.createTextOutput(JSON.stringify({
        status: 'not_found',
        message: '백업 파일이 없습니다. 먼저 백업을 생성해주세요.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var folder = folders.next();
    var files = folder.getFilesByName('settings.json');

    if (!files.hasNext()) {
      Logger.log('백업 파일이 없습니다.');
      return ContentService.createTextOutput(JSON.stringify({
        status: 'not_found',
        message: '백업 파일이 없습니다. 먼저 백업을 생성해주세요.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var file = files.next();
    var content = file.getBlob().getDataAsString();
    var settings = JSON.parse(content);

    Logger.log('✅ 설정 복원 성공: ' + file.getUrl());

    var successResponse = ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      settings: settings,
      message: '설정이 복원되었습니다.',
      backupDate: settings.backupDate || null
    })).setMimeType(ContentService.MimeType.JSON);

    return successResponse;

  } catch (error) {
    Logger.log('❌ 설정 복원 실패: ' + error.toString());

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}