'use client';

import { useState } from 'react';

export type BookBrief = { id: number; name: string; chapters: number; testament: string };

export default function BookPicker({
  books,
  current,
  onPick,
  onClose,
  title = '选择经卷',
}: {
  books: BookBrief[];
  current: { book: number; chapter: number };
  onPick: (book: number, chapter: number) => void;
  onClose: () => void;
  title?: string;
}) {
  const [sel, setSel] = useState(current.book);
  const book = books.find((b) => b.id === sel);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/35 fade-in" onClick={onClose} />
      <div className="sheet z-40 flex max-h-[80vh] flex-col">
        <div className="px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <p className="mb-2 text-[15px] font-semibold">{title}</p>
        </div>
        <div className="flex min-h-0 flex-1">
          <ul className="w-[40%] overflow-y-auto border-r border-line no-bar">
            {(['OT', 'NT'] as const).map((t) => (
              <li key={t}>
                <p className="sticky top-0 bg-brand-50 px-4 py-1.5 text-[11px] font-medium text-brand-700">
                  {t === 'OT' ? '旧约' : '新约'}
                </p>
                {books
                  .filter((b) => b.testament === t)
                  .map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSel(b.id)}
                      className={`block w-full px-4 py-2.5 text-left text-sm ${
                        sel === b.id ? 'bg-brand-100 font-medium text-brand-700' : 'text-ink'
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
          <div className="flex-1 overflow-y-auto p-3 no-bar">
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: book?.chapters ?? 0 }, (_, i) => i + 1).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onPick(sel, c)}
                  className={`aspect-square rounded-lg border text-sm ${
                    sel === current.book && c === current.chapter
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-line text-ink'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
