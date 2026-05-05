/**
 * GmoApi.gs
 * GMO-PG リンクタイプPlus API クライアント
 *
 * 仕様: https://docs.mul-pay.jp/linkplus/overview （要ID/PW）
 *
 * 主要API:
 *   GetLinkplusUrlPayment.json   - 決済URL取得
 *   RejectLinkplusUrlPayment.json - 決済URL無効化（任意）
 */

/**
 * 決済URL取得API を呼び出す
 *
 * @param {Object} args
 * @returns {{ok: boolean, linkUrl?: string, error?: string, errorCode?: string, raw?: Object}}
 */
function callGetLinkplusUrlPayment_(args) {
  const endpoints = getGmoEndpoints_();
  const url = endpoints.GET_LINKPLUS_URL_PAYMENT;

  // GMO仕様に従ったリクエストペイロード
  // ※ 仕様書（要ID/PW）を確認しながら必要に応じて調整
  const payload = {
    geturlparam: {
      ShopID: args.shopId,
      ShopPass: args.shopPass,
      // TemplateNo は必要に応じて。ConfigIDで代替できる場合は configid を使う
    },
    configid: args.configId,
    transaction: {
      OrderID: args.orderId,
      Amount: args.amount,
      // Tax は内税運用が一般的なので0でOK。別途分けたい場合は仕様書参照
      Tax: 0,
      // 全決済対応（ConfigID側で利用決済手段は制御）
      // PayMethods は省略すると ConfigID で許可された全決済が選べる
    },
    // 決済有効期限（YYYYMMDDHHmmss 形式）
    // GMO仕様で「validityPeriod」または同等のキーを使う。仕様書要確認。
    validityPeriod: Utilities.formatDate(args.expiry, 'JST', 'yyyyMMddHHmmss'),
  };

  // メールアドレスがあれば、GMOからの決済案内メール送付に使う（任意）
  if (args.customerEmail) {
    payload.transaction.MailAddress = args.customerEmail;
  }

  // 自由項目（Free01〜Free20 まで定義可能。GMO仕様）
  if (args.free1) payload.transaction.Free1 = args.free1;
  if (args.free2) payload.transaction.Free2 = args.free2;
  if (args.memo) payload.transaction.Free3 = args.memo;

  console.log('[GMO API] request:', JSON.stringify(payload));

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  let response;
  try {
    response = UrlFetchApp.fetch(url, options);
  } catch (err) {
    console.error('[GMO API] network error:', err);
    return { ok: false, error: `GMO API ネットワークエラー: ${err}` };
  }

  const code = response.getResponseCode();
  const text = response.getContentText('UTF-8');

  console.log('[GMO API] response code:', code);
  console.log('[GMO API] response body:', text);

  if (code !== 200) {
    return {
      ok: false,
      error: `GMO API HTTP ${code}: ${text}`,
      errorCode: 'HTTP_' + code,
    };
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: 'GMO API レスポンスがJSONでない: ' + text };
  }

  // GMOのエラー判定: ErrCode が空でなければエラー
  if (data.ErrCode || data.errCode) {
    const errCode = data.ErrCode || data.errCode;
    const errInfo = data.ErrInfo || data.errInfo || '';
    return {
      ok: false,
      error: `GMO エラー: ${errCode} ${errInfo}`,
      errorCode: errCode,
      raw: data,
    };
  }

  // 成功時: LinkUrl を取得
  const linkUrl = data.LinkUrl || data.linkUrl || (data.transaction && data.transaction.LinkUrl);
  if (!linkUrl) {
    return {
      ok: false,
      error: 'GMO レスポンスに LinkUrl が含まれていません: ' + text,
      raw: data,
    };
  }

  return {
    ok: true,
    linkUrl,
    raw: data,
  };
}

/**
 * 決済URL無効化API（任意機能：発行済URLを取り消す）
 */
function callRejectLinkplusUrlPayment_(orderId) {
  const endpoints = getGmoEndpoints_();
  const cred = getGmoCredentials_();

  const payload = {
    ShopID: cred.shopId,
    ShopPass: cred.shopPass,
    OrderID: orderId,
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(endpoints.REJECT_LINKPLUS_URL_PAYMENT, options);
  const code = response.getResponseCode();
  const text = response.getContentText('UTF-8');

  if (code !== 200) {
    return { ok: false, error: `HTTP ${code}: ${text}` };
  }

  const data = JSON.parse(text);
  if (data.ErrCode) {
    return { ok: false, error: `GMO: ${data.ErrCode} ${data.ErrInfo || ''}` };
  }
  return { ok: true };
}
