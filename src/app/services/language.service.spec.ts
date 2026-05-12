import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateService } from '@ngx-translate/core';

import { LanguageService } from './language.service';

describe('LanguageService', () => {
  const storageKey = 'devbreak-language';

  let translate: {
    addLangs: ReturnType<typeof vi.fn>;
    setFallbackLang: ReturnType<typeof vi.fn>;
    use: ReturnType<typeof vi.fn>;
    instant: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
    translate = {
      addLangs: vi.fn(),
      setFallbackLang: vi.fn(),
      use: vi.fn(),
      instant: vi.fn((key: string) => key),
    };
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
  });

  it('restores and applies a persisted supported language', () => {
    localStorage.setItem(storageKey, 'es');

    const service = createService();

    expect(service.getCurrentLanguage()).toBe('es');
    expect(document.documentElement.lang).toBe('es');
    expect(translate.use).toHaveBeenCalledWith('es');
  });

  it('falls back to English for corrupted or unsupported language state', () => {
    localStorage.setItem(storageKey, 'de');

    const service = createService();

    expect(service.getCurrentLanguage()).toBe('en');
    expect(localStorage.getItem(storageKey)).toBe('en');
  });

  it('persists language changes and keeps accessible labels readable', () => {
    const service = createService();

    service.setLanguage('fr');

    expect(localStorage.getItem(storageKey)).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(service.languages.map((language) => language.label)).toEqual([
      'English',
      'Espanol',
      'Francais',
    ]);
  });

  function createService(): LanguageService {
    return new LanguageService(translate as unknown as TranslateService);
  }
});
