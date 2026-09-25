'use client';

import ImageStylePicker, { usePreferredImageStyle } from './ImageStylePicker';

/** 设置页：默认配图风格（存于本机，与读经配图入口共用） */
export default function ImageStyleSettings() {
  const [style, setStyle] = usePreferredImageStyle();
  return (
    <section className="card px-4 py-4">
      <p className="label mb-1">意境配图风格</p>
      <p className="mb-3 text-xs font-medium text-muted">生成单节、选段或探索页配图时的默认风格</p>
      <ImageStylePicker value={style} onChange={setStyle} />
    </section>
  );
}
