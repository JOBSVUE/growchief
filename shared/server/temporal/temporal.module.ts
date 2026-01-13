import {
  Global,
  Injectable,
  Module,
  OnModuleInit,
} from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';
import { Connection } from '@temporalio/client';

@Injectable()
export class TemporalRegister implements OnModuleInit {
  constructor(private _client: TemporalService) {}

  async onModuleInit(): Promise<void> {
    const temporalAddress = process.env.TEMPORAL_ADDRESS || 'temporal:7233';
    const maxRetries = 30;
    const retryDelay = 2000;
    let connection: Connection | undefined;
    let customAttributes: any = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        if (!this._client) {
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          break;
        }

        const client = this._client.getClient();
        if (!client) {
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          break;
        }

        const rawClient = client.getRawClient();
        if (!rawClient) {
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          break;
        }

        connection = rawClient.connection as Connection;
        if (!connection || !connection.operatorService) {
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          break;
        }

        const result = await connection.operatorService.listSearchAttributes({
          namespace: process.env.TEMPORAL_NAMESPACE || 'default',
        });
        
        customAttributes = result.customAttributes;
        console.log(`[Temporal] Successfully connected to ${temporalAddress}`);
        break;
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          console.error(`[Temporal] Failed to connect to ${temporalAddress} after ${maxRetries} attempts: ${errorMsg}`);
          return;
        }
      }
    }

    if (!connection?.operatorService || !customAttributes) {
      console.error(`[Temporal] Connection not available after ${maxRetries} attempts. Temporal features will be unavailable.`);
      return;
    }

    try {
      const neededAttribute = ['workflowId', 'nodeId', 'botId', 'organizationId'];
      const missingAttributes = neededAttribute.filter(
        (attr) => !customAttributes[attr],
      );

      if (missingAttributes.length > 0) {
        await connection.operatorService.addSearchAttributes({
          namespace: process.env.TEMPORAL_NAMESPACE || 'default',
          searchAttributes: missingAttributes.reduce((all, current) => {
            all[current] = 1;
            return all;
          }, {}),
        });
        console.log(`[Temporal] Added missing search attributes: ${missingAttributes.join(', ')}`);
      } else {
        console.log(`[Temporal] All required search attributes are present`);
      }
    } catch (err) {
      console.error('[Temporal] Failed to setup search attributes:', err);
    }
  }
}

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [TemporalRegister],
  get exports() {
    return this.providers;
  },
})
export class TemporalRegisterMissingSearchAttributesModule {}
