/**
 * Constants.gs
 * 共通定数・設定値の集約
 *
 * 環境依存の値（ShopID、ShopPass、ConfigID、SHEETS_ID等）は
 * スクリプトプロパティに格納し、ここでは「キー名」のみ定義する。
 *
 * スクリプトプロパティ設定方法:
 *   GASエディタ → プロジェクトの設定（歯車）→ スクリプトプロパティ
 */

/** スクリプトプロパティのキー名 */
const PROP_KEYS = {
  ENV: 'ENV',                                       // 'test' or 'prod'
  SHEETS_ID: 'SHEETS_ID',
  GMO_TEST_SHOP_ID: 'GMO_TEST_SHOP_ID',
  GMO_TEST_SHOP_PASS: 'GMO_TEST_SHOP_PASS',
  GMO_TEST_CONFIG_ID: 'GMO_TEST_CONFIG_ID',
  GMO_PROD_SHOP_ID: 'GMO_PROD_SHOP_ID',
  GMO_PROD_SHOP_PASS: 'GMO_PROD_SHOP_PASS',
  GMO_PROD_CONFIG_ID: 'GMO_PROD_CONFIG_ID',
  INTERNAL_SHARED_SECRET: 'INTERNAL_SHARED_SECRET',
  RETURN_URL_SUCCESS: 'RETURN_URL_SUCCESS',
  RETURN_URL_ERROR: 'RETURN_URL_ERROR',
  CHATWORK_TOKEN: 'CHATWORK_TOKEN',
  CHATWORK_ROOM_ID: 'CHATWORK_ROOM_ID',
};

/**
 * GMO リンクタイプPlus パラメータ型 URL ベース
 * URL 全体: {LINKPLUS_PARAMETER_BASE}{ShopID}/checkout/{base64}.{hash}
 *
 * 注: 公式ドキュメント上、test/prod の URL 差分が不明なため、両方とも本番 URL を使用。
 *     test 用エンドポイントが判明したら test 側のみ書き換える。
 */
const GMO_ENDPOINTS = {
  test: {
    LINKPLUS_PARAMETER_BASE: 'https://link.mul-pay.jp/v1/plus/',
  },
  prod: {
    LINKPLUS_PARAMETER_BASE: 'https://link.mul-pay.jp/v1/plus/',
  },
};

/** Sheetsシート名 */
const SHEET_NAMES = {
  ORDERS: 'Orders',
  PRODUCT_MASTER: 'ProductMaster',
  SETTINGS: 'Settings',
  AUDIT: 'Audit',
};

/** Ordersシートの列番号（1-indexed） */
const ORDERS_COLS = {
  ISSUE_ID: 1,
  ISSUED_AT: 2,
  ENV: 3,
  STAFF_NAME: 4,
  CUSTOMER_NAME: 5,
  CUSTOMER_EMAIL: 6,
  AMOUNT: 7,
  FREE1: 8,
  FREE2: 9,
  MEMO: 10,
  ORDER_ID: 11,
  LINK_URL: 12,
  EXPIRY: 13,
  STATUS: 14,
  PAID_AT: 15,
  TRAN_ID: 16,
  ACCESS_ID: 17,
  ERROR_CODE: 18,
  REMARKS: 19,
};

/** 決済ステータス */
const STATUS = {
  ISSUED: 'ISSUED',       // URL発行済（未決済）
  AUTH: 'AUTH',           // 仮売上
  CAPTURE: 'CAPTURE',     // 実売上（決済完了）
  CANCEL: 'CANCEL',       // キャンセル
  EXPIRED: 'EXPIRED',     // 期限切れ
  ERROR: 'ERROR',         // エラー
};

/** 監査ログのアクション種別 */
const AUDIT_ACTION = {
  ISSUE_REQUEST: 'ISSUE_REQUEST',
  ISSUE_SUCCESS: 'ISSUE_SUCCESS',
  ISSUE_ERROR: 'ISSUE_ERROR',
  NOTIFY_RECEIVED: 'NOTIFY_RECEIVED',
  NOTIFY_VERIFIED: 'NOTIFY_VERIFIED',
  NOTIFY_FAILED: 'NOTIFY_FAILED',
  AUTH_FAIL: 'AUTH_FAIL',
  CANCEL_REQUEST: 'CANCEL_REQUEST',
};

/**
 * 現在の環境を取得
 * @returns {'test' | 'prod'}
 */
function getEnv_() {
  const env = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.ENV);
  if (env !== 'test' && env !== 'prod') {
    throw new Error(`ENV プロパティが不正です: ${env}。'test' または 'prod' を設定してください`);
  }
  return env;
}

/**
 * 環境に応じた GMO クレデンシャルを取得
 */
function getGmoCredentials_() {
  const env = getEnv_();
  const props = PropertiesService.getScriptProperties();
  if (env === 'test') {
    return {
      shopId: props.getProperty(PROP_KEYS.GMO_TEST_SHOP_ID),
      shopPass: props.getProperty(PROP_KEYS.GMO_TEST_SHOP_PASS),
      configId: props.getProperty(PROP_KEYS.GMO_TEST_CONFIG_ID),
      env: 'test',
    };
  } else {
    return {
      shopId: props.getProperty(PROP_KEYS.GMO_PROD_SHOP_ID),
      shopPass: props.getProperty(PROP_KEYS.GMO_PROD_SHOP_PASS),
      configId: props.getProperty(PROP_KEYS.GMO_PROD_CONFIG_ID),
      env: 'prod',
    };
  }
}

/**
 * 環境に応じた GMO エンドポイントを取得
 */
function getGmoEndpoints_() {
  return GMO_ENDPOINTS[getEnv_()];
}

/**
 * Sheets ID を取得
 */
function getSheetsId_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.SHEETS_ID);
  if (!id) throw new Error('SHEETS_ID プロパティが未設定です');
  return id;
}

/**
 * 内部共有シークレットを取得
 */
function getInternalSecret_() {
  const s = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.INTERNAL_SHARED_SECRET);
  if (!s) throw new Error('INTERNAL_SHARED_SECRET プロパティが未設定です');
  return s;
}
