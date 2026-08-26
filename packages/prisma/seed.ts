import { PrismaClient } from './generated';
import {
  DEFAULT_FACT_SHEET_TYPES,
  DEFAULT_RELATION_TYPES,
} from '../shared/src/constants/default-meta-model';

const prisma = new PrismaClient();

const WORKSPACE_ID = 'ws-development';
const TECH_USER_ID = 'user-technical';

// The technical user's API credential is the ONLY thing the OAuth token endpoint accepts (no
// pattern/prefix shortcuts — see apps/api/src/auth/auth.service.ts). Configure your own via
// LEANIX_API_TOKEN/LEANIX_API_TOKEN_SECRET before seeding to register a different credential;
// re-running the seed rotates it. Falls back to the repo's documented dev defaults.
const TECH_USER_API_TOKEN = process.env.LEANIX_API_TOKEN ?? 'dev-token-12345';
const TECH_USER_API_TOKEN_SECRET = process.env.LEANIX_API_TOKEN_SECRET ?? 'dev-secret-67890';

async function seedWorkspaceAndUser() {
  await prisma.workspace.upsert({
    where: { id: WORKSPACE_ID },
    update: {},
    create: {
      id: WORKSPACE_ID,
      name: 'development',
      displayName: 'Development',
      description: 'Default mock workspace',
    },
  });

  await prisma.user.upsert({
    where: { id: TECH_USER_ID },
    update: {
      apiToken: TECH_USER_API_TOKEN,
      apiTokenSecret: TECH_USER_API_TOKEN_SECRET,
    },
    create: {
      id: TECH_USER_ID,
      email: 'technical-user@mock.local',
      name: 'Technical User',
      role: 'ADMIN',
      workspaceId: WORKSPACE_ID,
      apiToken: TECH_USER_API_TOKEN,
      apiTokenSecret: TECH_USER_API_TOKEN_SECRET,
    },
  });

  await prisma.user.upsert({
    where: { email: 'jane.smith@example.com' },
    update: {},
    create: {
      id: 'user-jane-smith',
      email: 'jane.smith@example.com',
      name: 'Jane Smith',
      role: 'MEMBER',
      workspaceId: WORKSPACE_ID,
    },
  });
}

async function seedMetaModel() {
  const typeIdByKey = new Map<string, string>();

  for (const type of DEFAULT_FACT_SHEET_TYPES) {
    const id = `type-${type.technicalKey}`;
    typeIdByKey.set(type.technicalKey, id);

    await prisma.factSheetType.upsert({
      where: { technicalKey: type.technicalKey },
      update: {
        label: type.label,
        description: type.description,
        icon: type.icon,
        color: type.color,
      },
      create: {
        id,
        technicalKey: type.technicalKey,
        label: type.label,
        description: type.description,
        icon: type.icon,
        color: type.color,
      },
    });

    for (const attr of type.attributes) {
      const attrId = `attr-${type.technicalKey}-${attr.technicalKey}`;
      await prisma.attribute.upsert({
        where: { factSheetTypeId_technicalKey: { factSheetTypeId: id, technicalKey: attr.technicalKey } },
        update: {
          label: attr.label,
          description: attr.description,
          dataType: attr.dataType,
          mandatory: attr.mandatory,
          hidden: attr.hidden ?? false,
          readOnly: attr.readOnly ?? false,
        },
        create: {
          id: attrId,
          factSheetTypeId: id,
          technicalKey: attr.technicalKey,
          label: attr.label,
          description: attr.description,
          dataType: attr.dataType,
          mandatory: attr.mandatory,
          hidden: attr.hidden ?? false,
          readOnly: attr.readOnly ?? false,
        },
      });

      if (attr.allowedValues) {
        for (const av of attr.allowedValues) {
          const existing = await prisma.allowedValue.findFirst({
            where: { attributeId: attrId, value: av.value },
          });
          if (existing) {
            await prisma.allowedValue.update({ where: { id: existing.id }, data: { label: av.label, color: av.color } });
          } else {
            await prisma.allowedValue.create({
              data: {
                id: `av-${type.technicalKey}-${attr.technicalKey}-${av.value}`,
                attributeId: attrId,
                value: av.value,
                label: av.label,
                color: av.color,
              },
            });
          }
        }
        // Remove stale allowed values no longer in the definition (e.g. after correcting
        // businessCriticality's values against real LeanIX — see docs/RESEARCH_LEANIX_REAL_API.md §5).
        await prisma.allowedValue.deleteMany({
          where: { attributeId: attrId, value: { notIn: attr.allowedValues.map((av) => av.value) } },
        });
      }
    }
  }

  for (const rel of DEFAULT_RELATION_TYPES) {
    const sourceTypeId = typeIdByKey.get(rel.sourceType);
    const targetTypeId = typeIdByKey.get(rel.targetType);
    if (!sourceTypeId || !targetTypeId) continue;

    await prisma.relationType.upsert({
      where: {
        sourceTypeId_targetTypeId_technicalKey: {
          sourceTypeId,
          targetTypeId,
          technicalKey: rel.technicalKey,
        },
      },
      update: {
        label: rel.label,
        description: rel.description,
        cardinality: rel.cardinality,
        mandatory: rel.mandatory,
      },
      create: {
        id: `reltype-${rel.technicalKey}`,
        technicalKey: rel.technicalKey,
        label: rel.label,
        description: rel.description,
        sourceTypeId,
        targetTypeId,
        cardinality: rel.cardinality,
        mandatory: rel.mandatory,
      },
    });
  }

  return typeIdByKey;
}

async function upsertFactSheet(opts: {
  id: string;
  typeId: string;
  name: string;
  description?: string;
  externalId?: string;
  lifecycle?: unknown;
}) {
  return prisma.factSheet.upsert({
    where: { id: opts.id },
    update: {
      name: opts.name,
      description: opts.description,
      externalId: opts.externalId,
      lifecycle: opts.lifecycle as any,
    },
    create: {
      id: opts.id,
      typeId: opts.typeId,
      name: opts.name,
      displayName: opts.name,
      description: opts.description,
      externalId: opts.externalId,
      lifecycle: opts.lifecycle as any,
      status: 'ACTIVE',
      qualitySeal: 'BROKEN',
      completion: 25,
      createdBy: TECH_USER_ID,
      updatedBy: TECH_USER_ID,
    },
  });
}

async function seedSampleData(typeIdByKey: Map<string, string>) {
  const appTypeId = typeIdByKey.get('Application')!;
  const itcTypeId = typeIdByKey.get('ITComponent')!;
  const bcTypeId = typeIdByKey.get('BusinessCapability')!;
  const providerTypeId = typeIdByKey.get('Provider')!;

  const sapCrm = await upsertFactSheet({
    id: 'fs-app-sap-crm',
    typeId: appTypeId,
    name: 'SAP CRM',
    description: 'Customer relationship management system',
    externalId: 'SAP-CRM-001',
    lifecycle: {
      asString: 'active',
      phases: [
        { phase: 'plan', startDate: '2020-01-01' },
        { phase: 'phaseIn', startDate: '2021-01-01' },
        { phase: 'active', startDate: '2022-01-01' },
      ],
    },
  });

  const salesforce = await upsertFactSheet({
    id: 'fs-app-salesforce',
    typeId: appTypeId,
    name: 'Salesforce',
    description: 'Sales force automation',
    externalId: 'SF-001',
  });

  const ecommerce = await upsertFactSheet({
    id: 'fs-app-ecommerce',
    typeId: appTypeId,
    name: 'E-Commerce Platform',
    description: 'Customer-facing online store',
    externalId: 'ECOM-100',
  });

  const ec2 = await upsertFactSheet({
    id: 'fs-itc-aws-ec2',
    typeId: itcTypeId,
    name: 'AWS EC2 Instance',
    description: 'Compute instance',
    externalId: 'AWS-EC2-001',
  });

  const pg = await upsertFactSheet({
    id: 'fs-itc-postgres',
    typeId: itcTypeId,
    name: 'PostgreSQL Database',
    description: 'Relational database',
    externalId: 'PG-001',
  });

  const salesCapability = await upsertFactSheet({
    id: 'fs-bc-sales',
    typeId: bcTypeId,
    name: 'Sales Management',
    description: 'Managing the end-to-end sales process',
    externalId: 'BC-SALES',
  });

  const aws = await upsertFactSheet({
    id: 'fs-provider-aws',
    typeId: providerTypeId,
    name: 'Amazon Web Services',
    description: 'Cloud infrastructure provider',
    externalId: 'PROVIDER-AWS',
  });

  const relTypes = await prisma.relationType.findMany();
  const relTypeByKey = new Map(relTypes.map((r) => [r.technicalKey, r]));

  async function upsertRelation(id: string, technicalKey: string, sourceId: string, targetId: string) {
    const relType = relTypeByKey.get(technicalKey);
    if (!relType) return;
    await prisma.relation.upsert({
      where: {
        relationTypeId_sourceId_targetId: {
          relationTypeId: relType.id,
          sourceId,
          targetId,
        },
      },
      update: {},
      create: {
        id,
        relationTypeId: relType.id,
        sourceId,
        targetId,
      },
    });
  }

  await upsertRelation('rel-sapcrm-ec2', 'relApplicationToITComponent', sapCrm.id, ec2.id);
  await upsertRelation('rel-ecom-ec2', 'relApplicationToITComponent', ecommerce.id, ec2.id);
  await upsertRelation('rel-ecom-pg', 'relApplicationToITComponent', ecommerce.id, pg.id);
  await upsertRelation('rel-sapcrm-sales', 'relApplicationToBusinessCapability', sapCrm.id, salesCapability.id);
  await upsertRelation('rel-sapcrm-aws', 'relApplicationToProvider', sapCrm.id, aws.id);
  await upsertRelation('rel-ec2-aws', 'relITComponentToProvider', ec2.id, aws.id);

  // Tags
  const statusGroup = await prisma.tagGroup.upsert({
    where: { name: 'status' },
    update: {},
    create: { id: 'taggroup-status', name: 'status', description: 'Lifecycle status tags' },
  });
  const activeTag = await prisma.tag.upsert({
    where: { groupId_name: { groupId: statusGroup.id, name: 'status/active' } },
    update: {},
    create: { id: 'tag-status-active', groupId: statusGroup.id, name: 'status/active', color: '#81C784' },
  });
  await prisma.tagAssignment.upsert({
    where: { factSheetId_tagId: { factSheetId: sapCrm.id, tagId: activeTag.id } },
    update: {},
    create: { id: 'tagassign-sapcrm-active', factSheetId: sapCrm.id, tagId: activeTag.id },
  });

  // Subscriptions
  await prisma.subscription.upsert({
    where: { factSheetId_userId_type: { factSheetId: sapCrm.id, userId: TECH_USER_ID, type: 'RESPONSIBLE' } },
    update: {},
    create: {
      id: 'sub-sapcrm-tech-responsible',
      factSheetId: sapCrm.id,
      userId: TECH_USER_ID,
      userName: 'Technical User',
      userEmail: 'technical-user@mock.local',
      type: 'RESPONSIBLE',
      roles: ['Responsible'],
    },
  });

  return { sapCrm, salesforce, ecommerce };
}

async function main() {
  console.log('Seeding workspace and users...');
  await seedWorkspaceAndUser();

  console.log('Seeding meta model...');
  const typeIdByKey = await seedMetaModel();

  console.log('Seeding sample fact sheets, relations, tags, subscriptions...');
  await seedSampleData(typeIdByKey);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
