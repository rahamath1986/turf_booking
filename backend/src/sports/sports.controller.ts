import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SportsService } from './sports.service';

@ApiTags('Sports')
@Controller('sports')
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  @Get()
  @ApiOperation({ summary: 'List all supported sports' })
  getSports() {
    return this.sportsService.getActiveSports();
  }
}
