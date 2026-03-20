import { IsString } from 'class-validator';

export class CreateFormDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;
}
