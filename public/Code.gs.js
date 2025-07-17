/** Code.gs */

// スクリプトプロパティから設定を読み込む
const SCRIPT_PROPS = PropertiesService.getScriptProperties();
const PROJECT_ID = SCRIPT_PROPS.getProperty('GCP_PROJECT_ID');
const PROCESSOR_ID = SCRIPT_PROPS.getProperty('PROCESSOR_ID');
// サービスアカウントキーは直接コードに書かず、プロパティから読み込む
const SERVICE_ACCOUNT_KEY = JSON.parse(SCRIPT_PROPS.getProperty('SERVICE_ACCOUNT_KEY'));

/**
 * HTTP POST リクエストを処理するエントリーポイント。
 * フロントエンドからのfetch API呼び出しを受け付けます。
 * @param {GoogleAppsScript.Events.DoPost} e POSTリクエストのイベントオブジェクト
 * @returns {GoogleAppsScript.Content.TextOutput} JSON形式のレスポンス
 */
function doPost(e) {
  let responseData;
  try {
    // FormDataで送信された 'data' パラメータ（JSON文字列）を取得
    const rawData = e.parameter.data;
    if (!rawData) {
      throw new Error("No data found in request parameter.");
    }

    // JSON文字列をパースして、Base64データとファイル名を取得
    const { pdfFile, fileName } = JSON.parse(rawData);
    if (!pdfFile) {
      throw new Error("PDF file data (pdfFile) is missing in the payload.");
    }

    // Base64文字列をBlobに変換
    const pdfBlob = Utilities.newBlob(Utilities.base64Decode(pdfFile), MimeType.PDF, fileName || 'uploaded.pdf');

    // PDF Blobを処理するコアロジックを呼び出す
    responseData = processPdfBlob(pdfBlob);

  } catch (error) {
    console.error("Error in doPost:", error);
    responseData = { error: `Server error: ${error.message}` };
  }

  // HtmlOutput を使ってCORSヘッダーを設定し、JSONレスポンスを返す
  return HtmlService.createHtmlOutput(JSON.stringify(responseData))
    .setMimeType(HtmlService.MimeType.JSON)
    .addHeader("Access-Control-Allow-Origin", "http://localhost:8000") // ローカル開発環境を許可
    .addHeader("Access-Control-Allow-Methods", "POST") // FormDataはPOSTで送信される
    .addHeader("Access-Control-Allow-Headers", "Content-Type"); // 念のため許可
}

/**
 * PDF Blobを処理し、Document AIを呼び出してスケジュールを抽出するコアロジック。
 * @param {GoogleAppsScript.Base.Blob} pdfBlob Blob形式のPDFファイル
 * @returns {Array<{ day: number, start: string, end: string }>} FullCalendarイベント形式の配列
 */
function processPdfBlob(pdfBlob) {

  const endpoint = `https://documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/us/processors/${PROCESSOR_ID}:process`;
  const options = {
    method: 'post',
    contentType: pdfBlob.getContentType(), // BlobからMIMEタイプを取得
    payload: pdfBlob.getBytes(), // 正しい変数 pdfBlob を使用
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true, // エラー時もレスポンスボディを取得できるようにする
  };

  try {
    const resp = UrlFetchApp.fetch(endpoint, options);
    const responseData = JSON.parse(resp.getContentText());

    // Document AI からのエラーレスポンスをチェック
    if (responseData.error) {
      console.error("Document AI API Error:", responseData.error);
      throw new Error(`Document AI API Error: ${responseData.error.message || JSON.stringify(responseData.error)}`);
    }

    const text = responseData.document.text; // Document AIから抽出されたテキスト
    
    // 正規表現ベースの抽出関数でスケジュールを解析
    const extractedSchedule = extractScheduleFromText(text);
    
    // FullCalendarが解釈できる形式に変換して返す
    const events = [];
    extractedSchedule.forEach(item => {
      item.times.forEach(([start, end]) => {
        events.push({
          day: item.day,
          start: start,
          end: end
        });
      });
    });
    return events;

  } catch (error) {
    console.error("Error in parsePdf:", error);
    // クライアント側にエラーメッセージを返す（doPostで捕捉される）
    throw new Error(`PDF解析中にエラーが発生しました: ${error.message}`);
  }
}

/**
 * PDFから抽出したテキスト全体から、音出し禁止時間帯だけを取り出す
 * @param {string} text PDFから抽出した生テキスト
 * @returns {Array<{ day: number, times: [string,string][] }>}
 */
function extractScheduleFromText(text) {
  text = text.replace(/：/g, ':').replace(/～/g, '~'); // 全角コロン／チルダを半角に統一
  const blocks = text.split(/(?=\b\d{1,2}\s+[日月火水木金土]\b)/g) // 日付の前で分割
                     .filter(l => /^\d{1,2}\s+[日月火水木金土]/.test(l.trim())); // 日付行のみフィルタ

  const schedule = [];
  blocks.forEach(b => {
    const m = b.match(/^(\d{1,2})\s+[日月火水木金土]/);
    if (!m) return; // 日付行でなければスキップ
    const day = +m[1];

    // 時間帯を表す「hh:mm~hh:mm、hh:mm~hh:mm…」の部分を抜く
    const tm = b.match(/(\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2}(?:\s*[、,]\s*\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2})*)/);
    if (!tm) {
      // 時間指定がなければ、この日はイベントなしとしてスキップ
      return;
    } else {
      // 複数時間帯を分解し、各レンジを start~end にマッピング
      const rawRanges = tm[1].split(/[、,]/);
      const times = rawRanges.map(r => {
        let [s, e] = r.split('~').map(s => s.trim());
        // 必要なら 0埋め: "7:00"→"07:00"
        s = s.replace(/^(\d):/, '0$1:');
        e = e.replace(/^(\d):/, '0$1:');
        return [s, e];
      });
      schedule.push({ day, times: times });
    }
  });
  return schedule;
}