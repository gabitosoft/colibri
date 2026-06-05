import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export type SortableColumn = 'recordedAt' | 'latitude' | 'longitude' | 'speed' | 'heading' | 'accuracy' | 'altitude';
export type SortOrder = 'ASC' | 'DESC';

export class LocationQueryDto {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  limit?: number = 500;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;

  @IsIn(['recordedAt', 'latitude', 'longitude', 'speed', 'heading', 'accuracy', 'altitude'])
  @IsOptional()
  sortBy?: SortableColumn = 'recordedAt';

  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: SortOrder = 'DESC';
}
