import { IsString } from 'class-validator';

export class UpsertTranslationDto {
  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsString()
  locale!: string;

  @IsString()
  field!: string;

  @IsString()
  value!: string;
}
