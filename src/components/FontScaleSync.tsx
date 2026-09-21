'use client';

import { useEffect } from 'react';
import { applyFontScaleClient, normalizeFontScale } from '@/lib/font-scale';

/** 主站 layout 传入账号字号档位，与 cookie 对齐 */
export default function FontScaleSync({ fontScale }: { fontScale: string }) {
  useEffect(() => {
    applyFontScaleClient(normalizeFontScale(fontScale));
  }, [fontScale]);
  return null;
}
