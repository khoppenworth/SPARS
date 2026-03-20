import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateOptionDto {
  @IsString()
  value!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
