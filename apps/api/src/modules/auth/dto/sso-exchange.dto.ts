import { IsNotEmpty, IsString } from 'class-validator';

export class SsoExchangeDto {
  @IsString()
  @IsNotEmpty()
  ticket: string;
}
