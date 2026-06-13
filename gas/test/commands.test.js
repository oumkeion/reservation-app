// gas/commands.js の純粋関数テスト（node gas/test/commands.test.js で実行）
'use strict'

const assert = require('node:assert')
const {
  jstDateStr,
  dateLabel,
  buildDaySummary,
  buildNoSoundSummary,
  parseCommand,
  parseReservation,
  minToHHMM,
  validateConfirmedReservation,
} = require('../commands')

// 基準時刻: 2026-06-12 12:00 JST = 03:00 UTC
const NOW = new Date('2026-06-12T03:00:00Z')

// jstDateStr / dateLabel
assert.strictEqual(jstDateStr(NOW), '2026-06-12')
assert.strictEqual(dateLabel('2026-06-15'), '6/15(月)')

// parseCommand
assert.deepStrictEqual(parseCommand('今日'), { command: 'today' })
assert.deepStrictEqual(parseCommand('音出し'), { command: 'nosound' })
assert.deepStrictEqual(parseCommand('調整結果'), { command: 'poll-result' })
assert.deepStrictEqual(parseCommand('調整 マイバンド'), { command: 'poll-create', args: 'マイバンド' })
assert.deepStrictEqual(parseCommand('予約 6/15 19:00-21:00 バンド 太郎'), {
  command: 'reserve',
  args: '6/15 19:00-21:00 バンド 太郎',
})
assert.strictEqual(parseCommand('おはよう'), null)

// parseReservation
const ok = parseReservation('6/15 19:00-21:00 ザ・バンド 太郎', NOW)
assert.deepStrictEqual(ok, {
  date: '2026-06-15',
  startMin: 19 * 60,
  endMin: 21 * 60,
  title: 'ザ・バンド',
  editor: '太郎',
})
// バンド名に空白を含む場合
const spaced = parseReservation('6/15 19:00-21:00 The Great Band 太郎', NOW)
assert.strictEqual(spaced.title, 'The Great Band')
assert.strictEqual(spaced.editor, '太郎')
// 年またぎ（1/5 は来年と解釈）
assert.strictEqual(parseReservation('1/5 10:00-11:00 バンド 太郎', NOW).date, '2027-01-05')
// エラー系
assert.ok(parseReservation('', NOW).error)
assert.ok(parseReservation('6/15 19:00-21:00 バンドのみ', NOW).error) // 記入者なし
assert.ok(parseReservation('6/15 19:10-21:00 バンド 太郎', NOW).error.includes('15分単位'))
assert.ok(parseReservation('6/15 21:00-19:00 バンド 太郎', NOW).error.includes('終了時刻'))

// validateConfirmedReservation
const noEvents = []
assert.strictEqual(
  validateConfirmedReservation(ok, NOW, noEvents),
  null,
)
// 1週間より先はNG
const farFuture = parseReservation('6/25 19:00-21:00 バンド 太郎', NOW)
assert.ok(validateConfirmedReservation(farFuture, NOW, noEvents).includes('1週間'))
// 同一記入者の未終了確定枠があればNG
const existing = [{
  title: '既存バンド',
  type: 'confirmed',
  editor: '太郎',
  start: new Date('2026-06-13T10:00:00+09:00'),
  end: new Date('2026-06-13T12:00:00+09:00'),
}]
assert.ok(validateConfirmedReservation(ok, NOW, existing).includes('既存バンド'))
// 別名義ならOK
assert.strictEqual(
  validateConfirmedReservation({ ...ok, editor: '花子' }, NOW, existing),
  null,
)

// buildDaySummary（JST表示の確認）
const summary = buildDaySummary(
  '2026-06-15',
  [{
    title: 'テスト',
    type: 'confirmed',
    start: new Date('2026-06-15T19:00:00+09:00'),
    end: new Date('2026-06-15T21:00:00+09:00'),
  }],
  [{ start: '07:00', end: '17:00' }],
)
assert.ok(summary.includes('19:00-21:00 テスト（確定）'), summary)
assert.ok(summary.includes('07:00〜17:00'), summary)

// minToHHMM
assert.strictEqual(minToHHMM(19 * 60 + 15), '19:15')

// buildNoSoundSummary
const ns = buildNoSoundSummary([{ dateStr: '2026-06-13', ranges: [] }])
assert.ok(ns.includes('なし（終日音出しOK）'), ns)

console.log('✅ gas/commands.test.js: all assertions passed')
