import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OwnersService } from './owners.service';
import { UpdateOwnerProfileDto } from './dto/update-owner-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Owners')
@Controller('owners')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Turf owner subsystem summary' })
  getSummary() {
    return this.ownersService.getRegisteredOwnersCount();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TURF_OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my turf-owner business profile' })
  getMyProfile(@CurrentUser('userId') userId: string) {
    return this.ownersService.getMyProfile(userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TURF_OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update my turf-owner business profile' })
  updateMyProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateOwnerProfileDto,
  ) {
    return this.ownersService.updateMyProfile(userId, dto);
  }
}
