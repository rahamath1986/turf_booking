import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Retrieve user directory summary' })
  getSummary() {
    return this.usersService.getUserCount();
  }
}
