import { Controller, Get, Query } from '@nestjs/common';
import { I18nService } from '@aris/i18n';
import type { SupportedLocale } from '@aris/i18n';

@Controller('api/v1/i18n')
export class I18nController {
  constructor(private readonly i18n: I18nService) {}

  @Get('enums')
  getEnums(
    @Query('locale') locale?: string,
  ): { data: Record<string, Record<string, string>> } {
    const resolvedLocale = (locale ?? 'en') as SupportedLocale;
    return { data: this.i18n.getAllEnumTranslations(resolvedLocale) };
  }

  @Get('locales')
  getLocales(): { data: { code: string; nameEn: string; nameNative: string; rtl: boolean }[] } {
    return {
      data: [
        { code: 'en', nameEn: 'English', nameNative: 'English', rtl: false },
        { code: 'fr', nameEn: 'French', nameNative: 'Français', rtl: false },
        { code: 'pt', nameEn: 'Portuguese', nameNative: 'Português', rtl: false },
        { code: 'ar', nameEn: 'Arabic', nameNative: 'العربية', rtl: true },
      ],
    };
  }
}
