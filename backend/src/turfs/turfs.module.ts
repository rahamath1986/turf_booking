import { Module } from '@nestjs/common';
import { TurfsService } from './turfs.service';
import { TurfsController } from './turfs.controller';
import { OwnerTurfsController } from './owner-turfs.controller';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [TurfsController, OwnerTurfsController],
  providers: [TurfsService],
  exports: [TurfsService],
})
export class TurfsModule {}
