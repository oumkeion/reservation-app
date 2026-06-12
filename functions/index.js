// 軽音部 LINE bot（Cloud Functions for Firebase, v2 API）
//
// - lineWebhook: LINE Messaging API の Webhook。コマンド（今日/今週/音出し/通知オン・オフ/ヘルプ）に応答
// - dailyDigest: 毎朝 7:30 JST に「通知オン」したトークへ当日のまとめを配信
//
// 必要なシークレット（firebase functions:secrets:set で登録）:
//   LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN
'use strict'

const { onRequest } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const logger = require('firebase-functions/logger')
const { initializeApp } = require('firebase-admin/app')
const line = require('@line/bot-sdk')

const {
  jstDateStr,
  buildDaySummary,
  buildWeekSummary,
  buildNoSoundSummary,
  buildHelp,
  parseCommand,
} = require('./src/commands')
const {
  getEventsByDates,
  getNoSound,
  getNotifyTargets,
  addNotifyTarget,
  removeNotifyTarget,
} = require('./src/data')

initializeApp()

const channelSecret = defineSecret('LINE_CHANNEL_SECRET')
const channelAccessToken = defineSecret('LINE_CHANNEL_ACCESS_TOKEN')

const REGION = 'asia-northeast1'

/** JST基準で today + offset 日の "YYYY-MM-DD" */
function jstDateAfter(offsetDays) {
  return jstDateStr(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000))
}

/** コマンドに応じた返信テキストを作る */
async function buildReply(command, event) {
  if (command === 'help') return buildHelp()

  if (command === 'today') {
    const today = jstDateAfter(0)
    const [byDate, noSound] = await Promise.all([getEventsByDates([today]), getNoSound()])
    return buildDaySummary(today, byDate[today], noSound[today] || [])
  }

  if (command === 'week') {
    const dates = [...Array(7)].map((_, i) => jstDateAfter(i))
    const byDate = await getEventsByDates(dates)
    return buildWeekSummary(dates.map((d) => ({ dateStr: d, events: byDate[d] })))
  }

  if (command === 'nosound') {
    const noSound = await getNoSound()
    const days = [0, 1].map((i) => {
      const d = jstDateAfter(i)
      return { dateStr: d, ranges: noSound[d] || [] }
    })
    return buildNoSoundSummary(days)
  }

  // 通知オン/オフ: 送信元（グループ > ルーム > 個人）を登録・解除
  const src = event.source || {}
  const targetId = src.groupId || src.roomId || src.userId
  if (!targetId) return null
  if (command === 'notify-on') {
    await addNotifyTarget(targetId, src.type || 'unknown')
    return '✅ このトークに毎朝7:30、当日の部室予約と音出し禁止時間を配信します。\n「通知オフ」で停止できます。'
  }
  if (command === 'notify-off') {
    await removeNotifyTarget(targetId)
    return '配信を停止しました。「通知オン」で再開できます。'
  }
  return null
}

exports.lineWebhook = onRequest(
  { region: REGION, secrets: [channelSecret, channelAccessToken] },
  async (req, res) => {
    // 署名検証（なりすまし防止）
    const signature = req.get('x-line-signature') || ''
    const body = req.rawBody.toString('utf8')
    if (!line.validateSignature(body, channelSecret.value(), signature)) {
      logger.warn('署名検証に失敗しました')
      res.status(403).send('invalid signature')
      return
    }

    const client = new line.messagingApi.MessagingApiClient({
      channelAccessToken: channelAccessToken.value(),
    })
    const events = JSON.parse(body).events || []

    await Promise.all(
      events.map(async (event) => {
        try {
          // グループ招待時のあいさつ
          if (event.type === 'join') {
            await client.replyMessage({
              replyToken: event.replyToken,
              messages: [{ type: 'text', text: `🎸 軽音部botです。\n${buildHelp()}` }],
            })
            return
          }
          if (event.type !== 'message' || event.message?.type !== 'text') return
          const command = parseCommand(event.message.text)
          if (!command) return // コマンド以外の雑談には反応しない
          const reply = await buildReply(command, event)
          if (!reply) return
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: reply }],
          })
        } catch (err) {
          logger.error('イベント処理に失敗:', err)
        }
      }),
    )
    res.status(200).send('ok')
  },
)

exports.dailyDigest = onSchedule(
  {
    region: REGION,
    schedule: '30 7 * * *',
    timeZone: 'Asia/Tokyo',
    secrets: [channelAccessToken],
  },
  async () => {
    const targets = await getNotifyTargets()
    if (targets.length === 0) {
      logger.info('配信先が未登録のためスキップ')
      return
    }
    const today = jstDateAfter(0)
    const [byDate, noSound] = await Promise.all([getEventsByDates([today]), getNoSound()])
    const text = buildDaySummary(today, byDate[today], noSound[today] || [])

    const client = new line.messagingApi.MessagingApiClient({
      channelAccessToken: channelAccessToken.value(),
    })
    for (const to of targets) {
      try {
        await client.pushMessage({ to, messages: [{ type: 'text', text }] })
      } catch (err) {
        logger.error(`配信に失敗 (${to}):`, err)
      }
    }
    logger.info(`毎朝ダイジェストを ${targets.length} 件に配信しました`)
  },
)
