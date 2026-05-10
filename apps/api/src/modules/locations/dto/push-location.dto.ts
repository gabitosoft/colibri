import { IsDateString, IsNotEmpty, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class PushLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @IsOptional()
  altitude?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  speed?: number;

  @IsNumber()
  @Min(0)
  @Max(360)
  @IsOptional()
  heading?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  accuracy?: number;

  @IsDateString()
  @IsNotEmpty()
  recordedAt: string;
}
