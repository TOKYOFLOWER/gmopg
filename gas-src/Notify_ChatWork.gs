/**
 * Notify_ChatWork.gs
 * ChatWork 通知（任意機能）
 *
 * スクリプトプロパティに CHATWORK_TOKEN と CHATWORK_ROOM_ID が設定されていれば動作。
 * 未設定なら何もしない（エラーにしない）。
 */

/**
 * ChatWork に通知メッセージを送る
 * @param {string} message
 * @returns {boolean} 送信したかどうか
 */
function sendChatWorkNotification_(message) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty(PROP_KEYS.CHATWORK_TOKEN);
  const roomId = props.getProperty(PROP_KEYS.CHATWORK_ROOM_ID);

  if (!token || !roomId) {
    console.log('[ChatWork] token または room_id が未設定。通知スキップ');
    return false;
  }

  const url = `https://api.chatwork.com/v2/rooms/${roomId}/messages`;
  const options = {
    method: 'post',
    headers: { 'X-ChatWorkToken': token },
    payload: { body: message },
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code !== 200) {
      console.warn('[ChatWork] 通知失敗: HTTP', code, response.getContentText());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[ChatWork] 通知エラー:', err);
    return false;
  }
}
