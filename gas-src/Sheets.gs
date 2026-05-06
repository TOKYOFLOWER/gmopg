/**
 * Sheets.gs
 * Google Sheets 操作ヘルパー
 */

/**
 * Sheets を開く
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function openSheets_() {
  return SpreadsheetApp.openById(getSheetsId_());
}

function getOrdersSheet_() {
  const sheet = openSheets_().getSheetByName(SHEET_NAMES.ORDERS);
  if (!sheet) throw new Error(`シート "${SHEET_NAMES.ORDERS}" が見つかりません`);
  return sheet;
}

function getSettingsSheet_() {
  const sheet = openSheets_().getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) throw new Error(`シート "${SHEET_NAMES.SETTINGS}" が見つかりません`);
  return sheet;
}

function getAuditSheet_() {
  const sheet = openSheets_().getSheetByName(SHEET_NAMES.AUDIT);
  if (!sheet) throw new Error(`シート "${SHEET_NAMES.AUDIT}" が見つかりません`);
  return sheet;
}

function getProductMasterSheet_() {
  return openSheets_().getSheetByName(SHEET_NAMES.PRODUCT_MASTER);
}

/**
 * Orders シートに新規行を追加
 */
function appendOrderRow_(data) {
  const sheet = getOrdersSheet_();
  const row = [
    data.issueId,
    Utilities.formatDate(data.issuedAt, 'JST', 'yyyy-MM-dd HH:mm:ss'),
    data.env,
    data.staffName || '',
    data.customerName || '',
    data.customerEmail || '',
    data.amount,
    data.free1 || '',
    data.free2 || '',
    data.memo || '',
    data.orderId,
    data.linkUrl || '',
    Utilities.formatDate(data.expiry, 'JST', 'yyyy-MM-dd HH:mm:ss'),
    data.status,
    '', // 決済日時（後で更新）
    '', // TranID
    '', // AccessID
    data.errorCode || '',
    '', // 備考
  ];
  sheet.appendRow(row);
}

/**
 * OrderID から行を検索
 *  K列(11列目)に OrderID が入っている前提
 *
 * @param {string} orderId
 * @returns {Object | null}
 */
function findOrderRowByOrderId_(orderId) {
  const sheet = getOrdersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  // OrderID列(K列=11)を一括取得
  const orderIds = sheet.getRange(2, ORDERS_COLS.ORDER_ID, lastRow - 1, 1).getValues();
  for (let i = 0; i < orderIds.length; i++) {
    if (String(orderIds[i][0]) === String(orderId)) {
      const rowIndex = i + 2; // ヘッダ込みで +2
      const rowValues = sheet.getRange(rowIndex, 1, 1, ORDERS_COLS.REMARKS).getValues()[0];
      return {
        rowIndex,
        issueId: rowValues[ORDERS_COLS.ISSUE_ID - 1],
        issuedAt: rowValues[ORDERS_COLS.ISSUED_AT - 1],
        env: rowValues[ORDERS_COLS.ENV - 1],
        staffName: rowValues[ORDERS_COLS.STAFF_NAME - 1],
        customerName: rowValues[ORDERS_COLS.CUSTOMER_NAME - 1],
        customerEmail: rowValues[ORDERS_COLS.CUSTOMER_EMAIL - 1],
        amount: rowValues[ORDERS_COLS.AMOUNT - 1],
        free1: rowValues[ORDERS_COLS.FREE1 - 1],
        free2: rowValues[ORDERS_COLS.FREE2 - 1],
        memo: rowValues[ORDERS_COLS.MEMO - 1],
        orderId: rowValues[ORDERS_COLS.ORDER_ID - 1],
        linkUrl: rowValues[ORDERS_COLS.LINK_URL - 1],
        status: rowValues[ORDERS_COLS.STATUS - 1],
      };
    }
  }
  return null;
}

/**
 * Orders シートの行を更新（決済結果反映）
 */
function updateOrderRow_(rowIndex, update) {
  const sheet = getOrdersSheet_();
  if (update.status !== undefined) {
    sheet.getRange(rowIndex, ORDERS_COLS.STATUS).setValue(update.status);
  }
  if (update.paidAt !== undefined) {
    sheet.getRange(rowIndex, ORDERS_COLS.PAID_AT).setValue(
      Utilities.formatDate(update.paidAt, 'JST', 'yyyy-MM-dd HH:mm:ss')
    );
  }
  if (update.tranId !== undefined) {
    sheet.getRange(rowIndex, ORDERS_COLS.TRAN_ID).setValue(update.tranId);
  }
  if (update.accessId !== undefined) {
    sheet.getRange(rowIndex, ORDERS_COLS.ACCESS_ID).setValue(update.accessId);
  }
  if (update.errorCode !== undefined) {
    sheet.getRange(rowIndex, ORDERS_COLS.ERROR_CODE).setValue(update.errorCode);
  }
}

/**
 * Settings シートから設定値を取得
 *
 * @param {string} key
 * @returns {string}
 */
function getSetting_(key) {
  const sheet = getSettingsSheet_();
  if (!sheet) return '';
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';
  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (const [k, v] of values) {
    if (String(k) === key) return String(v);
  }
  return '';
}

/**
 * Settings の STAFF_LIST（カンマ区切り）を配列で返す
 */
function getStaffList_() {
  const raw = getSetting_('STAFF_LIST') || '';
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * 監査ログに記録
 */
function auditLog_(action, actor, ip, ua, details) {
  try {
    const sheet = getAuditSheet_();
    sheet.appendRow([
      Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd HH:mm:ss.SSS'),
      action,
      actor || '',
      ip || '',
      ua || '',
      details ? JSON.stringify(details).substring(0, 5000) : '',
    ]);
  } catch (err) {
    // 監査ログの書き込み失敗は無視（メイン処理に影響させない）
    console.error('auditLog failed:', err);
  }
}

/**
 * ProductMaster から商品コードで検索（任意機能）
 */
function findProduct_(productCode) {
  const sheet = getProductMasterSheet_();
  if (!sheet) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (const [code, name, price, active] of values) {
    if (String(code) === productCode && active === true) {
      return { code, name, price: parseInt(price, 10) };
    }
  }
  return null;
}
