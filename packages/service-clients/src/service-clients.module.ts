import { Module, DynamicModule, Provider } from '@nestjs/common';
import { DataQualityClient } from './data-quality-client';
import { WorkflowClient } from './workflow-client';
import { AnimalHealthClient } from './animal-health-client';
import { MasterDataClient } from './master-data-client';
import type { ServiceClientConfig } from './base-client';

export interface ServiceClientsModuleOptions {
  dataQuality?: Partial<ServiceClientConfig>;
  workflow?: Partial<ServiceClientConfig>;
  animalHealth?: Partial<ServiceClientConfig>;
  masterData?: Partial<ServiceClientConfig>;
}

@Module({})
export class ServiceClientsModule {
  static forRoot(options?: ServiceClientsModuleOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: DataQualityClient,
        useFactory: () => new DataQualityClient(options?.dataQuality),
      },
      {
        provide: WorkflowClient,
        useFactory: () => new WorkflowClient(options?.workflow),
      },
      {
        provide: AnimalHealthClient,
        useFactory: () => new AnimalHealthClient(options?.animalHealth),
      },
      {
        provide: MasterDataClient,
        useFactory: () => new MasterDataClient(options?.masterData),
      },
    ];

    return {
      module: ServiceClientsModule,
      global: true,
      providers,
      exports: providers,
    };
  }
}
