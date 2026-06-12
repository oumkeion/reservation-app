// LINE bot の返信メッセージ生成（純粋関数のみ・Firebase非依存でテスト可能）
'use strict'

const TYPE_LABELS = {
  confirmed: '確定',
  request: '希望',
  fixed: '固定',
  personal: '個人練',
  'no-sound': '音出し禁止',
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** Date → JST の "YYYY-MM-DD" */
function jstDateStr(date) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(date)
}

/** Date → JST の "HH:MM" */
function jstTime(date) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/** "YYYY-MM-DD" → "M/D(曜)" */
function dateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${m}/${d}(${wd})`
}

/** 部室予約1件 → "19:00-21:00 バンド名（確定）" */
function eventLine(event) {
  const label = TYPE_LABELS[event.type] || event.type || ''
  return `${jstTime(event.start)}-${jstTime(event.end)} ${event.title}${label ? `（${label}）` : ''}`
}

/**
 * 1日分のまとめメッセージ。
 * events: [{title, type, start: Date, end: Date}]（音出し禁止以外・時刻順）
 * noSoundRanges: [{start: "HH:MM", end: "HH:MM"}]（講義棟由来）
 */
function buildDaySummary(dateStr, events, noSoundRanges) {
  const lines = [`📅 ${dateLabel(dateStr)} の部室予約`]
  if (events.length === 0) {
    lines.push('予約はありません。')
  } else {
    for (const e of events) lines.push(eventLine(e))
  }
  lines.push('')
  if (noSoundRanges.length === 0) {
    lines.push('🔇 音出し禁止: なし（終日音出しOK）')
  } else {
    const ranges = noSoundRanges.map((r) => `${r.start}〜${r.end}`).join('、')
    lines.push(`🔇 音出し禁止: ${ranges}`)
  }
  return lines.join('\n')
}

/**
 * 1週間分のまとめメッセージ。
 * days: [{dateStr, events}]（日付順・7日分）
 */
function buildWeekSummary(days) {
  const lines = ['📅 今週の部室予約']
  for (const { dateStr, events } of days) {
    lines.push('')
    lines.push(`▼ ${dateLabel(dateStr)}`)
    if (events.length === 0) {
      lines.push('　予約なし')
    } else {
      for (const e of events) lines.push(`　${eventLine(e)}`)
    }
  }
  return lines.join('\n')
}

/**
 * 音出し禁止帯のまとめ（今日と明日）。
 * days: [{dateStr, ranges: [{start, end}]}]
 */
function buildNoSoundSummary(days) {
  const lines = ['🔇 音出し禁止時間（講義棟の利用予定から自動取得）']
  for (const { dateStr, ranges } of days) {
    lines.push('')
    lines.push(`▼ ${dateLabel(dateStr)}`)
    if (ranges.length === 0) {
      lines.push('　なし（終日音出しOK）')
    } else {
      for (const r of ranges) lines.push(`　${r.start}〜${r.end}`)
    }
  }
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
    '「通知オン」… このトークに毎朝のまとめを配信',
    '「通知オフ」… 配信を停止',
  ].join('\n')
}

/**
 * 受信テキスト → コマンド名（該当なしは null）。
 * グループの雑談に反応しないよう、完全一致に近い短い表現のみ受け付ける。
 */
function parseCommand(text) {
  const t = (text || '').trim().toLowerCase()
  if (['今日', 'きょう', 'today'].includes(t)) return 'today'
  if (['今週', '予約', 'こんしゅう', 'week'].includes(t)) return 'week'
  if (['音出し', 'おとだし', '音出し禁止'].includes(t)) return 'nosound'
  if (['通知オン', '通知on'].includes(t)) return 'notify-on'
  if (['通知オフ', '通知off'].includes(t)) return 'notify-off'
  if (['ヘルプ', 'help', '使い方'].includes(t)) return 'help'
  return null
}

module.exports = {
  jstDateStr,
  dateLabel,
  buildDaySummary,
  buildWeekSummary,
  buildNoSoundSummary,
  buildHelp,
  parseCommand,
}
