import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { DevicesService } from '../devices/devices.service';
import { PushLocationDto } from './dto/push-location.dto';
import { LocationQueryDto } from './dto/location-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller()
export class LocationsController {
  constructor(
    private readonly locationsService: LocationsService,
    private readonly devicesService: DevicesService,
  ) {}

  // Public — called by the Android device using its deviceKey
  @Post('locations/:deviceKey')
  async push(
    @Param('deviceKey') deviceKey: string,
    @Body() dto: PushLocationDto,
  ) {
    const device = await this.devicesService.findByKey(deviceKey);
    return this.locationsService.push(device.id, dto);
  }

  // JWT protected — called by the web dashboard
  @Get('devices/:id/locations')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @Param('id') id: string,
    @Query() query: LocationQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.devicesService.findOne(id, user.tenantId);
    return this.locationsService.findHistory(id, query);
  }

  @Get('devices/:id/locations/latest')
  @UseGuards(JwtAuthGuard)
  async getLatest(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.devicesService.findOne(id, user.tenantId);
    return this.locationsService.findLatest(id);
  }
}
