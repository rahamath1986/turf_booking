import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CouponsController } from './coupons.controller';
import { AdminCouponsController } from './admin-coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  imports: [JwtModule],
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
