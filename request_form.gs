// 業務要望フォーム＆日報メモの受け口（Google Apps Script ウェブアプリ）
// サイトのフォームから送信された内容をスプレッドシートに追記する。
// ・type 未指定／request … 「AI業務要望メモ」シート（従来どおり）
// ・type=daily           … 「日報メモ」シート（本人が当日やった作業を記録）
//   → 夜間統合レポート(knockout-nightly-consolidated)が「日報メモ」の当日分を読み、
//     日報の冒頭【0. 本日の実務（本人記入）】として必ず反映する。

function doPost(e) {
  var SHEET_ID = '1kiPPAwUOeTSc3wIc9tMADK6VV6aZqguzWygPgfi4S6U';
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var p = (e && e.parameter) ? e.parameter : {};
  var d = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  var day = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

  if (p.type === 'daily') {
    // ── 日報メモ（本人の当日作業） ──
    var name = '日報メモ';
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.appendRow(['日付', '記入時刻', '記入者', '本日やった作業']);
    }
    sh.appendRow([day, d, p.author || '本人', p.work || '']);
    return HtmlService.createHtmlOutput(
      '<meta charset="utf-8"><div style="font-family:sans-serif;padding:30px;text-align:center">' +
      '✅ 日報メモを記録しました。今夜の日報の冒頭【本日の実務】に反映されます。</div>');
  }

  // ── 従来の業務要望メモ ──
  var sh0 = ss.getSheets()[0];
  sh0.appendRow([d, p.target || '', p.request || '', '未反映']);
  return HtmlService.createHtmlOutput(
    '<meta charset="utf-8"><div style="font-family:sans-serif;padding:30px;text-align:center">' +
    '✅ 送信しました。ありがとうございます。<br>反映までしばらくお待ちください。</div>');
}

function doGet() {
  return HtmlService.createHtmlOutput('OK');
}
