// Firestore からの読み出し（events / settings/lectureHall / lineNotifyTargets）
'use strict'

const { getFirestore } = require('firebase-admin/firestore')
const { jstDateStr } = require('./commands')

/**
 * 指定したJST日付（"YYYY-MM-DD"）の部室予約を時刻順で返す。
 * start は ISO文字列（"Z" と "+09:00" が混在）のため、全件取得して Date で比較する。
 * 音出し禁止タイプは除く（講義棟由来の禁止帯は settings/lectureHall を使う）。
 */
async function getEventsByDates(dateStrs) {
  const db = getFirestore()
  const snapshot = await db.collection('events').get()
  const wanted = new Set(dateStrs)
  const byDate = Object.fromEntries(dateStrs.map((d) => [d, []]))
  for (const doc of snapshot.docs) {
    const data = doc.data()
    const type = data.extendedProps?.type
    if (type === 'no-sound') continue
    const start = new Date(data.start)
    const end = new Date(data.end)
    if (Number.isNaN(start.getTime())) continue
    const dateStr = jstDateStr(start)
    if (!wanted.has(dateStr)) continue
    byDate[dateStr].push({
      title: data.title || '（無題）',
      type,
      start,
      end,
    })
  }
  for (const d of dateStrs) {
    byDate[d].sort((a, b) => a.start - b.start)
  }
  return byDate
}

/** 講義棟由来の音出し禁止帯 {dateStr: [{start, end}]} を返す（無ければ空） */
async function getNoSound() {
  const db = getFirestore()
  const snap = await db.collection('settings').doc('lectureHall').get()
  if (!snap.exists) return {}
  return snap.data().noSound || {}
}

/** 毎朝配信の宛先（グループ/ユーザー）一覧 */
async function getNotifyTargets() {
  const db = getFirestore()
  const snapshot = await db.collection('lineNotifyTargets').get()
  return snapshot.docs.map((d) => d.id)
}

/** 配信先の登録（docID = LINEの送信先ID） */
async function addNotifyTarget(targetId, sourceType) {
  const db = getFirestore()
  await db.collection('lineNotifyTargets').doc(targetId).set({
    sourceType,
    createdAt: new Date().toISOString(),
  })
}

/** 配信先の解除 */
async function removeNotifyTarget(targetId) {
  const db = getFirestore()
  await db.collection('lineNotifyTargets').doc(targetId).delete()
}

module.exports = {
  getEventsByDates,
  getNoSound,
  getNotifyTargets,
  addNotifyTarget,
  removeNotifyTarget,
}
