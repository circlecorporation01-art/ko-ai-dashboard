// 業務要望フォームの受け口（Google Apps Script ウェブアプリ）
// サイトのフォームから送信された要望を「AI業務要望メモ」シートに追記する。
// 公開ダッシュボードの全閲覧者が書き込める入口になる。

function doPost(e) {
  var SHEET_ID = '1kiPPAwUOeTSc3wIc9tMADK6VV6aZqguzWygPgfi4S6U';
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  var p = (e && e.parameter) ? e.parameter : {};
  var d = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  sh.appendRow([d, p.target || '', p.request || '', '未反映']);
  return HtmlService.createHtmlOutput(
    '<meta charset="utf-8"><div style="font-family:sans-serif;padding:30px;text-align:center">' +
    '✅ 送信しました。ありがとうございます。<br>反映までしばらくお待ちください。</div>');
}

function doGet() {
  return HtmlService.createHtmlOutput('OK');
}
