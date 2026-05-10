import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Device } from './entities/device.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly repo: Repository<Device>,
  ) {}

  create(dto: CreateDeviceDto, tenantId: string) {
    const device = this.repo.create({
      ...dto,
      tenantId,
      deviceKey: randomBytes(24).toString('hex'),
    });
    return this.repo.save(device);
  }

  findAll(tenantId: string) {
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, tenantId: string) {
    const device = await this.repo.findOneBy({ id, tenantId });
    if (!device) throw new NotFoundException(`Device ${id} not found`);
    return device;
  }

  async findByKey(deviceKey: string) {
    const device = await this.repo.findOneBy({ deviceKey, isActive: true });
    if (!device) throw new NotFoundException('Device not found or inactive');
    return device;
  }

  async update(id: string, tenantId: string, dto: UpdateDeviceDto) {
    const device = await this.findOne(id, tenantId);
    Object.assign(device, dto);
    return this.repo.save(device);
  }

  async remove(id: string, tenantId: string) {
    const device = await this.findOne(id, tenantId);
    return this.repo.remove(device);
  }
}
