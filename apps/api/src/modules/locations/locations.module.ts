import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationRecord } from './entities/location-record.entity';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [TypeOrmModule.forFeature([LocationRecord]), DevicesModule],
  providers: [LocationsService],
  controllers: [LocationsController],
})
export class LocationsModule {}
