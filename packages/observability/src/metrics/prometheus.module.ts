import {
  Module,
  Global,
  DynamicModule,
  Controller,
  Get,
  Res,
  type OnModuleInit,
} from '@nestjs/common';
import * as client from 'prom-client';

export interface PrometheusModuleOptions {
  serviceName: string;
  defaultLabels?: Record<string, string>;
  prefix?: string;
}

export const PROMETHEUS_OPTIONS = 'ARIS_PROMETHEUS_OPTIONS';

@Controller()
class MetricsController {
  @Get('metrics')
  async getMetrics(
    @Res() res: { setHeader(k: string, v: string): void; end(body: string): void },
  ): Promise<void> {
    res.setHeader('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  }
}

@Global()
@Module({})
export class PrometheusModule implements OnModuleInit {
  private static options: PrometheusModuleOptions;

  static forRoot(options: PrometheusModuleOptions): DynamicModule {
    PrometheusModule.options = options;
    return {
      module: PrometheusModule,
      controllers: [MetricsController],
      providers: [
        {
          provide: PROMETHEUS_OPTIONS,
          useValue: options,
        },
      ],
      exports: [PROMETHEUS_OPTIONS],
    };
  }

  onModuleInit(): void {
    const opts = PrometheusModule.options;
    if (!opts) return;

    client.register.setDefaultLabels({
      service: opts.serviceName,
      ...opts.defaultLabels,
    });

    client.collectDefaultMetrics({
      prefix: opts.prefix ?? 'aris_',
    });
  }
}
