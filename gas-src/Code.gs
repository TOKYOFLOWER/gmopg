/**
 * Code.gs
 * GAS WebApp のエントリポイント
 *
 * このGAS WebAppは2つのエンドポイントを兼ねる：
 *  ・?action=issue   … 社内発行ページからの決済URL発行リクエスト（POSTのみ）
 *  ・?action=notify  … GMO-PG からの結果通知受信（POST、GMO仕様）
 *
 * デプロイ後のURL:
 *   https://script.google.com/macros/s/AKfyc...XXX/exec?action=issue
 *   https://script.google.com/macros/s/AKfyc...XXX/exec?action=notify
 */

/**
 * GET リクエストのハンドラ
 * ヘルスチェックとデバッグ用途
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'health';

    if (action === 'health') {
      return jsonResponse_({
        ok: true,
        service: 'GMO-PG リンクタイプPlus 決済URL発行システム',
        env: getEnv_(),
        time: new Date().toISOString(),
      });
    }

    return jsonResponse_({ ok: false, error: 'unknown action for GET' }, 400);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) }, 500);
  }
}

/**
 * POST リクエストのハンドラ
 */
function doPost(e) {
  const action = (e && e.parameter && e.parameter.action) || '';

  try {
    if (action === 'issue') {
      return handleIssue_(e);
    }
    if (action === 'notify') {
      return handleNotify_(e);
    }
    return jsonResponse_({ ok: false, error: `unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('doPost error:', err, err.stack);
    auditLog_(AUDIT_ACTION.ISSUE_ERROR, 'system', '', '', { error: String(err), action });
    return jsonResponse_({ ok: false, error: String(err) }, 500);
  }
}

/**
 * 社内発行ページからのPOSTを処理
 */
function handleIssue_(e) {
  // 1. 内部認証
  const authResult = verifyInternalRequest_(e);
  if (!authResult.ok) {
    auditLog_(AUDIT_ACTION.AUTH_FAIL, 'unknown', getClientIp_(e), getUserAgent_(e), {
      reason: authResult.reason,
    });
    return jsonResponse_({ ok: false, error: 'authentication failed' }, 403);
  }

  // 2. リクエストボディのパース
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'invalid JSON body' }, 400);
  }

  auditLog_(AUDIT_ACTION.ISSUE_REQUEST, body.staffName || 'unknown',
            getClientIp_(e), getUserAgent_(e), { body });

  // 3. バリデーション
  const validated = validateIssueParams_(body);
  if (!validated.ok) {
    return jsonResponse_({ ok: false, error: validated.error }, 400);
  }

  // 4. 発行処理
  const result = issuePayment_(validated.params);

  if (result.ok) {
    auditLog_(AUDIT_ACTION.ISSUE_SUCCESS, body.staffName || 'unknown',
              getClientIp_(e), getUserAgent_(e), {
                issueId: result.issueId,
                orderId: result.orderId,
              });
  } else {
    auditLog_(AUDIT_ACTION.ISSUE_ERROR, body.staffName || 'unknown',
              getClientIp_(e), getUserAgent_(e), { error: result.error });
  }

  return jsonResponse_(result, result.ok ? 200 : 500);
}

/**
 * GMO からの結果通知を処理
 */
function handleNotify_(e) {
  const params = e.parameter || {};
  const ip = getClientIp_(e);

  auditLog_(AUDIT_ACTION.NOTIFY_RECEIVED, 'GMO', ip, getUserAgent_(e), { params });

  const result = processNotification_(params);

  if (result.ok) {
    auditLog_(AUDIT_ACTION.NOTIFY_VERIFIED, 'GMO', ip, '', { orderId: params.OrderID });
    // GMO は HTTP 200 + 任意のテキストで通知の成功を判定する
    return ContentService.createTextOutput('OK');
  } else {
    auditLog_(AUDIT_ACTION.NOTIFY_FAILED, 'GMO', ip, '', { error: result.error });
    // 失敗時もHTTP 200を返さないとGMOが再送し続けるが、検証失敗は記録に残す
    return ContentService.createTextOutput('NG: ' + result.error);
  }
}

/**
 * JSON レスポンスを返す
 */
function jsonResponse_(obj, statusCode) {
  // GAS WebApp は HTTPステータスコードを直接制御できない。
  // 代わりに JSONボディに ok/error を入れてフロントで判定する。
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * クライアントIPを取得（GASでは取得困難なので best-effort）
 */
function getClientIp_(e) {
  if (e && e.parameter && e.parameter.clientIp) return e.parameter.clientIp;
  return '';
}

/**
 * UserAgentを取得（GASでは取得困難なので best-effort）
 */
function getUserAgent_(e) {
  if (e && e.parameter && e.parameter.ua) return e.parameter.ua;
  return '';
}

// ============================================================
// テスト用関数（GASエディタから手動実行）
// ============================================================

/**
 * 決済URL生成のみをテスト（API呼び出しなし、Sheets書込なし）
 * 生成されたURLをログに出力する。ブラウザで開いて GMO 決済画面が出ればOK。
 */
function testBuildUrl() {
  const cred = getGmoCredentials_();
  const orderId = generateOrderId_();
  const url = buildLinkplusParameterUrl_({
    shopId: cred.shopId,
    shopPass: cred.shopPass,
    configId: cred.configId,
    orderId,
    amount: 100,
    overview: '銀座東京フラワー: テスト発行',
  });
  console.log('env:', cred.env);
  console.log('orderId:', orderId);
  console.log('linkUrl:', url);
  return url;
}

/**
 * テスト発行。GAS エディタで関数選択 → 実行
 */
function testIssue() {
  const result = issuePayment_({
    customerName: 'テスト太郎',
    customerEmail: '',
    amount: 100,
    free1: 'テスト発行',
    free2: '',
    memo: 'GAS疎通テスト',
    expiryHours: 24,
    staffName: 'システム',
  });
  console.log(JSON.stringify(result, null, 2));
}

/**
 * テスト通知受信のシミュレーション
 */
function testNotify() {
  const fakeParams = {
    ShopID: getGmoCredentials_().shopId,
    OrderID: '20260505000000-0001',
    Status: 'CAPTURE',
    JobCd: 'CAPTURE',
    Amount: '100',
    Tax: '0',
    Currency: 'JPN',
    TranID: 'test-tran-id-001',
    AccessID: 'test-access-id-001',
    AccessPass: 'dummy',
    TranDate: Utilities.formatDate(new Date(), 'JST', 'yyyyMMddHHmmss'),
    PayType: '0',
    Approve: '0000000',
    ErrCode: '',
    ErrInfo: '',
  };
  const result = processNotification_(fakeParams);
  console.log(JSON.stringify(result, null, 2));
}

/**
 * 設定値の確認用
 */
function showProperties() {
  const props = PropertiesService.getScriptProperties().getProperties();
  // パスワード系はマスク
  const masked = {};
  Object.keys(props).forEach(k => {
    if (k.includes('PASS') || k.includes('SECRET') || k.includes('TOKEN')) {
      masked[k] = props[k] ? '****(set)' : '(empty)';
    } else {
      masked[k] = props[k] || '(empty)';
    }
  });
  console.log(JSON.stringify(masked, null, 2));
}
