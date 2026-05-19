import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1747612800000 implements MigrationInterface {
  name = 'InitialSchema1747612800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // tenants
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id"        uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "slug"      character varying NOT NULL,
        "name"      character varying NOT NULL,
        "isActive"  boolean           NOT NULL DEFAULT true,
        "plan"      character varying,
        "createdAt" TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tenants_slug"   UNIQUE ("slug"),
        CONSTRAINT "PK_tenants"        PRIMARY KEY ("id")
      )
    `);

    // users — enum type first
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM ('owner', 'admin', 'member')
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"        uuid                          NOT NULL DEFAULT uuid_generate_v4(),
        "name"      character varying             NOT NULL,
        "email"     character varying             NOT NULL,
        "password"  character varying             NOT NULL,
        "role"      "public"."users_role_enum"    NOT NULL DEFAULT 'member',
        "isActive"  boolean                       NOT NULL DEFAULT true,
        "tenantId"  uuid                          NOT NULL,
        "createdAt" TIMESTAMP                     NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP                     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_users_email_tenantId" ON "users" ("email", "tenantId")
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "FK_users_tenantId"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
    `);

    // devices
    await queryRunner.query(`
      CREATE TABLE "devices" (
        "id"          uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "name"        character varying NOT NULL,
        "description" character varying,
        "deviceKey"   character varying NOT NULL,
        "isActive"    boolean           NOT NULL DEFAULT true,
        "tenantId"    uuid              NOT NULL,
        "userId"      uuid,
        "createdAt"   TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_devices_deviceKey" UNIQUE ("deviceKey"),
        CONSTRAINT "PK_devices"           PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "devices"
        ADD CONSTRAINT "FK_devices_tenantId"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "devices"
        ADD CONSTRAINT "FK_devices_userId"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // location_records
    await queryRunner.query(`
      CREATE TABLE "location_records" (
        "id"         uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "deviceId"   uuid              NOT NULL,
        "latitude"   numeric(10,7)     NOT NULL,
        "longitude"  numeric(10,7)     NOT NULL,
        "altitude"   numeric(7,2),
        "speed"      numeric(6,2),
        "heading"    numeric(5,2),
        "accuracy"   numeric(5,2),
        "recordedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt"  TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_location_records" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_location_records_deviceId_recordedAt"
        ON "location_records" ("deviceId", "recordedAt")
    `);
    await queryRunner.query(`
      ALTER TABLE "location_records"
        ADD CONSTRAINT "FK_location_records_deviceId"
        FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "location_records" DROP CONSTRAINT "FK_location_records_deviceId"`);
    await queryRunner.query(`DROP INDEX "IDX_location_records_deviceId_recordedAt"`);
    await queryRunner.query(`DROP TABLE "location_records"`);

    await queryRunner.query(`ALTER TABLE "devices" DROP CONSTRAINT "FK_devices_userId"`);
    await queryRunner.query(`ALTER TABLE "devices" DROP CONSTRAINT "FK_devices_tenantId"`);
    await queryRunner.query(`DROP TABLE "devices"`);

    await queryRunner.query(`DROP INDEX "IDX_users_email_tenantId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_tenantId"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);

    await queryRunner.query(`DROP TABLE "tenants"`);
  }
}
