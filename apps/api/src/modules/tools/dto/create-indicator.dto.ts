import { IsOptional, IsString } from 'class-validator';

export class CreateIndicatorDto {
  @IsString()
  code!: string;

  @IsString()
  indicatorType!: string;

  @IsOptional()
  definitionJson?: any;
}
