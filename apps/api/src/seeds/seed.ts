import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../database/data-source';
import { Tenant } from '../modules/tenants/entities/tenant.entity';
import { User, UserRole } from '../modules/users/entities/user.entity';

const TENANT_SLUG = process.env.SEED_TENANT_SLUG ?? 'gabitosoft';
const TENANT_NAME = process.env.SEED_TENANT_NAME ?? 'Gabitosoft';
const USER_EMAIL = process.env.SEED_USER_EMAIL ?? 'gabitosoft@gmail.com';
const USER_NAME = process.env.SEED_USER_NAME ?? 'Gabriel Delgado';

async function seed() {
  await AppDataSource.initialize();

  const tenantRepo = AppDataSource.getRepository(Tenant);
  const userRepo = AppDataSource.getRepository(User);

  let tenant = await tenantRepo.findOneBy({ slug: TENANT_SLUG });
  if (!tenant) {
    tenant = tenantRepo.create({ slug: TENANT_SLUG, name: TENANT_NAME, isActive: true });
    await tenantRepo.save(tenant);
    console.log(`✅ Tenant created: ${TENANT_SLUG}`);
  } else {
    console.log(`⏭  Tenant already exists: ${TENANT_SLUG}`);
  }

  const existing = await userRepo.findOneBy({ email: USER_EMAIL, tenantId: tenant.id });
  if (!existing) {
    // Password is never used for login (portal SSO handles auth)
    const password = await bcrypt.hash(Math.random().toString(36), 12);
    const user = userRepo.create({
      email: USER_EMAIL,
      name: USER_NAME,
      password,
      role: UserRole.OWNER,
      isActive: true,
      tenantId: tenant.id,
    });
    // Save directly to bypass the @BeforeInsert double-hash
    await AppDataSource.getRepository(User)
      .createQueryBuilder()
      .insert()
      .into(User)
      .values({ ...user, password })
      .execute();
    console.log(`✅ User created: ${USER_EMAIL}`);
  } else {
    console.log(`⏭  User already exists: ${USER_EMAIL}`);
  }

  await AppDataSource.destroy();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
