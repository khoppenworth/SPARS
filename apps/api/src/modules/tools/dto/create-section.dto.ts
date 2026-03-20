import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  parentSectionId?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
