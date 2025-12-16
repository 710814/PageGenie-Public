// ----------------------------------------------------------------
// [필수] 이 코드를 Google Apps Script의 Code.gs에 덮어씌우세요.
// ★중요★: 코드를 붙여넣은 후 반드시 [배포] -> [새 배포(New Deployment)]를 해야 적용됩니다.
// ----------------------------------------------------------------

function doPost(e) {
  var resultLog = {
    folderCreated: false,
    imagesSaved: 0,
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
        // 폴더 생성
        var folder = DriveApp.createFolder(data.folderName);
        folderUrl = folder.getUrl();
        resultLog.folderCreated = true;

        // 이미지 배열 처리 (Frontend에서 'images' 배열로 보냄)
        if (data.images && data.images.length > 0) {
          data.images.forEach(function(imgItem) {
            try {
              if (imgItem.base64) {
                var decodedBlob = Utilities.newBlob(
                  Utilities.base64Decode(imgItem.base64), 
                  "image/png", 
                  "section_" + (imgItem.index + 1) + "_" + imgItem.title.substring(0, 10).replace(/\s/g, '_') + ".png"
                );
                
                var file = folder.createFile(decodedBlob);
                file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                
                imageUrlsLog.push("[Section " + (imgItem.index + 1) + "] " + file.getUrl());
                resultLog.imagesSaved++;
              }
            } catch (imgErr) {
              imageUrlsLog.push("[Section " + (imgItem.index + 1) + "] Error: " + imgErr.toString());
              resultLog.errors.push(imgErr.toString());
            }
          });
        } else {
          imageUrlsLog.push("No images received in payload.");
        }

      } catch (folderErr) {
        folderUrl = "Folder Error: " + folderErr.toString();
        resultLog.errors.push(folderErr.toString());
      }
    }

    // 3. 시트에 데이터 저장
    // 헤더 확인 및 생성
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "타임스탬프", "모드", "상품명", "카테고리", 
        "주요특징", "마케팅카피", "섹션수", 
        "섹션요약", "프롬프트", "드라이브_폴더_링크", "이미지_개별_링크"
      ]);
    }

    // 행 추가 (순서 중요)
    sheet.appendRow([
      data.timestamp || new Date(),
      data.mode,
      data.productName,
      data.category,
      data.features,
      data.marketingCopy,
      data.sectionCount,
      data.sections_summary, // Frontend에서 보낸 요약 텍스트
      data.image_prompts,    // Frontend에서 보낸 프롬프트 텍스트
      folderUrl,
      imageUrlsLog.join("\n")
    ]);

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

function doOptions(e) {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  return ContentService.createTextOutput(' ').setMimeType(ContentService.MimeType.TEXT).setHeaders(headers);
}