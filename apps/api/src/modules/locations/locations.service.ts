import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, MoreThanOrEqual, LessThanOrEqual, Repository } from 'typeorm';
import { LocationRecord } from './entities/location-record.entity';
import { PushLocationDto } from './dto/push-location.dto';
import { LocationQueryDto } from './dto/location-query.dto';
import { LocationsGateway } from './locations.gateway';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(LocationRecord)
    private readonly repo: Repository<LocationRecord>,
    @Optional() private readonly gateway: LocationsGateway,
  ) {}

  async push(deviceId: string, dto: PushLocationDto) {
    const record = this.repo.create({ ...dto, deviceId });
    const saved = await this.repo.save(record);
    // Broadcast to any connected WebSocket clients watching this device
    this.gateway?.emitLocationUpdate(deviceId, saved);
    return saved;
  }

  async findHistory(deviceId: string, query: LocationQueryDto) {
    const where: FindOptionsWhere<LocationRecord> = { deviceId };

    if (query.from && query.to) {
      where.recordedAt = Between(new Date(query.from), new Date(query.to));
    } else if (query.from) {
      where.recordedAt = MoreThanOrEqual(new Date(query.from));
    } else if (query.to) {
      where.recordedAt = LessThanOrEqual(new Date(query.to));
    }

    const [records, total] = await this.repo.findAndCount({
      where,
      order: { recordedAt: 'DESC' },
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
