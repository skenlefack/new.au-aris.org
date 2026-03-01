const fs = require("fs");
const f = "services/credential/src/app.module.ts";
const content = `import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule as AuthMiddlewareModule } from '@aris/auth-middleware';
import { I18nModule } from '@aris/i18n';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { MfaModule } from './mfa/mfa.module';
import { I18nApiModule } from './i18n/i18n-api.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-credential-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthMiddlewareModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    I18nModule,
    AuthModule,
    UserModule,
    MfaModule,
    I18nApiModule,
  ],
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class AppModule {}
`;
fs.writeFileSync(f, content);
console.log("Fixed app.module.ts");
