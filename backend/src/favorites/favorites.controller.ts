import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({
    summary: "List user's favorite turfs",
    description:
      "Returns paginated list of turfs saved to the authenticated user's wishlist/favorites.",
  })
  @ApiResponse({ status: 200, description: "List of user's favorited turfs" })
  getFavorites(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.favoritesService.getFavorites(userId, page, limit);
  }

  @Post(':turfId')
  @ApiOperation({
    summary: 'Add turf to favorites',
    description: 'Saves a turf venue to user favorites. Idempotent.',
  })
  @ApiResponse({ status: 201, description: 'Turf favorited successfully' })
  @ApiResponse({ status: 404, description: 'Turf venue not found' })
  addFavorite(
    @CurrentUser('userId') userId: string,
    @Param('turfId', ParseUUIDPipe) turfId: string,
  ) {
    return this.favoritesService.addFavorite(userId, turfId);
  }

  @Delete(':turfId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove turf from favorites',
    description: 'Removes a turf venue from user favorites. Idempotent.',
  })
  @ApiResponse({ status: 200, description: 'Turf removed from favorites' })
  removeFavorite(
    @CurrentUser('userId') userId: string,
    @Param('turfId', ParseUUIDPipe) turfId: string,
  ) {
    return this.favoritesService.removeFavorite(userId, turfId);
  }
}
