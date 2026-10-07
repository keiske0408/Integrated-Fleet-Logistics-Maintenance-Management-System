import type { FormDefinition, FormWorkflow } from './types';

export interface EditorSnapshot {
  definition: FormDefinition;
  workflow: FormWorkflow;
}

export interface EditorHistory {
  past: EditorSnapshot[];
  present: EditorSnapshot;
  future: EditorSnapshot[];
}

export type EditorHistoryAction =
  | { type: 'edit'; snapshot: EditorSnapshot }
  | { type: 'update'; update: (snapshot: EditorSnapshot) => EditorSnapshot }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; snapshot: EditorSnapshot }
  | { type: 'replace-present'; update: (snapshot: EditorSnapshot) => EditorSnapshot };

const MAX_HISTORY = 50;

function snapshotsEqual(left: EditorSnapshot, right: EditorSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createEditorHistory(snapshot: EditorSnapshot): EditorHistory {
  return { past: [], present: snapshot, future: [] };
}

export function editorHistoryReducer(
  history: EditorHistory,
  action: EditorHistoryAction,
): EditorHistory {
  if (action.type === 'reset') return createEditorHistory(action.snapshot);
  if (action.type === 'replace-present')
    return { ...history, present: action.update(history.present) };
  if (action.type === 'undo') {
    if (history.past.length === 0) return history;
    return {
      past: history.past.slice(0, -1),
      present: history.past[history.past.length - 1],
      future: [history.present, ...history.future],
    };
  }
  if (action.type === 'redo') {
    if (history.future.length === 0) return history;
    return {
      past: [...history.past, history.present].slice(-MAX_HISTORY),
      present: history.future[0],
      future: history.future.slice(1),
    };
  }
  if (action.type === 'undo' || action.type === 'redo') return history;
  const snapshot = action.type === 'update' ? action.update(history.present) : action.snapshot;
  if (snapshotsEqual(history.present, snapshot)) return history;
  return {
    past: [...history.past, history.present].slice(-MAX_HISTORY),
    present: snapshot,
    future: [],
  };
}
