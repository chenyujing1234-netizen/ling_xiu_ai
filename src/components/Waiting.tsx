'use client';

import { useEffect, useState } from 'react';

/**
 * AI 单次调用实测 20-70 秒（推理模型思考本身就很花时间）。
 * 静态的"加载中"会让人以为卡死，所以把已等待秒数显示出来。
 */
export default function Waiting({ text, expect }: { text: string; expect?: string }) {
  const [sec, setSec] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-brand-300"
            style={{ animation: `dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
      <p className="text-sm text-muted">{text}</p>
      <p className="mt-1 text-xs text-muted/80">
        已等待 {sec} 秒{expect ? ` · ${expect}` : ''}
      </p>
    </div>
  );
}
