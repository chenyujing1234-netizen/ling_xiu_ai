/** 是否微信内置浏览器 */
export function isWeChatBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** 能否用 MediaRecorder + getUserMedia 在页内录音 */
export function canUseInPageRecorder() {
  if (typeof window === 'undefined') return false;
  if (typeof MediaRecorder === 'undefined') return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  // 微信 iOS 内核长期不支持可用的 MediaRecorder，改走系统录音文件
  if (isWeChatBrowser() && isIOS()) return false;
  return true;
}
