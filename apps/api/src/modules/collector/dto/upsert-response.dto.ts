import { Allow, IsBoolean, IsOptional, IsString } from 'class-validator';
export class UpsertResponseDto {
  @IsString() questionId!: string;
  @IsOptional() @Allow() answerJson?: unknown;
  @IsOptional() @IsBoolean() isNa?: boolean;
  @IsOptional() @IsString() naReason?: string;
  @IsOptional() @IsBoolean() isHidden?: boolean;
}
