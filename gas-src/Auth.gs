/**
 * Auth.gs
 * 内部認証
 *
 * 社内発行ページからのリクエストを認証する。
 * ・共有シークレット（HMAC-SHA256 でリクエストボディに署名）
 * ・タイムスタンプチェック（5分以内）
 *
 * フロント側の実装:
 *   const ts = Date.now().toString();
 *   const body = JSON.stringify(payload);
 *   const sig = await hmacSha256(secret, ts + '.' + body);
 *   fetch(GAS_ENDPOINT + '?action=issue', {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       'X-Timestamp': ts,
 *       'X-Signature': sig,
 *     },
 *     body,
 *   });
 *
 * 注意: GAS WebApp では Content-Type を application/json にすると
 *      e.parameter にタイムスタンプ・署名が入らない。
 *      回避策として querystring (?ts=...&sig=...) で送る方式も用意。
 */

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5分

/**
 * 内部リクエストを検証
 *
 * 検証方式（OR）:
 *   方式A: X-Timestamp + X-Signature ヘッダ（GAS の e.parameter で取得不可なため、
 *          実際にはクエリパラメータ ?ts=...&sig=... で代用）
 *   方式B: シンプルな共有シークレット一致（開発・初期運用向け）
 *
 * @param {Object} e doPost の e オブジェクト
 * @returns {{ok: boolean, reason?: string}}
 */
function verifyInternalRequest_(e) {
  const params = e.parameter || {};
  const expectedSecret = getInternalSecret_();

  // 方式B: シンプルな共有シークレット
  // クエリパラメータ ?secret=XXX で送る（HTTPS 前提なので運用上問題なし）
  if (params.secret) {
    if (timingSafeEqual_(params.secret, expectedSecret)) {
      return { ok: true };
    }
    return { ok: false, reason: 'secret mismatch' };
  }

  // 方式A: 署名付き
  const ts = params.ts;
  const sig = params.sig;
  const body = e.postData ? e.postData.contents : '';

  if (!ts || !sig) {
    return { ok: false, reason: 'missing ts or sig' };
  }

  // タイムスタンプチェック
  const tsNum = parseInt(ts, 10);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: 'invalid ts' };
  const drift = Math.abs(Date.now() - tsNum);
  if (drift > TIMESTAMP_TOLERANCE_MS) {
    return { ok: false, reason: 'timestamp out of range: drift=' + drift + 'ms' };
  }

  // 署名検証
  const message = `${ts}.${body}`;
  const expectedSig = computeHmacSha256_(expectedSecret, message);
  if (!timingSafeEqual_(sig, expectedSig)) {
    return { ok: false, reason: 'signature mismatch' };
  }

  return { ok: true };
}

/**
 * HMAC-SHA256 を 16進文字列で計算
 */
function computeHmacSha256_(secret, message) {
  const sigBytes = Utilities.computeHmacSha256Signature(message, secret);
  return sigBytes.map(b => {
    const v = (b < 0 ? b + 256 : b);
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

/**
 * タイミング攻撃耐性のある文字列比較
 */
function timingSafeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
