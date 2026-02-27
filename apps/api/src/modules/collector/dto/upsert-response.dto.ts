import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
export class UpsertResponseDto {
  @IsString() questionId!: string;
  @IsOptional() @IsObject() answerJson?: Record<string, any>;
  @IsOptional() @IsBoolean() isNa?: boolean;
  @IsOptional() @IsString() naReason?: string;
  @IsOptional() @IsBoolean() isHidden?: boolean;
}
