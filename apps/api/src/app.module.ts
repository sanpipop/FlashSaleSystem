import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './common/database.module.js';
import { MetricsModule } from './common/metrics/metrics.module.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { HomeModule } from './home/home.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [
    DatabaseModule,
    MetricsModule,
    AdminModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    HomeModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
