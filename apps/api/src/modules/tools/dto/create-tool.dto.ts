import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateToolDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  defaultLocale?: string;

  @IsOptional()
  @IsArray()
  enabledLocales?: string[];
}
