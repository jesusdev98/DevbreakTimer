import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ShortcutActionId =
  | 'createTask'
  | 'search'
  | 'save'
  | 'escapeModal'
  | 'toggleFocusPanel';

export interface ShortcutDefinition {
  action: ShortcutActionId;
  label: string;
  combo: string;
}

export interface ShortcutValidationResult {
  valid: boolean;
  message: string | null;
}

const STORAGE_KEY = 'devbreak-shortcuts';
const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta'];
const DEFAULT_SHORTCUTS: readonly ShortcutDefinition[] = [
  { action: 'createTask', label: 'Create task', combo: 'N' },
  { action: 'search', label: 'Search', combo: '/' },
  { action: 'save', label: 'Save', combo: 'Control+Enter' },
  { action: 'escapeModal', label: 'Escape modal', combo: 'Escape' },
  { action: 'toggleFocusPanel', label: 'Toggle focus panel', combo: 'F' },
];

@Injectable({
  providedIn: 'root',
})
export class ShortcutService {
  private shortcuts = this.restoreShortcuts();
  private readonly shortcutsSubject = new BehaviorSubject<ShortcutDefinition[]>(this.shortcuts);

  readonly shortcuts$: Observable<ShortcutDefinition[]> = this.shortcutsSubject.asObservable();
  readonly defaultShortcuts = DEFAULT_SHORTCUTS;

  getShortcuts(): ShortcutDefinition[] {
    return this.shortcuts;
  }

  getShortcut(action: ShortcutActionId): ShortcutDefinition {
    return this.shortcuts.find((shortcut) => shortcut.action === action) ?? this.getDefaultShortcut(action);
  }

  getCombo(action: ShortcutActionId): string {
    return this.getShortcut(action).combo;
  }

  matches(event: KeyboardEvent, action: ShortcutActionId): boolean {
    const eventCombo = this.comboFromEvent(event);

    return eventCombo !== null && eventCombo === this.getCombo(action);
  }

  comboFromEvent(event: KeyboardEvent): string | null {
    if (MODIFIER_KEYS.includes(event.key)) {
      return null;
    }

    const key = this.normalizeKey(event.key);

    if (key === null) {
      return null;
    }

    const modifiers = [
      event.ctrlKey ? 'Control' : null,
      event.shiftKey ? 'Shift' : null,
      event.altKey ? 'Alt' : null,
      event.metaKey ? 'Meta' : null,
    ].filter((modifier): modifier is string => modifier !== null);

    return [...modifiers, key].join('+');
  }

  setShortcut(action: ShortcutActionId, combo: string): ShortcutValidationResult {
    const validation = this.validateShortcut(action, combo);

    if (!validation.valid) {
      return validation;
    }

    this.shortcuts = this.shortcuts.map((shortcut) =>
      shortcut.action === action ? { ...shortcut, combo } : shortcut
    );
    this.persistShortcuts();
    this.shortcutsSubject.next(this.shortcuts);

    return validation;
  }

  resetDefaults(): void {
    this.shortcuts = DEFAULT_SHORTCUTS.map((shortcut) => ({ ...shortcut }));
    this.persistShortcuts();
    this.shortcutsSubject.next(this.shortcuts);
  }

  validateShortcut(action: ShortcutActionId, combo: string): ShortcutValidationResult {
    if (!combo || combo.split('+').every((part) => MODIFIER_KEYS.includes(part))) {
      return { valid: false, message: 'Press a key with an optional modifier.' };
    }

    const duplicate = this.shortcuts.find((shortcut) =>
      shortcut.action !== action && shortcut.combo === combo
    );

    if (duplicate) {
      return { valid: false, message: `Already used by ${duplicate.label}.` };
    }

    if (combo === 'Tab' || combo === 'Control+S' || combo === 'Meta+S') {
      return { valid: false, message: 'That shortcut is reserved by the browser.' };
    }

    if (action === 'save' && !this.hasModifier(combo) && combo !== 'Enter') {
      return { valid: false, message: 'Save needs Enter or a modifier combo.' };
    }

    if (action === 'escapeModal' && combo !== 'Escape' && !this.hasModifier(combo)) {
      return { valid: false, message: 'Escape modal needs Esc or a modifier combo.' };
    }

    return { valid: true, message: null };
  }

  formatCombo(combo: string): string {
    return combo
      .split('+')
      .map((part) => part.replace('Control', 'Ctrl').replace('Meta', 'Cmd').replace('Escape', 'Esc'))
      .join(' + ');
  }

  private restoreShortcuts(): ShortcutDefinition[] {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);

      if (!storedValue) {
        return DEFAULT_SHORTCUTS.map((shortcut) => ({ ...shortcut }));
      }

      const parsedValue: unknown = JSON.parse(storedValue);

      if (!this.isShortcutDefinitionArray(parsedValue)) {
        return DEFAULT_SHORTCUTS.map((shortcut) => ({ ...shortcut }));
      }

      return DEFAULT_SHORTCUTS.map((defaultShortcut) => {
        const storedShortcut = parsedValue.find((shortcut) => shortcut.action === defaultShortcut.action);

        return {
          ...defaultShortcut,
          combo: storedShortcut?.combo ?? defaultShortcut.combo,
        };
      });
    } catch {
      return DEFAULT_SHORTCUTS.map((shortcut) => ({ ...shortcut }));
    }
  }

  private persistShortcuts(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.shortcuts));
    } catch {
      // Shortcuts remain usable in memory if storage is unavailable.
    }
  }

  private normalizeKey(key: string): string | null {
    if (key === ' ') {
      return 'Space';
    }

    if (key.length === 1) {
      return key.toUpperCase();
    }

    const namedKeys = ['Enter', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];

    return namedKeys.includes(key) ? key : null;
  }

  private getDefaultShortcut(action: ShortcutActionId): ShortcutDefinition {
    return DEFAULT_SHORTCUTS.find((shortcut) => shortcut.action === action) ?? DEFAULT_SHORTCUTS[0];
  }

  private hasModifier(combo: string): boolean {
    return combo.split('+').some((part) => MODIFIER_KEYS.includes(part));
  }

  private isShortcutDefinitionArray(value: unknown): value is ShortcutDefinition[] {
    return Array.isArray(value) && value.every((shortcut) => this.isShortcutDefinition(shortcut));
  }

  private isShortcutDefinition(value: unknown): value is ShortcutDefinition {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<ShortcutDefinition>;

    return (
      this.isShortcutAction(candidate.action) &&
      typeof candidate.label === 'string' &&
      typeof candidate.combo === 'string'
    );
  }

  private isShortcutAction(value: unknown): value is ShortcutActionId {
    return (
      value === 'createTask' ||
      value === 'search' ||
      value === 'save' ||
      value === 'escapeModal' ||
      value === 'toggleFocusPanel'
    );
  }
}
