import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TurfQueryDto } from './turf-query.dto';

describe('TurfQueryDto', () => {
  it('should transform comma-separated facilityIds string into array of UUIDs', async () => {
    const raw = {
      facilityIds:
        'b1a13e2e-2f10-449e-b2d2-8f9f0909419b,c2b23e2e-2f10-449e-b2d2-8f9f0909419c',
    };

    const dto = plainToInstance(TurfQueryDto, raw);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.facilityIds).toEqual([
      'b1a13e2e-2f10-449e-b2d2-8f9f0909419b',
      'c2b23e2e-2f10-449e-b2d2-8f9f0909419c',
    ]);
  });

  it('should transform array of facilityIds string', async () => {
    const raw = {
      facilityIds: [
        'b1a13e2e-2f10-449e-b2d2-8f9f0909419b',
        'c2b23e2e-2f10-449e-b2d2-8f9f0909419c',
      ],
    };

    const dto = plainToInstance(TurfQueryDto, raw);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.facilityIds).toEqual([
      'b1a13e2e-2f10-449e-b2d2-8f9f0909419b',
      'c2b23e2e-2f10-449e-b2d2-8f9f0909419c',
    ]);
  });

  it('should transform comma-separated amenities alias', async () => {
    const raw = {
      amenities: 'b1a13e2e-2f10-449e-b2d2-8f9f0909419b',
    };

    const dto = plainToInstance(TurfQueryDto, raw);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.amenities).toEqual(['b1a13e2e-2f10-449e-b2d2-8f9f0909419b']);
  });

  it('should fail validation when facilityIds contains an invalid UUID', async () => {
    const raw = {
      facilityIds: 'not-a-valid-uuid',
    };

    const dto = plainToInstance(TurfQueryDto, raw);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const facilityError = errors.find((e) => e.property === 'facilityIds');
    expect(facilityError).toBeDefined();
  });
});
