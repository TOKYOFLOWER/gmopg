/**
 * GmoApi.gs
 * GMO-PG リンクタイプPlus パラメータ型 URL ビルダー
 *
 * 公式仕様:
 *   https://docs.gmo-pg.com/mulpay/docs/connection-method/link-type-plus/parameter-type
 *
 * URL 形式:
 *   {LINKPLUS_PARAMETER_BASE}{ShopID}/checkout/{base64Json}.{sha256Hash}
 *
 * 組み立て手順:
 *   1. JSON ({configid, transaction:{OrderID, Amount, Overview?}}) を生成
 *   2. JSON を UTF-8 → URL-safe Base64 エンコード（+→-, /→_）
 *   3. SHA256(base64 + ShopPass) を 16進小文字でハッシュ化
 *   4. URL = base + ShopID + "/checkout/" + base64 + "." + hash
 */

/**
 * パラメータ型 決済URLを加盟店側で組み立てる（API 呼び出しなし）
 *
 * @param {Object} args
 * @param {string} args.shopId   GMO ShopID
 * @param {string} args.shopPass GMO ShopPass（ハッシュ計算に使用）
 * @param {string} args.configId ConfigID
 * @param {string} args.orderId  店舗側で採番した OrderID
 * @param {number} args.amount   決済金額
 * @param {string} [args.overview] 任意。省略時は ConfigID 側のデフォルト
 * @returns {string} 決済URL
 */
function buildLinkplusParameterUrl_(args) {
  if (!args.shopId)   throw new Error('buildLinkplusParameterUrl_: shopId is required');
  if (!args.shopPass) throw new Error('buildLinkplusParameterUrl_: shopPass is required');
  if (!args.configId) throw new Error('buildLinkplusParameterUrl_: configId is required');
  if (!args.orderId)  throw new Error('buildLinkplusParameterUrl_: orderId is required');
  if (!Number.isFinite(args.amount) || args.amount < 1) {
    throw new Error('buildLinkplusParameterUrl_: amount must be a positive integer');
  }

  const transaction = {
    OrderID: args.orderId,
    Amount: args.amount,
  };
  if (args.overview) transaction.Overview = args.overview;

  const json = JSON.stringify({
    configid: args.configId,
    transaction,
  });

  // URL-safe Base64（+→-, /→_。末尾の '=' はそのまま許容される仕様）
  const base64 = Utilities.base64EncodeWebSafe(json, Utilities.Charset.UTF_8);

  // SHA256(base64 + ShopPass) → 16進小文字
  const digestBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    base64 + args.shopPass,
    Utilities.Charset.UTF_8
  );
  const hash = digestBytes
    .map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); })
    .join('');

  const base = getGmoEndpoints_().LINKPLUS_PARAMETER_BASE;
  const url = base + encodeURIComponent(args.shopId) + '/checkout/' + base64 + '.' + hash;

  console.log('[GMO Linkplus] payload JSON:', json);
  console.log('[GMO Linkplus] base64:', base64);
  console.log('[GMO Linkplus] URL:', url);

  return url;
}
