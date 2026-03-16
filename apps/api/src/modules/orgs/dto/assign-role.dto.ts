import { IsObject, IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  roleCode!: string;

  @IsOptional()
  @IsString()
  toolId?: string; // optional tool scope

  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;
}
