import { IsString, IsIn } from 'class-validator';

const SUPPORTED_LOCALES = ['en', 'fr', 'pt', 'ar'] as const;

export class UpdateLocaleDto {
  @IsString()
  @IsIn(SUPPORTED_LOCALES)
  locale!: string;
}
