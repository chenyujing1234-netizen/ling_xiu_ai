'use client';

import type { ReactNode } from 'react';
import DevotionSpotlightTour from './DevotionSpotlightTour';

/** 灵修列表页：首次登录蒙层高亮指引 */
export default function DevotionListGuide({
  showTour,
  unlockScore,
  children,
}: {
  showTour: boolean;
  unlockScore: number;
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <DevotionSpotlightTour show={showTour} unlockScore={unlockScore} />
    </>
  );
}
