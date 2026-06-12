// 予約バリデーション失敗を示すエラー。
// ReserveDialog の handleSave で alert を二重に出さないために使う。
export class ValidationFailure extends Error {}
