import { create } from 'zustand';
import type { Weekday } from '@/domain/types';
import type { TaskInput } from '@/db/repo';

export const TABS = ['today', 'week', 'tasks'] as const;
export type Tab = (typeof TABS)[number];

export type Screen =
  | { name: 'tab' }
  | { name: 'settings' }
  | { name: 'timetable' }
  | { name: 'setup' };

export type Sheet =
  | { type: 'task'; taskId?: string; preset?: Partial<TaskInput> }
  | { type: 'lesson'; date: string; day: Weekday; period: number }
  | { type: 'subject'; subjectId: string };

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface UIState {
  tab: Tab;
  screens: Screen[];
  sheet: Sheet | null;
  /** Increments on every openSheet, so forms can reset per opening. */
  sheetSeq: number;
  toast: Toast | null;
  announcement: string;
  setTab: (tab: Tab) => void;
  push: (screen: Screen) => void;
  back: () => void;
  openSheet: (sheet: Sheet) => void;
  closeSheet: () => void;
  showToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id?: number) => void;
  announce: (message: string) => void;
}

let toastSeq = 0;

/**
 * Navigation is a tab plus a stack of pushed screens, mirrored into browser history so the
 * Android back button, browser back and swipe-back all behave.
 */
export const useUI = create<UIState>((set, get) => ({
  tab: readTab(),
  screens: [],
  sheet: null,
  sheetSeq: 0,
  toast: null,
  announcement: '',
  setTab: (tab) => {
    set({ tab, screens: [] });
    history.replaceState({ depth: 0 }, '', `#${tab}`);
  },
  push: (screen) => {
    const screens = [...get().screens, screen];
    set({ screens });
    history.pushState({ depth: screens.length }, '', location.hash);
  },
  back: () => {
    if (get().sheet) return get().closeSheet();
    if (get().screens.length) history.back();
  },
  openSheet: (sheet) => {
    const hadSheet = get().sheet != null;
    // A new context makes an earlier toast stale; it would also cover the sheet.
    set({ sheet, sheetSeq: get().sheetSeq + 1, toast: null });
    if (!hadSheet) history.pushState({ depth: get().screens.length, sheet: true }, '', location.hash);
  },
  closeSheet: () => {
    if (!get().sheet) return;
    set({ sheet: null });
    if ((history.state as { sheet?: boolean } | null)?.sheet) history.back();
  },
  showToast: (toast) => set({ toast: { ...toast, id: ++toastSeq } }),
  dismissToast: (id) => {
    const cur = get().toast;
    if (cur && (id == null || cur.id === id)) set({ toast: null });
  },
  announce: (message) => {
    // Clear first so repeating the same message is announced again.
    set({ announcement: '' });
    requestAnimationFrame(() => set({ announcement: message }));
  },
}));

function readTab(): Tab {
  if (typeof location === 'undefined') return 'today';
  const hash = location.hash.replace('#', '');
  return (TABS as readonly string[]).includes(hash) ? (hash as Tab) : 'today';
}

/** Keep the store in sync when the user navigates with system back/forward. */
export function bindHistory(): () => void {
  if (!history.state) history.replaceState({ depth: 0 }, '', location.hash || '#today');
  const onPop = (e: PopStateEvent) => {
    const state = (e.state ?? { depth: 0 }) as { depth?: number; sheet?: boolean };
    const ui = useUI.getState();
    if (ui.sheet && !state.sheet) {
      useUI.setState({ sheet: null });
    }
    const depth = state.depth ?? 0;
    if (ui.screens.length > depth) useUI.setState({ screens: ui.screens.slice(0, depth) });
  };
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}
