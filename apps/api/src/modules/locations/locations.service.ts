import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { LocationRecord } from './entities/location-record.entity';
import { PushLocationDto } from './dto/push-location.dto';
import { LocationQueryDto } from './dto/location-query.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(LocationRecord)
    private readonly repo: Repository<LocationRecord>,
  ) {}

  push(deviceId: string, dto: PushLocationDto) {
    const record = this.repo.create({ ...dto, deviceId });
    return this.repo.save(record);
  }

  async findHistory(deviceId: string, query: LocationQueryDto) {
    const where: FindOptionsWhere<LocationRecord> = { deviceId };

    if (query.from && query.to) {
      where.recordedAt = Between(new Date(query.from), new Date(query.to));
    }

    const [records, total] = await this.repo.findAndCount({
      where,
      order: { recordedAt: 'ASC' },
      take: query.limit,
      skip: query.offset,
    });

    return { total, records };
  }

  findLatest(deviceId: string) {
    return this.repo.findOne({
      where: { deviceId },
      order: { recordedAt: 'DESC' },
    });
  }
}
