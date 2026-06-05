import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { LocationRecord } from './entities/location-record.entity';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/locations',
})
export class LocationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.headers?.authorization as string | undefined)?.replace('Bearer ', '');

    if (!token) {
      this.logger.warn(`Client ${client.id} rejected: no token`);
      client.disconnect();
      return;
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET', 'change-me-in-production');
      const payload = this.jwtService.verify(token, { secret });
      client.data.tenantId = payload.tenantId;
      client.data.userId = payload.sub;
      this.logger.log(`Client connected: ${client.id} (tenant: ${payload.tenantId})`);
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Web client subscribes to a device's live location stream */
  @SubscribeMessage('subscribe:device')
  handleSubscribe(
    @MessageBody() deviceId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `device:${deviceId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: 'subscribed', data: deviceId };
  }

  /** Web client unsubscribes from a device */
  @SubscribeMessage('unsubscribe:device')
  handleUnsubscribe(
    @MessageBody() deviceId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `device:${deviceId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
    return { event: 'unsubscribed', data: deviceId };
  }

  /** Called by LocationsService after saving a new record */
  emitLocationUpdate(deviceId: string, record: LocationRecord) {
    this.server.to(`device:${deviceId}`).emit('location:update', record);
  }
}
