// 日程調整（CHO-EMON シート流用）
// 「調整 <バンド名>」: テンプレートを複製して共有リンクを返す。トークIDとシートIDの対応を
//   Firestore の schedulePolls に保存する。
// 「調整結果」: 集計シートを読み、全員が参加できる時間帯（集計セルが空欄）を返す。
'use strict'

var CHOEMON_SLOT_MIN = 30 // 30分刻み
var CHOEMON_GRID_START_HOUR = 7 // 集計シートの時間軸は 7:00 始まり
var CHOEMON_SLOT_COLS = 34 // B〜AI列 = 7:00〜24:00

/** テンプレートを複製し、リンクを返す */
function createPoll(talkId, bandName) {
  var templateId = PropertiesService.getScriptProperties().getProperty('CHOEMON_TEMPLATE_ID')
  if (!templateId) throw new Error('Script Properties に CHOEMON_TEMPLATE_ID が未設定です')

  var name = (bandName || '日程調整') + ' 調整シート ' + jstDateStr(new Date())
  var copy = DriveApp.getFileById(templateId).makeCopy(name)
  copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT)

  fsSetDoc('schedulePolls/' + talkId, {
    sheetId: copy.getId(),
    name: name,
    createdAt: new Date().toISOString(),
  })

  return [
    '📋 日程調整シートを作成しました！',
    name,
    copy.getUrl(),
    '',
    '各自スマホのスプレッドシートアプリで「○人目」シートに名前と空き時間を入力してください。',
    '入力が揃ったら「調整結果」と送ると、全員が参加できる時間帯を集計します。',
  ].join('\n')
}

/** 集計シートを読み、全員OKの時間帯を日付ごとにまとめる */
function getPollResult(talkId) {
  var poll = fsGetDoc('schedulePolls/' + talkId)
  if (!poll) {
    return 'このトークの調整シートが見つかりません。先に「調整 バンド名」で作成してください。'
  }

  var ss = SpreadsheetApp.openById(poll.sheetId)
  var sheet = ss.getSheetByName('集計')
  if (!sheet) return '集計シートが見つかりません。シートの構成が変わっていないか確認してください。'

  // 参加者名（C1, E1, G1, ... U1）
  var nameRow = sheet.getRange(1, 1, 1, 22).getValues()[0]
  var members = []
  for (var c = 2; c < 22; c += 2) {
    if (nameRow[c]) members.push(String(nameRow[c]))
  }
  if (members.length === 0) {
    return 'まだ誰も名前を入力していません。各自のシートに名前と空き時間を入力してください。'
  }

  // 日付列（A4〜）と集計グリッド（B4〜）
  var startDate = sheet.getRange('B2').getValue()
  var numDays = Number(sheet.getRange('D2').getValue()) || 0
  if (!startDate || numDays <= 0) {
    return '集計シートの「開始日」と「日分」が未入力です。シートに入力してから再度お試しください。'
  }
  numDays = Math.min(numDays, 31)

  var dates = sheet.getRange(4, 1, numDays, 1).getValues()
  var grid = sheet.getRange(4, 2, numDays, CHOEMON_SLOT_COLS).getValues()

  var lines = ['📋 調整結果（' + members.length + '人: ' + members.join('、') + '）']
  var found = false
  for (var r = 0; r < numDays; r++) {
    var ranges = emptyRunsToRanges_(grid[r])
    if (ranges.length === 0) continue
    found = true
    var d = dates[r][0]
    var label = d instanceof Date
      ? d.getMonth() + 1 + '/' + d.getDate() + '(' + WEEKDAYS_JA[d.getDay()] + ')'
      : String(d)
    lines.push('▼ ' + label + '　' + ranges.join('、'))
  }
  if (!found) {
    lines.push('全員が揃う時間帯はありませんでした…。△も含めて調整するか、候補日を増やしてください。')
  } else {
    lines.unshift('🎉 全員参加できる時間帯が見つかりました！')
  }
  return lines.join('\n')
}

/** 集計セルの空欄連続区間 → ["19:00〜21:00", ...] */
function emptyRunsToRanges_(row) {
  var ranges = []
  var runStart = -1
  for (var i = 0; i <= row.length; i++) {
    var empty = i < row.length && String(row[i]).trim() === ''
    if (empty && runStart < 0) runStart = i
    if (!empty && runStart >= 0) {
      ranges.push(slotToTime_(runStart) + '〜' + slotToTime_(i))
      runStart = -1
    }
  }
  return ranges
}

function slotToTime_(slotIndex) {
  var min = CHOEMON_GRID_START_HOUR * 60 + slotIndex * CHOEMON_SLOT_MIN
  return Math.floor(min / 60) + ':' + String(min % 60).padStart(2, '0')
}
