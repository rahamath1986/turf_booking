import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OwnersService } from './owners.service';

@ApiTags('Owners')
@Controller('owners')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Turf owner subsystem summary' })
  getSummary() {
    return this.ownersService.getRegisteredOwnersCount();
  }
}
