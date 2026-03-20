import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  code!: string;

  @IsString()
  questionType!: string;

  @IsOptional()
  @IsBoolean()
  isRequiredDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNa?: boolean;

  @IsOptional()
  @IsBoolean()
  naRequiresReason?: boolean;

  @IsOptional()
  sortOrder?: number;

  @IsOptional()
  constraintsJson?: any;

  @IsOptional()
  scoringJson?: any;
}
