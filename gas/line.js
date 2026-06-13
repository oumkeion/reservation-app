// LINE Messaging API 呼び出し（UrlFetchApp）
'use strict'

function lineToken_() {
  var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN')
  if (!token) throw new Error('Script Properties に LINE_CHANNEL_ACCESS_TOKEN が未設定です')
  return token
}

function linePost_(endpoint, payload) {
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/' + endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + lineToken_() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  })
  var code = res.getResponseCode()
  if (code >= 300) {
    console.error('LINE API ' + endpoint + ' ' + code + ': ' + res.getContentText())
  }
}

/** replyToken でテキスト返信 */
function lineReply(replyToken, text) {
  linePost_('message/reply', {
    replyToken: replyToken,
    messages: [{ type: 'text', text: text }],
  })
}

/** 任意の宛先（グループ/ユーザー）へプッシュ送信（無料枠 月200通を消費） */
function linePush(to, text) {
  linePost_('message/push', {
    to: to,
    messages: [{ type: 'text', text: text }],
  })
}
