/** 任务已进后台后，下一帧收起弹层/阻塞 UI（便于先播放「扔进红点袋」动画） */
export function scheduleAutoBackgroundDismiss(dismiss?: () => void) {
  if (!dismiss) return;
  requestAnimationFrame(() => dismiss());
}
