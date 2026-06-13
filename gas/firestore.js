// Firestore REST アクセス（サービスアカウント認証）
// Script Properties の FIREBASE_SERVICE_ACCOUNT（サービスアカウントJSON全文）を使い、
// JWT(RS256) → アクセストークン（CacheServiceで約50分キャッシュ）→ REST 呼び出し。
'use strict'

var FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore'

function getServiceAccount_() {
  var raw = PropertiesService.getScriptProperties().getProperty('FIREBASE_SERVICE_ACCOUNT')
  if (!raw) throw new Error('Script Properties に FIREBASE_SERVICE_ACCOUNT が未設定です')
  return JSON.parse(raw)
}

function base64UrlEncode_(data) {
  var bytes = typeof data === 'string' ? Utilities.newBlob(data).getBytes() : data
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '')
}

/** サービスアカウントで Firestore 用アクセストークンを取得する */
function getFirestoreToken_() {
  var cache = CacheService.getScriptCache()
  var cached = cache.get('fsToken')
  if (cached) return cached

  var sa = getServiceAccount_()
  var now = Math.floor(Date.now() / 1000)
  var header = base64UrlEncode_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  var claim = base64UrlEncode_(
    JSON.stringify({
      iss: sa.client_email,
      scope: FIRESTORE_SCOPE,
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  )
  var signature = Utilities.computeRsaSha256Signature(header + '.' + claim, sa.private_key)
  var jwt = header + '.' + claim + '.' + base64UrlEncode_(signature)

  var res = UrlFetchApp.fetch(sa.token_uri, {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    },
  })
  var token = JSON.parse(res.getContentText()).access_token
  cache.put('fsToken', token, 3000) // 50分
  return token
}

function firestoreBase_() {
  var sa = getServiceAccount_()
  return (
    'https://firestore.googleapis.com/v1/projects/' + sa.project_id +
    '/databases/(default)/documents'
  )
}

function firestoreFetch_(path, options) {
  var opts = options || {}
  opts.headers = { Authorization: 'Bearer ' + getFirestoreToken_() }
  opts.contentType = 'application/json'
  opts.muteHttpExceptions = true
  var res = UrlFetchApp.fetch(firestoreBase_() + path, opts)
  var code = res.getResponseCode()
  if (code >= 300) throw new Error('Firestore API ' + code + ': ' + res.getContentText())
  return JSON.parse(res.getContentText() || '{}')
}

// --- Firestore の値エンコード/デコード ---

function fsDecodeValue_(v) {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue' in v) return null
  if ('mapValue' in v) return fsDecodeFields_(v.mapValue.fields || {})
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsDecodeValue_)
  return null
}

function fsDecodeFields_(fields) {
  var out = {}
  Object.keys(fields || {}).forEach(function (k) {
    out[k] = fsDecodeValue_(fields[k])
  })
  return out
}

function fsEncodeValue_(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsEncodeValue_) } }
  if (typeof v === 'object') return { mapValue: { fields: fsEncodeFields_(v) } }
  throw new Error('未対応の型: ' + typeof v)
}

function fsEncodeFields_(obj) {
  var out = {}
  Object.keys(obj).forEach(function (k) {
    out[k] = fsEncodeValue_(obj[k])
  })
  return out
}

// --- コレクション操作 ---

/** コレクション全件取得（ページング対応）→ [{id, ...fields}] */
function fsListAll(collection) {
  var docs = []
  var pageToken = ''
  do {
    var path = '/' + collection + '?pageSize=300' + (pageToken ? '&pageToken=' + pageToken : '')
    var res = firestoreFetch_(path, { method: 'get' })
    ;(res.documents || []).forEach(function (d) {
      var item = fsDecodeFields_(d.fields)
      item.id = d.name.split('/').pop()
      docs.push(item)
    })
    pageToken = res.nextPageToken || ''
  } while (pageToken)
  return docs
}

/** 単一ドキュメント取得（無ければ null） */
function fsGetDoc(path) {
  try {
    var res = firestoreFetch_('/' + path, { method: 'get' })
    return fsDecodeFields_(res.fields)
  } catch (e) {
    if (String(e).indexOf('404') >= 0) return null
    throw e
  }
}

/** ドキュメント追加（自動ID） */
function fsAddDoc(collection, data) {
  return firestoreFetch_('/' + collection, {
    method: 'post',
    payload: JSON.stringify({ fields: fsEncodeFields_(data) }),
  })
}

/** ドキュメント作成/上書き（ID指定） */
function fsSetDoc(path, data) {
  return firestoreFetch_('/' + path, {
    method: 'patch',
    payload: JSON.stringify({ fields: fsEncodeFields_(data) }),
  })
}

/** ドキュメント削除 */
function fsDeleteDoc(path) {
  return firestoreFetch_('/' + path, { method: 'delete' })
}
