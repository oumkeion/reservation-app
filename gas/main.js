// 軽音部 LINE bot 本体（Google Apps Script）
//
// - doPost: LINE Messaging API の Webhook（Web Appデプロイ）。
//   GAS は HTTPヘッダを読めず LINE 署名検証ができないため、Webhook URL の
//   `?token=<乱数>` を Script Properties の WEBHOOK_TOKEN と照合して代替する。
// - dailyReminder: 時間主導トリガー（毎日20時）で翌日の予約を通知オンのトークへ配信。
// - setupTriggers: トリガーを設置するワンタイム関数（エディタから手動実行）。
'use strict'

function doPost(e) {
  var expected = PropertiesService.getScriptProperties().getProperty('WEBHOOK_TOKEN')
  if (!expected || !e.parameter || e.parameter.token !== expected) {
    return ContentService.createTextOutput('forbidden')
  }

  var body = JSON.parse(e.postData.contents || '{}')
  ;(body.events || []).forEach(function (event) {
    try {
      handleLineEvent_(event)
    } catch (err) {
      console.error('イベント処理に失敗: ' + err)
      if (event.replyToken) {
        try {
          lineReply(event.replyToken, 'エラーが発生しました。時間をおいて再度お試しください。')
        } catch (ignored) {} // eslint-disable-line no-empty
      }
    }
  })
  return ContentService.createTextOutput('ok')
}

function handleLineEvent_(event) {
  if (event.type === 'join') {
    lineReply(event.replyToken, '🎸 軽音部botです。\n' + buildHelp())
    return
  }
  if (event.type !== 'message' || !event.message || event.message.type !== 'text') return

  var parsed = parseCommand(event.message.text)
  if (!parsed) return // コマンド以外の雑談には反応しない

  var src = event.source || {}
  var talkId = src.groupId || src.roomId || src.userId
  var reply = runCommand_(parsed, talkId, src.type)
  if (reply) lineReply(event.replyToken, reply)
}

function runCommand_(parsed, talkId, sourceType) {
  switch (parsed.command) {
    case 'help':
      return buildHelp()
    case 'today': {
      var today = jstDateAfter_(0)
      return buildDaySummary(today, getEventsOn_(today), getNoSoundOn_(today))
    }
    case 'week': {
      var days = []
      for (var i = 0; i < 7; i++) {
        var d = jstDateAfter_(i)
        days.push({ dateStr: d, events: getEventsOn_(d) })
      }
      return buildWeekSummary(days)
    }
    case 'nosound':
      return buildNoSoundSummary([0, 1].map(function (i) {
        var d = jstDateAfter_(i)
        return { dateStr: d, ranges: getNoSoundOn_(d) }
      }))
    case 'reserve':
      return handleReserve_(parsed.args)
    case 'notify-on':
      fsSetDoc('lineNotifyTargets/' + talkId, {
        sourceType: sourceType || 'unknown',
        createdAt: new Date().toISOString(),
      })
      return '✅ このトークに予約前日の20時、翌日の予約リマインドを配信します。\n「通知オフ」で停止できます。'
    case 'notify-off':
      fsDeleteDoc('lineNotifyTargets/' + talkId)
      return '配信を停止しました。「通知オン」で再開できます。'
    case 'poll-create':
      return createPoll(talkId, parsed.args)
    case 'poll-result':
      return getPollResult(talkId)
    default:
      return null
  }
}

/** 「予約 6/15 19:00-21:00 バンド名 記入者名」の処理（確定枠のみ） */
function handleReserve_(args) {
  var now = new Date()
  var parsed = parseReservation(args, now)
  if (parsed.error) return '⚠️ ' + parsed.error

  var events = getAllEvents_()
  var validationError = validateConfirmedReservation(parsed, now, events)
  if (validationError) return '⚠️ ' + validationError

  var startIso = parsed.date + 'T' + minToHHMM(parsed.startMin) + ':00+09:00'
  var endIso = parsed.date + 'T' + minToHHMM(parsed.endMin) + ':00+09:00'
  fsAddDoc('events', {
    title: parsed.title,
    start: startIso,
    end: endIso,
    allDay: false,
    extendedProps: {
      type: 'confirmed',
      comment: 'LINE botから予約',
      editor: parsed.editor,
    },
  })
  fsAddDoc('logs', {
    timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    action: '予約追加(LINE)',
    editor: parsed.editor,
    event: {
      title: parsed.title,
      start: startIso,
      end: endIso,
      type: 'confirmed',
    },
  })
  return [
    '✅ 予約しました！（部室確定枠）',
    '📅 ' + dateLabel(parsed.date) + ' ' + minToHHMM(parsed.startMin) + '〜' + minToHHMM(parsed.endMin),
    '🎸 ' + parsed.title + '（記入者: ' + parsed.editor + '）',
    '取り消しはWebの予約カレンダーから行えます。',
  ].join('\n')
}

// --- データ取得ヘルパ ---

function jstDateAfter_(offsetDays) {
  return jstDateStr(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000))
}

/** events 全件 → [{title, type, editor, start: Date, end: Date}] */
function getAllEvents_() {
  return fsListAll('events')
    .map(function (d) {
      var props = d.extendedProps || {}
      return {
        title: d.title || '（無題）',
        type: props.type,
        editor: props.editor || '',
        start: new Date(d.start),
        end: new Date(d.end),
      }
    })
    .filter(function (e) {
      return !isNaN(e.start.getTime())
    })
}

function getEventsOn_(dateStr) {
  return getAllEvents_()
    .filter(function (e) {
      return e.type !== 'no-sound' && jstDateStr(e.start) === dateStr
    })
    .sort(function (a, b) {
      return a.start - b.start
    })
}

function getNoSoundOn_(dateStr) {
  var doc = fsGetDoc('settings/lectureHall')
  if (!doc || !doc.noSound) return []
  return doc.noSound[dateStr] || []
}

// --- 前日リマインド ---

function dailyReminder() {
  var targets = fsListAll('lineNotifyTargets')
  if (targets.length === 0) return

  var tomorrow = jstDateAfter_(1)
  var events = getEventsOn_(tomorrow)
  if (events.length === 0) return // 予約が無い日は配信しない（無料枠の節約）

  var text =
    '🔔 明日の予約リマインド\n' +
    buildDaySummary(tomorrow, events, getNoSoundOn_(tomorrow))
  targets.forEach(function (t) {
    try {
      linePush(t.id, text)
    } catch (err) {
      console.error('配信に失敗 (' + t.id + '): ' + err)
    }
  })
}

/** 初回セットアップ: エディタから1回実行してトリガーを設置する */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyReminder') ScriptApp.deleteTrigger(t)
  })
  ScriptApp.newTrigger('dailyReminder').timeBased().everyDays(1).atHour(20).create()
}
