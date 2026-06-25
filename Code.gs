// Google Apps Script — Create and Play Gaming Database
// Deploy this as a Web App: Execute as Me, Access: Anyone

const SHEET_NAME = 'Games';

function doGet(e) {
  try {
    const sheet = getSheet();
    const rows = sheet.getDataRange().getValues();

    if (rows.length <= 1) {
      return jsonResponse({ games: [] });
    }

    const headers = rows[0];
    const games = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });

    return jsonResponse({ games: games.reverse() }); // newest first
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'add') {
      return addGame(data.game);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function addGame(game) {
  const sheet = getSheet();
  const headers = ['id', 'title', 'description', 'emoji', 'gradient', 'author', 'content', 'createdAt'];

  // Write headers if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  const row = headers.map(h => game[h] || '');
  sheet.appendRow(row);

  return jsonResponse({ success: true, game });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function jsonResponse(data, code) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
