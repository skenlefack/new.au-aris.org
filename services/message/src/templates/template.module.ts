import { Module } from '@nestjs/common';
import { TemplateEngine } from './template-engine';

@Module({
  providers: [TemplateEngine],
  exports: [TemplateEngine],
})
export class TemplateModule {}
