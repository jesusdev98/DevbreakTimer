import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type LanguageCode = 'en' | 'es' | 'fr';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
}

const STORAGE_KEY = 'devbreak-language';
const DEFAULT_LANGUAGE: LanguageCode = 'en';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  readonly languages: readonly LanguageOption[] = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Espanol' },
    { code: 'fr', label: 'Francais' },
  ];

  private currentLanguage: LanguageCode = DEFAULT_LANGUAGE;

  constructor(private readonly translate: TranslateService) {
    this.translate.addLangs(this.languages.map((language) => language.code));
    this.translate.setFallbackLang(DEFAULT_LANGUAGE);
    this.useLanguage(this.restoreLanguage());
  }

  getCurrentLanguage(): LanguageCode {
    return this.currentLanguage;
  }

  setLanguage(language: LanguageCode): void {
    this.useLanguage(this.isLanguageCode(language) ? language : DEFAULT_LANGUAGE);
  }

  instant(key: string, params?: Record<string, unknown>): string {
    const value = this.translate.instant(key, params);

    return typeof value === 'string' ? value : key;
  }

  private useLanguage(language: LanguageCode): void {
    this.currentLanguage = language;
    document.documentElement.lang = language;
    this.translate.use(language);
    this.persistLanguage(language);
  }

  private restoreLanguage(): LanguageCode {
    try {
      const storedLanguage = window.localStorage.getItem(STORAGE_KEY);

      return this.isLanguageCode(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  }

  private persistLanguage(language: LanguageCode): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Language switching remains available in memory if storage is unavailable.
    }
  }

  private isLanguageCode(value: unknown): value is LanguageCode {
    return value === 'en' || value === 'es' || value === 'fr';
  }
}
