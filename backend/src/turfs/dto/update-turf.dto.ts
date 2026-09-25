import { PartialType } from '@nestjs/swagger';
import { CreateTurfDto } from './create-turf.dto';

export class UpdateTurfDto extends PartialType(CreateTurfDto) {}
