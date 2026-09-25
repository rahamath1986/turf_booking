import { Module } from '@nestjs/common';
import { TurfsService } from './turfs.service';
import { TurfsController } from './turfs.controller';
import { OwnerTurfsController } from './owner-turfs.controller';

@Module({
  controllers: [TurfsController, OwnerTurfsController],
  providers: [TurfsService],
  exports: [TurfsService],
})
export class TurfsModule {}
