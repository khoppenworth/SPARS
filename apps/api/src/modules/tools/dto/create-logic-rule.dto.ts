import { IsOptional, IsString } from 'class-validator';

export class CreateLogicRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  triggerExprJson?: any;

  @IsOptional()
  actionsJson?: any;
}
