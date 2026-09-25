import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TurfsService } from './turfs.service';
import { CreateTurfDto } from './dto/create-turf.dto';
import { UpdateTurfDto } from './dto/update-turf.dto';
import { UpdateTurfStatusDto } from './dto/update-turf-status.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Turf Owner Management')
@Controller('owner/turfs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TURF_OWNER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth('JWT-auth')
export class OwnerTurfsController {
  constructor(private readonly turfsService: TurfsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new turf venue',
    description:
      'Creates a new turf venue with sports, facilities, hours, and pricing rules under the authenticated owner profile.',
  })
  @ApiResponse({ status: 201, description: 'Turf venue successfully created' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or invalid location',
  })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient role' })
  createTurf(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: CreateTurfDto,
  ) {
    return this.turfsService.createOwnerTurf(userId, userRoles, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all turfs owned by current user',
    description:
      'Returns paginated list of venues belonging exclusively to the authenticated turf owner.',
  })
  @ApiResponse({ status: 200, description: 'Owned turf list' })
  getMyTurfs(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.turfsService.findOwnerTurfs(userId, userRoles, pagination);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get details of owned turf',
    description:
      'Retrieves complete turf configuration. Throws 403 Forbidden if accessed by another owner.',
  })
  @ApiResponse({ status: 200, description: 'Owned turf details' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Cannot access another owner’s turf',
  })
  @ApiResponse({ status: 404, description: 'Turf not found' })
  getMyTurfById(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.turfsService.findOwnerTurfById(userId, userRoles, id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update owned turf venue details',
    description:
      'Updates venue metadata, operating hours, and pricing rules. Strictly enforces ownership boundary.',
  })
  @ApiResponse({ status: 200, description: 'Turf successfully updated' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Cannot modify another owner’s turf',
  })
  @ApiResponse({ status: 404, description: 'Turf not found' })
  updateMyTurf(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
    @Body() dto: UpdateTurfDto,
  ) {
    return this.turfsService.updateOwnerTurf(userId, userRoles, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft-delete owned turf venue',
    description:
      'Deactivates and soft-deletes a turf venue while preserving relational integrity.',
  })
  @ApiResponse({ status: 200, description: 'Turf successfully soft-deleted' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Cannot delete another owner’s turf',
  })
  @ApiResponse({ status: 404, description: 'Turf not found' })
  deleteMyTurf(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.turfsService.deleteOwnerTurf(userId, userRoles, id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Toggle operational active status of owned turf',
    description:
      'Allows owners to temporarily activate or deactivate a venue for maintenance or seasonal closure.',
  })
  @ApiResponse({ status: 200, description: 'Turf status updated' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Cannot alter another owner’s turf status',
  })
  @ApiResponse({ status: 404, description: 'Turf not found' })
  updateMyTurfStatus(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
    @Body() dto: UpdateTurfStatusDto,
  ) {
    return this.turfsService.updateOwnerTurfStatus(userId, userRoles, id, dto);
  }
}
