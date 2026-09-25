import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('config')
  @ApiOperation({ summary: 'Retrieve file upload storage configuration' })
  getConfig() {
    return this.uploadsService.getStorageConfig();
  }
}
