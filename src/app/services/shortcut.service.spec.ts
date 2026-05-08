import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ShortcutService } from './shortcut.service';

describe('ShortcutService', () => {
  const storageKey = 'devbreak-shortcuts';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('recovers defaults from corrupted storage', () => {
    localStorage.setItem(storageKey, '{bad json');

    const service = new ShortcutService();

    expect(service.getCombo('createTask')).toBe('N');
    expect(service.getCombo('escapeModal')).toBe('Escape');
  });

  it('persists custom shortcuts and restores them', () => {
    const service = new ShortcutService();

    const result = service.setShortcut('createTask', 'Control+K');
    const restored = new ShortcutService();

    expect(result.valid).toBe(true);
    expect(restored.getCombo('createTask')).toBe('Control+K');
  });

  it('prevents duplicate shortcuts', () => {
    const service = new ShortcutService();

    const result = service.setShortcut('search', 'N');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Create task');
  });

  it('rejects reserved and weak action combos', () => {
    const service = new ShortcutService();

    expect(service.setShortcut('createTask', 'Control+S').valid).toBe(false);
    expect(service.setShortcut('save', 'K').valid).toBe(false);
    expect(service.setShortcut('escapeModal', 'K').valid).toBe(false);
  });

  it('matches keyboard events against configured shortcuts', () => {
    const service = new ShortcutService();

    service.setShortcut('toggleFocusPanel', 'Control+F');

    expect(service.matches(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }), 'toggleFocusPanel')).toBe(true);
    expect(service.matches(new KeyboardEvent('keydown', { key: 'f' }), 'toggleFocusPanel')).toBe(false);
  });
});
