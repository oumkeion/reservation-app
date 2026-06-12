// メッセージ生成ロジックの簡易テスト（依存なし: node test/commands.test.js で実行）
'use strict'

const assert = require('node:assert')
const {
  dateLabel,
  buildDaySummary,
  buildWeekSummary,
  buildNoSoundSummary,
  parseCommand,
} = require('../src/commands')

// dateLabel
assert.strictEqual(dateLabel('2026-06-12'), '6/12(金)')
assert.strictEqual(dateLabel('2026-06-15'), '6/15(月)')

// parseCommand
assert.strictEqual(parseCommand('今日'), 'today')
assert.strictEqual(parseCommand(' 今週 '), 'week')
assert.strictEqual(parseCommand('音出し'), 'nosound')
assert.strictEqual(parseCommand('通知オン'), 'notify-on')
assert.strictEqual(parseCommand('HELP'), 'help')
assert.strictEqual(parseCommand('おはよう'), null)
assert.strictEqual(parseCommand(''), null)

// buildDaySummary（JSTの時刻表示を確認: 19:00 JST = 10:00 UTC）
const ev = {
  title: 'テストバンド',
  type: 'confirmed',
  start: new Date('2026-06-12T10:00:00Z'),
  end: new Date('2026-06-12T12:00:00Z'),
}
const day = buildDaySummary('2026-06-12', [ev], [{ start: '07:00', end: '17:10' }])
assert.ok(day.includes('6/12(金)'), day)
assert.ok(day.includes('19:00-21:00 テストバンド（確定）'), day)
assert.ok(day.includes('🔇 音出し禁止: 07:00〜17:10'), day)

const emptyDay = buildDaySummary('2026-06-13', [], [])
assert.ok(emptyDay.includes('予約はありません'), emptyDay)
assert.ok(emptyDay.includes('終日音出しOK'), emptyDay)

// buildWeekSummary
const week = buildWeekSummary([
  { dateStr: '2026-06-12', events: [ev] },
  { dateStr: '2026-06-13', events: [] },
])
assert.ok(week.includes('▼ 6/12(金)'), week)
assert.ok(week.includes('　予約なし'), week)

// buildNoSoundSummary
const ns = buildNoSoundSummary([
  { dateStr: '2026-06-12', ranges: [{ start: '07:00', end: '17:10' }, { start: '17:30', end: '19:00' }] },
  { dateStr: '2026-06-13', ranges: [] },
])
assert.ok(ns.includes('　07:00〜17:10'), ns)
assert.ok(ns.includes('なし（終日音出しOK）'), ns)
assert.ok(ns.includes('上記以外の時間帯は音出し可能'), ns)

console.log('✅ commands.test.js: all assertions passed')
