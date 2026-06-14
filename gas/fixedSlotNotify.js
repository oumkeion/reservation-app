// 固定枠 変更・キャンセル申請のメール通知（GAS・時間主導トリガー）
// 新しい pending 申請を検知して handai.mail.okuruyou@gmail.com に通知する。
// notifiedAt が無い pending 申請をメール後にマークして二重送信を防ぐ。
'use strict'

var ADMIN_NOTIFY_EMAIL = 'handai.mail.okuruyou@gmail.com'

function notifyFixedSlotRequests() {
  var docs = fsListAll('fixedSlotRequests')
  var targets = docs.filter(function (d) {
    return d.status === 'pending' && !d.notifiedAt
  })
  if (targets.length === 0) return

  targets.forEach(function (req) {
    var kind = req.kind === 'cancel' ? 'キャンセル' : '変更'
    var lines = [
      '軽音部 部室予約サイトに固定枠の' + kind + '申請が届きました。',
      '',
      '申請者: ' + (req.requester || '不明'),
      '対象固定枠: ' + (req.fixedTitle || '') + '（' + (req.fixedStart || '') + '〜' + (req.fixedEnd || '') + '）',
    ]
    if (req.kind === 'change') {
      lines.push('変更後の希望: ' + (req.desiredStart || '') + '〜' + (req.desiredEnd || ''))
    }
    if (req.note) lines.push('備考: ' + req.note)
    lines.push('')
    lines.push('管理者権限でサイトにログインし、「固定枠申請」タブで承認/拒否してください。')

    try {
      MailApp.sendEmail(ADMIN_NOTIFY_EMAIL, '【軽音部予約】固定枠' + kind + '申請', lines.join('\n'))
      // 二重送信防止のマーク（fsSetDoc はドキュメントを上書きするため既存フィールドを保持して更新）
      fsUpdateField('fixedSlotRequests/' + req.id, 'notifiedAt', new Date().toISOString())
    } catch (e) {
      console.error('申請通知メールの送信に失敗: ' + e)
    }
  })
}

// 既存ドキュメントに1フィールドだけ追加更新する（Firestore REST の updateMask 利用）
function fsUpdateField(path, field, value) {
  var token = getFirestoreToken_()
  var url =
    firestoreBase_() + '/' + path + '?updateMask.fieldPaths=' + encodeURIComponent(field)
  var fields = {}
  fields[field] = { stringValue: value }
  UrlFetchApp.fetch(url, {
    method: 'patch',
    headers: { Authorization: 'Bearer ' + token },
    contentType: 'application/json',
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true,
  })
}
