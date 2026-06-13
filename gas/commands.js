// LINE bot のコマンド解析・メッセージ生成（純粋関数のみ）
// GAS では全ファイルがグローバルスコープに結合される。
// node でのユニットテスト用に末尾で module.exports ガードを置いている。
'use strict'

var TYPE_LABELS_BOT = {
  confirmed: '確定',
  request: '希望',
  fixed: '固定',
  personal: '個人練',
  'no-sound': '音出し禁止',
}

var WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

/** Date → JST の "YYYY-MM-DD" */
function jstDateStr(date) {
  var t = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  var y = t.getUTCFullYear()
  var m = String(t.getUTCMonth() + 1).padStart(2, '0')
  var d = String(t.getUTCDate()).padStart(2, '0')
  return y + '-' + m + '-' + d
}

/** Date → JST の "HH:MM" */
function jstTime(date) {
  var t = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return (
    String(t.getUTCHours()).padStart(2, '0') + ':' + String(t.getUTCMinutes()).padStart(2, '0')
  )
}

/** "YYYY-MM-DD" → "M/D(曜)" */
function dateLabel(dateStr) {
  var p = dateStr.split('-').map(Number)
  var wd = WEEKDAYS_JA[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()]
  return p[1] + '/' + p[2] + '(' + wd + ')'
}

function eventLine(event) {
  var label = TYPE_LABELS_BOT[event.type] || event.type || ''
  return (
    jstTime(event.start) + '-' + jstTime(event.end) + ' ' + event.title +
    (label ? '（' + label + '）' : '')
  )
}

/** 1日分のまとめ */
function buildDaySummary(dateStr, events, noSoundRanges) {
  var lines = ['📅 ' + dateLabel(dateStr) + ' の部室予約']
  if (events.length === 0) {
    lines.push('予約はありません。')
  } else {
    events.forEach(function (e) {
      lines.push(eventLine(e))
    })
  }
  lines.push('')
  if (noSoundRanges.length === 0) {
    lines.push('🔇 音出し禁止: なし（終日音出しOK）')
  } else {
    lines.push(
      '🔇 音出し禁止: ' +
        noSoundRanges.map(function (r) { return r.start + '〜' + r.end }).join('、'),
    )
  }
  return lines.join('\n')
}

/** 1週間分のまとめ */
function buildWeekSummary(days) {
  var lines = ['📅 今週の部室予約']
  days.forEach(function (day) {
    lines.push('')
    lines.push('▼ ' + dateLabel(day.dateStr))
    if (day.events.length === 0) {
      lines.push('　予約なし')
    } else {
      day.events.forEach(function (e) {
        lines.push('　' + eventLine(e))
      })
    }
  })
  return lines.join('\n')
}

/** 音出し禁止帯のまとめ（今日と明日） */
function buildNoSoundSummary(days) {
  var lines = ['🔇 音出し禁止時間（講義棟の利用予定から自動取得）']
  days.forEach(function (day) {
    lines.push('')
    lines.push('▼ ' + dateLabel(day.dateStr))
    if (day.ranges.length === 0) {
      lines.push('　なし（終日音出しOK）')
    } else {
      day.ranges.forEach(function (r) {
        lines.push('　' + r.start + '〜' + r.end)
      })
    }
  })
  lines.push('')
  lines.push('上記以外の時間帯は音出し可能です。')
  return lines.join('\n')
}

function buildHelp() {
  return [
    '🎸 軽音部bot の使い方',
    '「今日」… 今日の部室予約と音出し禁止時間',
    '「今週」… 今週の部室予約一覧',
    '「音出し」… 今日・明日の音出し禁止時間',
    '「予約 6/15 19:00-21:00 バンド名 記入者名」… 部室の確定枠を予約',
    '「調整 バンド名」… 日程調整シート(調エモン)を作成',
    '「調整結果」… 全員が参加できる時間帯を集計',
    '「通知オン/通知オフ」… 前日リマインドの配信設定',
  ].join('\n')
}

/** 受信テキスト → {command, args} （該当なしは null） */
function parseCommand(text) {
  var raw = (text || '').trim()
  var t = raw.toLowerCase()
  if (['今日', 'きょう', 'today'].indexOf(t) >= 0) return { command: 'today' }
  if (['今週', 'こんしゅう', 'week'].indexOf(t) >= 0) return { command: 'week' }
  if (['音出し', 'おとだし', '音出し禁止'].indexOf(t) >= 0) return { command: 'nosound' }
  if (['通知オン', '通知on'].indexOf(t) >= 0) return { command: 'notify-on' }
  if (['通知オフ', '通知off'].indexOf(t) >= 0) return { command: 'notify-off' }
  if (['ヘルプ', 'help', '使い方'].indexOf(t) >= 0) return { command: 'help' }
  if (t === '調整結果') return { command: 'poll-result' }
  if (raw.indexOf('調整') === 0) {
    return { command: 'poll-create', args: raw.slice(2).trim() }
  }
  if (raw.indexOf('予約') === 0) {
    return { command: 'reserve', args: raw.slice(2).trim() }
  }
  return null
}

/**
 * 予約コマンドの引数を解析する。
 * 書式: "6/15 19:00-21:00 バンド名 記入者名"（バンド名は空白を含んでも良い。最後の語が記入者名）
 * 戻り値: {date: "YYYY-MM-DD", startMin, endMin, title, editor} / {error: "..."}
 */
function parseReservation(args, now) {
  var FORMAT = '書式: 予約 6/15 19:00-21:00 バンド名 記入者名'
  var tokens = (args || '').split(/\s+/).filter(function (s) { return s })
  if (tokens.length < 4) return { error: '入力が足りません。\n' + FORMAT }

  var dm = tokens[0].match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!dm) return { error: '日付が読み取れません（例: 6/15）。\n' + FORMAT }
  var month = Number(dm[1])
  var day = Number(dm[2])

  var tm = tokens[1].match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
  if (!tm) return { error: '時間が読み取れません（例: 19:00-21:00）。\n' + FORMAT }
  var startMin = Number(tm[1]) * 60 + Number(tm[2])
  var endMin = Number(tm[3]) * 60 + Number(tm[4])
  if (startMin % 15 !== 0 || endMin % 15 !== 0) {
    return { error: '時間は15分単位で指定してください（例: 19:00-21:15）。' }
  }
  if (endMin <= startMin) return { error: '終了時刻は開始時刻より後にしてください。' }

  var editor = tokens[tokens.length - 1]
  var title = tokens.slice(2, tokens.length - 1).join(' ')

  // 年は「今日以降で直近のその月日」と解釈（年末年始をまたいでも正しく動く）
  var nowJst = jstDateStr(now).split('-').map(Number)
  var year = nowJst[0]
  var candidate = new Date(Date.UTC(year, month - 1, day))
  var today = new Date(Date.UTC(nowJst[0], nowJst[1] - 1, nowJst[2]))
  if (candidate < today) year += 1
  var dateStr =
    year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')

  return { date: dateStr, startMin: startMin, endMin: endMin, title: title, editor: editor }
}

/** 分 → "HH:MM" */
function minToHHMM(min) {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0')
}

/**
 * 確定枠の予約ルール検証（web版 validation.js の confirmed と同一ルール）。
 * events: 既存イベント [{title, type, editor, start: Date, end: Date}]
 * 戻り値: エラーメッセージ / null
 */
function validateConfirmedReservation(parsed, now, events) {
  var start = new Date(parsed.date + 'T' + minToHHMM(parsed.startMin) + ':00+09:00')
  if (start < now) return '過去の時間帯は予約できません。'
  if (start.getTime() - now.getTime() > 7 * 24 * 60 * 60 * 1000) {
    return '確定枠は1週間先までしか予約できません。'
  }
  for (var i = 0; i < events.length; i++) {
    var e = events[i]
    if (e.type === 'confirmed' && e.editor === parsed.editor && e.end > now) {
      return (
        'あなたはすでに確定枠の予約（バンド名: ' + e.title + '）を保持しているため、' +
        '新たな予約はできません。その予約が終了してから再度お試しください。'
      )
    }
  }
  return null
}

if (typeof module !== 'undefined') {
  module.exports = {
    jstDateStr: jstDateStr,
    jstTime: jstTime,
    dateLabel: dateLabel,
    buildDaySummary: buildDaySummary,
    buildWeekSummary: buildWeekSummary,
    buildNoSoundSummary: buildNoSoundSummary,
    buildHelp: buildHelp,
    parseCommand: parseCommand,
    parseReservation: parseReservation,
    minToHHMM: minToHHMM,
    validateConfirmedReservation: validateConfirmedReservation,
  }
}
