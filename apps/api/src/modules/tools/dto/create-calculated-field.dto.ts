import { IsOptional, IsString } from 'class-validator';

export class CreateCalculatedFieldDto {
  @IsString()
  code!: string;

  @IsString()
  outputType!: string;

  @IsOptional()
  formulaJson?: any;
}
