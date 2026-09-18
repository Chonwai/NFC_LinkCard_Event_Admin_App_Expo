/**
 * 登入失敗分類（WP-A1：對齊 promoter claim 登入契約）
 */

/**
 * 此帳號沒有推廣者／活動營運身分（`promoterRole == null`）。
 * 不可退化成「帳密錯誤」讓使用者無效重試。
 */
export class PromoterAccessError extends Error {
  readonly code = "PROMOTER_ACCESS_REQUIRED";

  constructor(message = "此帳號沒有活動營運權限") {
    super(message);
    this.name = "PromoterAccessError";
  }
}
