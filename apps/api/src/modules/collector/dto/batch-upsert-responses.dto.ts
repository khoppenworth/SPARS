import { ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { UpsertResponseDto } from './upsert-response.dto';

export class BatchUpsertResponsesDto {
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertResponseDto)
  items!: UpsertResponseDto[];
}
