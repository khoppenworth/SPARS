import { IsDateString, IsOptional, IsString } from 'class-validator';
export class CreateVisitDto {
  @IsString() orgId!: string;
  @IsString() toolVersionId!: string;
  @IsString() facilityId!: string;
  @IsDateString() visitDate!: string;
  @IsOptional() @IsString() deviceId?: string;
}
