/** 页内开麦记笔记 / 口述时占用计数，用于后台任务完成时不自动弹结果 */
let depth = 0;

export function noteRecordingEntered() {
  depth += 1;
}

export function noteRecordingLeft() {
  depth = Math.max(0, depth - 1);
}

export function shouldDeferBackgroundJobPresent() {
  return depth > 0;
}
