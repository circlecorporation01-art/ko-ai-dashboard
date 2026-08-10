/**
 * KO製品 体感レビュー ― フォーム＋台帳 一括生成スクリプト（Google Apps Script）
 *
 * これを1回実行するだけで、実行したGoogleアカウントのマイドライブに
 *   フォルダ「テスト用商品レビュー_大阪北新地店」を作り、その中に
 *     ① Googleフォーム（レビュー入力フォーム）
 *     ② 回答が自動で入る台帳スプレッドシート（フォーム回答先）
 *     ③ 説明ドキュメント（使い方）
 *   を作成し、フォーム送信時にレビュー記事文を台帳へ自動記載します。
 *
 * ■ 使い方
 *   1. https://script.google.com/ を info@ のアカウントで開く
 *   2. 新しいプロジェクト → このコードを全部貼り付け
 *   3. 関数「setup」を実行 → 初回のみ権限承認
 *   4. 実行ログに出るフォームURL・台帳URLをスタッフに共有
 *
 * ※ info@ のDriveに入れたい場合は必ず info@ でログインして実行してください。
 */

var STORE_NAME   = '大阪北新地店';
var FOLDER_NAME  = 'テスト用商品レビュー_' + STORE_NAME;
var FORM_TITLE   = 'KO製品 体感レビュー（' + STORE_NAME + '）';
var LEDGER_TITLE = 'KO製品_体感レビュー台帳_' + STORE_NAME;
var DOC_TITLE    = '【説明】KO製品 体感レビューの進め方_' + STORE_NAME;

function setup() {
  // 0) 保存用フォルダ（既にあれば再利用）
  var folder = getOrCreateFolder_(FOLDER_NAME);

  // 1) フォーム作成
  var form = FormApp.create(FORM_TITLE);
  form.setDescription(
    'テストした商品1つにつき1回、送信してください。回答は自動で台帳スプレッドシートに記録されます。\n' +
    '※効果効能の断定・医療的表現はNG（あくまで個人の体感・感想として記入）。'
  );
  form.setCollectEmail(true);
  form.setLimitOneResponsePerUser(false);
  form.setShowLinkToRespondAgain(true);

  // --- 基本情報 ---
  form.addTextItem().setTitle('記入者（氏名）').setRequired(true);
  form.addTextItem().setTitle('店舗').setHelpText('例：' + STORE_NAME).setRequired(true);
  form.addTextItem().setTitle('商品名 / 型番').setRequired(true);
  form.addMultipleChoiceItem().setTitle('種別')
      .setChoiceValues(['リキッド', 'グミ', 'オイル', 'ドリンク', 'その他']).setRequired(true);
  form.addTextItem().setTitle('成分・含有量').setHelpText('例：●●●● / 1本あたり ●●mg');
  form.addTextItem().setTitle('使用量・方法').setHelpText('例：3パフ／1個 ・ 食後or空腹 ・ 単体使用').setRequired(true);

  // --- 体感 ---
  form.addTextItem().setTitle('① 体感までの時間（分）').setHelpText('使ってから何分で効き始めたか').setRequired(true);
  form.addTextItem().setTitle('② ピーク / 持続').setHelpText('例：20分後にピーク / 約2時間持続');
  form.addScaleItem().setTitle('③ 体感の強さ').setBounds(1, 5)
      .setLabels('ほぼ無し', 'かなり強い').setRequired(true);
  form.addCheckboxItem().setTitle('④ 体感の質（複数選択可）')
      .setChoiceValues(['リラックス', '眠気・入眠', '多幸感・上がる', '集中・クリア', '落ち着き', 'ボディ寄り(体)', 'ヘッド寄り(頭)', 'その他']);
  form.addTextItem().setTitle('④-補足（体感のひとこと）').setHelpText('例：肩の力が抜けてゆるく眠くなる感じ');

  // --- 味・使用感 ---
  form.addScaleItem().setTitle('⑤ 味・フレーバー').setBounds(1, 5)
      .setLabels('いまいち', 'とても良い').setRequired(true);
  form.addTextItem().setTitle('⑤-コメント（味）').setHelpText('例：甘さ控えめで自然、後味スッキリ');
  form.addTextItem().setTitle('⑥ 吸い心地・口当たり').setHelpText('例：むせずなめらか／飲みやすい');

  // --- おすすめ ---
  form.addCheckboxItem().setTitle('⑦ おすすめのシーン（複数選択可）')
      .setChoiceValues(['就寝前', '仕事終わり', '休日の昼', '気分転換', 'リラックスしたい時', '集中したい時']);
  form.addTextItem().setTitle('⑦-具体的に').setHelpText('例：残業後の切り替え／寝る30分前');
  form.addTextItem().setTitle('⑧ こんな人におすすめ');
  form.addParagraphTextItem().setTitle('⑨ 気になった点（正直に）');

  // --- 総合 ---
  form.addScaleItem().setTitle('⑩ 総合評価').setBounds(1, 5).setLabels('低い', '高い').setRequired(true);
  form.addMultipleChoiceItem().setTitle('リピートしたい？')
      .setChoiceValues(['する', 'しない', '気分で']);
  form.addParagraphTextItem().setTitle('📣 SNS用ひとこと（80〜140字・そのまま投稿できる文）')
      .setHelpText('例：KOの●●、8分くらいでじんわり来て肩の力が抜ける感じ。味も甘すぎず◎。寝る前の一本にちょうどいい体感でした🌙 #KO #Knockout');
  form.addTextItem().setTitle('📷 写真URL（任意）').setHelpText('商品／使用シーン写真をDrive等に置いてURLを貼る');

  // 2) 台帳スプレッドシートを回答先に設定（＝回答が自動で台帳に入る）
  var ss = SpreadsheetApp.create(LEDGER_TITLE);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // 3) 送信時に「レビュー記事文」を自動生成して台帳に追記するトリガー
  ScriptApp.newTrigger('onFormSubmit_')
    .forForm(form).onFormSubmit().create();

  // 4) 説明ドキュメント
  var doc = DocumentApp.create(DOC_TITLE);
  writeGuide_(doc.getBody(), form.getPublishedUrl(), ss.getUrl());

  // 5) 3ファイルをフォルダへ移動
  moveToFolder_(form.getId(), folder);
  moveToFolder_(ss.getId(),  folder);
  moveToFolder_(doc.getId(), folder);

  // 6) 結果をログ出力
  Logger.log('✅ 作成完了（フォルダ：%s）', FOLDER_NAME);
  Logger.log('■ フォーム（スタッフ入力用）: %s', form.getPublishedUrl());
  Logger.log('■ 台帳スプレッドシート: %s', ss.getUrl());
  Logger.log('■ 説明ドキュメント: %s', doc.getUrl());
}

/**
 * フォーム送信時：回答から整形済みの「レビュー記事文」を作り、
 * 回答シートの末尾列「レビュー記事（自動生成）」へ書き込む。
 */
function onFormSubmit_(e) {
  var ss = SpreadsheetApp.openById(e.source.getDestinationId());
  var sh = ss.getSheets()[0];
  var res = e.response.getItemResponses();
  var m = {};
  res.forEach(function (r) { m[r.getItem().getTitle()] = r.getResponse(); });

  var join = function (v) { return Array.isArray(v) ? v.join('・') : (v || ''); };
  var article =
    '【' + join(m['商品名 / 型番']) + '】(' + join(m['種別']) + ')\n' +
    '体感：約' + join(m['① 体感までの時間（分）']) + '分で開始／強さ★' + join(m['③ 体感の強さ']) + '/5\n' +
    '質：' + join(m['④ 体感の質（複数選択可）']) + '（' + join(m['④-補足（体感のひとこと）']) + '）\n' +
    '味：★' + join(m['⑤ 味・フレーバー']) + '/5 ' + join(m['⑤-コメント（味）']) + '\n' +
    'おすすめ：' + join(m['⑦ おすすめのシーン（複数選択可）']) + ' ' + join(m['⑦-具体的に']) + '\n' +
    '総合★' + join(m['⑩ 総合評価']) + '/5（リピート：' + join(m['リピートしたい？']) + '）\n' +
    'SNS：' + join(m['📣 SNS用ひとこと（80〜140字・そのまま投稿できる文）']);

  var lastCol = sh.getLastColumn();
  var lastRow = sh.getLastRow();
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var colTitle = 'レビュー記事（自動生成）';
  var idx = header.indexOf(colTitle);
  if (idx === -1) {                       // 見出しが無ければ末尾に追加
    idx = lastCol;
    sh.getRange(1, idx + 1).setValue(colTitle).setFontWeight('bold');
  }
  sh.getRange(lastRow, idx + 1).setValue(article);
}

/* ---------- ユーティリティ ---------- */
function getOrCreateFolder_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
function moveToFolder_(fileId, folder) {
  var file = DriveApp.getFileById(fileId);
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);   // マイドライブ直下からは外す
}
function writeGuide_(body, formUrl, ssUrl) {
  body.appendParagraph('KO製品 体感レビューの進め方（' + STORE_NAME + '）')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('目的：スタッフが自社製品を体感し、その感想を接客・SNS・商品ページの宣伝に使えるよう一次情報を残す。');
  body.appendParagraph('手順').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  var steps = [
    'テストする商品を1つ使う（量は通常の使い方の範囲で）。',
    'エアレジで在庫を−1（店舗で処理）。',
    '下記フォームから、商品ごとにレビューを送信する（1商品＝1回）。',
    '送信内容は自動で台帳スプレッドシートに記録され、レビュー記事文も自動生成される。',
  ];
  steps.forEach(function (s) { body.appendListItem(s).setGlyphType(DocumentApp.GlyphType.NUMBER); });
  body.appendParagraph('リンク').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('入力フォーム：' + formUrl);
  body.appendParagraph('台帳スプレッドシート：' + ssUrl);
  body.appendParagraph('注意').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('効果効能の断定・医療的表現はNG。あくまで個人の体感・感想として記入する。運転／危険作業がある人は勤務外に、体調不良時は行わない。');
  body.appendParagraph('締切：2026-08-17（日）');
}
