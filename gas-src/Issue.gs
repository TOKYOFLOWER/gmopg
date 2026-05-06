/**
 * Issue.gs
 * 決済URL発行ロジック
 */

/**
 * 発行リクエストのパラメータをバリデーション
 *
 * @param {Object} body リクエストボディ
 * @returns {{ok: boolean, error?: string, params?: Object}}
 */
function validateIssueParams_(body) {
  if (!body) return { ok: false, error: 'request body is empty' };

  const customerName = (body.customerName || '').toString().trim();
  const customerEmail = (body.customerEmail || '').toString().trim();
  const amount = parseInt(body.amount, 10);
  const free1 = (body.free1 || '').toString().trim();
  const free2 = (body.free2 || '').toString().trim();
  const memo = (body.memo || '').toString().trim();
  const expiryHours = parseInt(body.expiryHours, 10) || 168; // デフォルト7日
  const staffName = (body.staffName || '').toString().trim();

  // 必須チェック
  if (!staffName) return { ok: false, error: 'スタッフ名は必須です' };
  if (!Number.isFinite(amount) || amount < 1) {
    return { ok: false, error: '金額は1円以上の整数で指定してください' };
  }
  if (amount > 9999999) {
    return { ok: false, error: '金額が大きすぎます（最大999万9999円）' };
  }
  if (expiryHours < 1 || expiryHours > 24 * 30) {
    return { ok: false, error: '有効期限は1時間〜30日（720時間）の範囲で指定してください' };
  }
  if (customerEmail && !isValidEmail_(customerEmail)) {
    return { ok: false, error: 'お客様メールの形式が不正です' };
  }
  if (customerName.length > 100) return { ok: false, error: 'お客様名が長すぎます' };
  if (free1.length > 100) return { ok: false, error: '自由項目1が長すぎます' };
  if (free2.length > 100) return { ok: false, error: '自由項目2が長すぎます' };
  if (memo.length > 500) return { ok: false, error: 'メモが長すぎます' };

  return {
    ok: true,
    params: {
      customerName,
      customerEmail,
      amount,
      free1,
      free2,
      memo,
      expiryHours,
      staffName,
    },
  };
}

function isValidEmail_(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * 決済URLを発行する
 *
 * @param {Object} params バリデーション済みのパラメータ
 * @returns {{ok: boolean, error?: string, issueId?: string, orderId?: string,
 *            linkUrl?: string, expiry?: string}}
 */
function issuePayment_(params) {
  const cred = getGmoCredentials_();

  // 1. 発行ID と OrderID を採番
  const issueId = Utilities.getUuid();
  const orderId = generateOrderId_();
  const issuedAt = new Date();
  const expiry = new Date(issuedAt.getTime() + params.expiryHours * 60 * 60 * 1000);

  // 2. Overview を組み立て（free1 があれば連結。Free1〜Free3 の正式な配置場所が確定するまでの暫定対応）
  const shopName = getSetting_('SHOP_DISPLAY_NAME') || '銀座東京フラワー';
  const overview = params.free1 ? `${shopName}: ${params.free1}` : shopName;

  // 3. パラメータ型 決済URL を加盟店側で組み立て（API 呼び出しなし、同期）
  const linkUrl = buildLinkplusParameterUrl_({
    shopId: cred.shopId,
    shopPass: cred.shopPass,
    configId: cred.configId,
    orderId,
    amount: params.amount,
    overview,
  });

  // 4. Sheets に行追加
  appendOrderRow_({
    issueId,
    issuedAt,
    env: cred.env,
    staffName: params.staffName,
    customerName: params.customerName,
    customerEmail: params.customerEmail,
    amount: params.amount,
    free1: params.free1,
    free2: params.free2,
    memo: params.memo,
    orderId,
    linkUrl,
    expiry,
    status: STATUS.ISSUED,
  });

  // 5. メール文面生成（フロントに返す）
  const mailTemplate = generateMailTemplate_({
    customerName: params.customerName,
    amount: params.amount,
    free1: params.free1,
    linkUrl,
    expiry,
  });

  return {
    ok: true,
    issueId,
    orderId,
    linkUrl,
    expiry: Utilities.formatDate(expiry, 'JST', 'yyyy-MM-dd HH:mm'),
    mailTemplate,
  };
}

/**
 * OrderID を採番
 *  形式: yyyyMMddHHmmss-XXXX (XXXX は 4桁のランダム)
 *  GMO の OrderID 制約: 1〜27桁、半角英数字 + ハイフン + アンダースコア
 */
function generateOrderId_() {
  const ts = Utilities.formatDate(new Date(), 'JST', 'yyyyMMddHHmmss');
  const rand = Math.floor(1000 + Math.random() * 9000); // 1000-9999
  return `${ts}-${rand}`;
}

/**
 * メール文面テンプレートを生成
 */
function generateMailTemplate_({ customerName, amount, free1, linkUrl, expiry }) {
  const shopName = getSetting_('SHOP_DISPLAY_NAME') || '銀座東京フラワー';
  const shopPhone = getSetting_('SHOP_CONTACT_PHONE') || '';
  const shopEmail = getSetting_('SHOP_CONTACT_EMAIL') || '';
  const expiryStr = Utilities.formatDate(expiry, 'JST', 'yyyy年MM月dd日 HH:mm');
  const namePart = customerName ? `${customerName} 様` : 'お客様';
  const free1Part = free1 ? `ご注文内容: ${free1}\n` : '';

  return `${namePart}

平素より${shopName}をご愛顧いただき、誠にありがとうございます。

ご注文いただきました内容のお支払いについて、下記URLよりお手続きをお願いいたします。

----------------------------------------
${free1Part}お支払金額: ${amount.toLocaleString()}円
お支払期限: ${expiryStr}
お支払いURL: ${linkUrl}
----------------------------------------

ご不明な点がございましたら、下記までお問い合わせください。

${shopName}
${shopPhone ? 'TEL: ' + shopPhone + '\n' : ''}${shopEmail ? 'Email: ' + shopEmail : ''}
`;
}
