import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocationRecord } from './entities/location-record.entity';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { LocationsGateway } from './locations.gateway';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LocationRecord]),
    DevicesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change-me-in-production'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [LocationsService, LocationsGateway],
  controllers: [LocationsController],
})
export class LocationsModule {}
