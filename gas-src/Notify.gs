/**
 * Notify.gs
 * GMO-PG からの結果通知（プッシュ通知）を受信する
 *
 * GMO は決済完了/失敗時に加盟店指定URLへ form-urlencoded で POST する。
 * 通知される主なパラメータ:
 *   ShopID, OrderID, Status, JobCd, Amount, Tax, Currency,
 *   Forward, Method, PayTimes, TranID, Approve, TranDate,
 *   AccessID, AccessPass, ErrCode, ErrInfo, PayType
 *
 * 仕様: https://docs.mul-pay.jp/payment/notification （要ID/PW）
 */

/**
 * 結果通知を処理
 * @param {Object} params GMOから送られてきたパラメータ
 * @returns {{ok: boolean, error?: string}}
 */
function processNotification_(params) {
  // 1. 必須パラメータの存在チェック
  const orderId = params.OrderID;
  const shopId = params.ShopID;
  const status = params.Status;
  const amount = params.Amount;

  if (!orderId || !shopId) {
    return { ok: false, error: 'OrderIDまたはShopIDが欠落しています' };
  }

  // 2. ShopID の検証（自店舗宛の通知か）
  const cred = getGmoCredentials_();
  if (shopId !== cred.shopId) {
    console.warn(`[Notify] ShopID不一致: 受信=${shopId} 期待=${cred.shopId}`);
    return { ok: false, error: 'ShopIDが一致しません' };
  }

  // 3. Sheets から該当行を検索
  const orderRow = findOrderRowByOrderId_(orderId);
  if (!orderRow) {
    console.warn(`[Notify] OrderIDがSheetsに見つかりません: ${orderId}`);
    return { ok: false, error: '該当注文が見つかりません: ' + orderId };
  }

  // 4. 金額検証
  const expectedAmount = parseInt(orderRow.amount, 10);
  const receivedAmount = parseInt(amount, 10);
  if (Number.isFinite(expectedAmount) && expectedAmount !== receivedAmount) {
    console.warn(`[Notify] 金額不一致: 期待=${expectedAmount} 受信=${receivedAmount}`);
    return { ok: false, error: `金額不一致 expected=${expectedAmount} received=${receivedAmount}` };
  }

  // 5. ステータスを変換（GMO Status → 内部ステータス）
  const internalStatus = mapGmoStatusToInternal_(status, params);

  // 6. Sheets を更新
  updateOrderRow_(orderRow.rowIndex, {
    status: internalStatus,
    paidAt: new Date(),
    tranId: params.TranID || '',
    accessId: params.AccessID || '',
    errorCode: params.ErrCode || '',
  });

  // 7. 通知（任意：ChatWork等）
  if (internalStatus === STATUS.CAPTURE || internalStatus === STATUS.AUTH) {
    notifyPaymentSuccess_({
      issueId: orderRow.issueId,
      orderId,
      amount: receivedAmount,
      customerName: orderRow.customerName,
      free1: orderRow.free1,
      tranId: params.TranID || '',
    });
  }

  return { ok: true };
}

/**
 * GMO Status を内部ステータスに変換
 *
 * GMO Status の代表例:
 *   AUTH       - 仮売上
 *   CAPTURE    - 即時売上
 *   SALES      - 実売上
 *   VOID       - 取消
 *   RETURN     - 返品
 *   CANCEL     - キャンセル
 *   UNPROCESSED- 未決済
 *   AUTHENTICATED - 3DS認証済
 *   PAYFAIL    - 支払失敗
 */
function mapGmoStatusToInternal_(gmoStatus, params) {
  if (!gmoStatus) return STATUS.ERROR;
  const s = gmoStatus.toUpperCase();

  if (params.ErrCode) return STATUS.ERROR;
  if (s === 'CAPTURE' || s === 'SALES') return STATUS.CAPTURE;
  if (s === 'AUTH') return STATUS.AUTH;
  if (s === 'VOID' || s === 'CANCEL' || s === 'RETURN') return STATUS.CANCEL;
  if (s === 'PAYFAIL') return STATUS.ERROR;

  // 未知ステータスはそのまま記録
  return s;
}

/**
 * 決済成功時の通知（任意機能）
 */
function notifyPaymentSuccess_(info) {
  try {
    sendChatWorkNotification_(
      `[info][title]💴 決済完了[/title]` +
      `お客様: ${info.customerName || '(未入力)'}\n` +
      `内容: ${info.free1 || '(なし)'}\n` +
      `金額: ${info.amount.toLocaleString()}円\n` +
      `OrderID: ${info.orderId}\n` +
      `TranID: ${info.tranId}\n` +
      `[/info]`
    );
  } catch (err) {
    console.error('[Notify] ChatWork通知失敗:', err);
    // 通知失敗は通知処理本体には影響させない
  }
}
