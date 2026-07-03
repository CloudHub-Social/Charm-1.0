import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { getMobileSheetHeights } from './mobileSheetHeights';
import type { EmojiBoardTab } from './types';

// Extracted from EmojiBoard so the "when does the sheet height recompute"
// behavior has direct unit coverage instead of only being reachable through
// simulated pointer events on the full component tree (same rationale as
// mobileSheetHeights.ts / mobileSheetDismiss.ts).
export function useMobileSheetHeight(
  isMobileSheet: boolean,
  active: boolean,
  activeTab: EmojiBoardTab
): [
  number | undefined,
  Dispatch<SetStateAction<number | undefined>>,
  MutableRefObject<number | undefined>,
] {
  const [mobileSheetHeight, setMobileSheetHeight] = useState<number>();
  const mobileSheetHeightRef = useRef(mobileSheetHeight);
  mobileSheetHeightRef.current = mobileSheetHeight;

  // Only recompute the initial height while the sheet is active (open).
  // EmojiBoard stays mounted (just hidden) between opens, and dismissing via
  // drag doesn't change activeTab or isMobileSheet -- depending only on those
  // meant the dismiss handler had to synchronously reset the height itself
  // right before closing, which visibly snapped the sheet back up for a
  // frame. Depending on `active` instead means a fresh initial height is
  // computed the next time the sheet actually opens, and the dismiss path no
  // longer needs to touch the height at all.
  useEffect(() => {
    if (!isMobileSheet || !active) return undefined;

    const applyHeight = () => {
      const heights = getMobileSheetHeights(window.innerHeight, activeTab);
      setMobileSheetHeight(heights.initial);
    };

    applyHeight();
    window.addEventListener('resize', applyHeight);
    return () => window.removeEventListener('resize', applyHeight);
  }, [activeTab, isMobileSheet, active]);

  return [mobileSheetHeight, setMobileSheetHeight, mobileSheetHeightRef];
}
