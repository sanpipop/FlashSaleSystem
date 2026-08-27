import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './common/database.module.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, ProductsModule, OrdersModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
