import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  create(dto: CreateUserDto) {
    const user = this.repo.create(dto);
    return this.repo.save(user);
  }

  findAllByTenant(tenantId: string) {
    return this.repo.find({ where: { tenantId } });
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.repo.findOneBy({ id, tenantId });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByEmailAndTenant(email: string, tenantId: string) {
    return this.repo.findOne({
      where: { email, tenantId },
      select: ['id', 'name', 'email', 'password', 'role', 'tenantId', 'isActive'],
    });
  }
}
