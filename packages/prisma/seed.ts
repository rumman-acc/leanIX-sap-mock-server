import { PrismaClient } from './generated';
import {
  DEFAULT_FACT_SHEET_TYPES,
  DEFAULT_RELATION_TYPES,
} from '../shared/src/constants/default-meta-model';

const prisma = new PrismaClient();

const WORKSPACE_ID = 'ws-development';
const TECH_USER_ID = 'user-technical';

// A second workspace, seeded with its own meta model and a small portfolio that deliberately
// overlaps (by NAME, not id — matching how a real M&A due-diligence dataset would look) with
// ws-development's. This is what makes M&A Architecture Assessment testable at all: it needs two
// real, separately-scoped workspaces to compare, not one workspace with more data in it. See
// LeanIX_Mock_UseCase_Coverage_Analysis.md §6 tier B.
const WORKSPACE_2_ID = 'ws-acquired-co';
const TECH_USER_2_ID = 'user-technical-acquired';

// The technical user's API credential is the ONLY thing the OAuth token endpoint accepts (no
// pattern/prefix shortcuts — see apps/api/src/auth/auth.service.ts). Configure your own via
// LEANIX_API_TOKEN/LEANIX_API_TOKEN_SECRET before seeding to register a different credential;
// re-running the seed rotates it. Falls back to the repo's documented dev defaults.
const TECH_USER_API_TOKEN = process.env.LEANIX_API_TOKEN ?? 'dev-token-12345';
const TECH_USER_API_TOKEN_SECRET = process.env.LEANIX_API_TOKEN_SECRET ?? 'dev-secret-67890';

// Second workspace's credential is independently configurable too, but has its own fixed
// dev default — a real multi-workspace setup issues one token per workspace, never a token
// that spans two, so exercising the M&A use case means authenticating twice, once per workspace.
const TECH_USER_2_API_TOKEN = process.env.LEANIX_API_TOKEN_ACQUIRED ?? 'dev-token-acquired-11111';
const TECH_USER_2_API_TOKEN_SECRET = process.env.LEANIX_API_TOKEN_SECRET_ACQUIRED ?? 'dev-secret-acquired-22222';

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

  await prisma.workspace.upsert({
    where: { id: WORKSPACE_2_ID },
    update: {},
    create: {
      id: WORKSPACE_2_ID,
      name: 'acquired-co',
      displayName: 'Acquired Co',
      description: 'Second workspace — a would-be acquisition target, for M&A Architecture Assessment',
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
    where: { id: TECH_USER_2_ID },
    update: {
      apiToken: TECH_USER_2_API_TOKEN,
      apiTokenSecret: TECH_USER_2_API_TOKEN_SECRET,
    },
    create: {
      id: TECH_USER_2_ID,
      email: 'technical-user@acquired-co.mock.local',
      name: 'Acquired Co Technical User',
      role: 'ADMIN',
      workspaceId: WORKSPACE_2_ID,
      apiToken: TECH_USER_2_API_TOKEN,
      apiTokenSecret: TECH_USER_2_API_TOKEN_SECRET,
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

async function seedMetaModel(workspaceId: string) {
  const typeIdByKey = new Map<string, string>();

  for (const type of DEFAULT_FACT_SHEET_TYPES) {
    const id = `type-${workspaceId}-${type.technicalKey}`;
    typeIdByKey.set(type.technicalKey, id);

    await prisma.factSheetType.upsert({
      where: { workspaceId_technicalKey: { workspaceId, technicalKey: type.technicalKey } },
      update: {
        label: type.label,
        description: type.description,
        icon: type.icon,
        color: type.color,
      },
      create: {
        id,
        workspaceId,
        technicalKey: type.technicalKey,
        label: type.label,
        description: type.description,
        icon: type.icon,
        color: type.color,
      },
    });

    for (const attr of type.attributes) {
      const attrId = `attr-${workspaceId}-${type.technicalKey}-${attr.technicalKey}`;
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
                id: `av-${workspaceId}-${type.technicalKey}-${attr.technicalKey}-${av.value}`,
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
        workspaceId_sourceTypeId_targetTypeId_technicalKey: {
          workspaceId,
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
        id: `reltype-${workspaceId}-${rel.technicalKey}`,
        workspaceId,
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
  workspaceId: string;
  typeId: string;
  name: string;
  description?: string;
  externalId?: string;
  lifecycle?: unknown;
  createdBy?: string;
}) {
  const createdBy = opts.createdBy ?? TECH_USER_ID;
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
      workspaceId: opts.workspaceId,
      typeId: opts.typeId,
      name: opts.name,
      displayName: opts.name,
      description: opts.description,
      externalId: opts.externalId,
      lifecycle: opts.lifecycle as any,
      status: 'ACTIVE',
      qualitySeal: 'BROKEN',
      completion: 25,
      createdBy,
      updatedBy: createdBy,
    },
  });
}

async function upsertAttributeValue(factSheetId: string, factSheetTypeId: string, technicalKey: string, value: string) {
  const attribute = await prisma.attribute.findUnique({
    where: { factSheetTypeId_technicalKey: { factSheetTypeId, technicalKey } },
  });
  if (!attribute) return;
  await prisma.attributeValue.upsert({
    where: { factSheetId_attributeId: { factSheetId, attributeId: attribute.id } },
    update: { value },
    create: { id: `av-${factSheetId}-${technicalKey}`, factSheetId, attributeId: attribute.id, value },
  });
}

async function seedSampleData(typeIdByKey: Map<string, string>) {
  const appTypeId = typeIdByKey.get('Application')!;
  const itcTypeId = typeIdByKey.get('ITComponent')!;
  const bcTypeId = typeIdByKey.get('BusinessCapability')!;
  const providerTypeId = typeIdByKey.get('Provider')!;

  const sapCrm = await upsertFactSheet({
    id: 'fs-app-sap-crm',
    workspaceId: WORKSPACE_ID,
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
    workspaceId: WORKSPACE_ID,
    typeId: appTypeId,
    name: 'Salesforce',
    description: 'Sales force automation',
    externalId: 'SF-001',
  });

  const ecommerce = await upsertFactSheet({
    id: 'fs-app-ecommerce',
    workspaceId: WORKSPACE_ID,
    typeId: appTypeId,
    name: 'E-Commerce Platform',
    description: 'Customer-facing online store',
    externalId: 'ECOM-100',
  });

  const ec2 = await upsertFactSheet({
    id: 'fs-itc-aws-ec2',
    workspaceId: WORKSPACE_ID,
    typeId: itcTypeId,
    name: 'AWS EC2 Instance',
    description: 'Compute instance',
    externalId: 'AWS-EC2-001',
  });

  const pg = await upsertFactSheet({
    id: 'fs-itc-postgres',
    workspaceId: WORKSPACE_ID,
    typeId: itcTypeId,
    name: 'PostgreSQL Database',
    description: 'Relational database',
    externalId: 'PG-001',
  });

  const salesCapability = await upsertFactSheet({
    id: 'fs-bc-sales',
    workspaceId: WORKSPACE_ID,
    typeId: bcTypeId,
    name: 'Sales Management',
    description: 'Managing the end-to-end sales process',
    externalId: 'BC-SALES',
  });

  const aws = await upsertFactSheet({
    id: 'fs-provider-aws',
    workspaceId: WORKSPACE_ID,
    typeId: providerTypeId,
    name: 'Amazon Web Services',
    description: 'Cloud infrastructure provider',
    externalId: 'PROVIDER-AWS',
  });

  const techCategoryTypeId = typeIdByKey.get('TechCategory')!;
  const objectiveTypeId = typeIdByKey.get('Objective')!;
  const aiAgentTypeId = typeIdByKey.get('AIAgent')!;

  const approvedCloud = await upsertFactSheet({
    id: 'fs-techcat-approved-cloud',
    workspaceId: WORKSPACE_ID,
    typeId: techCategoryTypeId,
    name: 'Approved Cloud Providers',
    description: 'Cloud infrastructure providers cleared for production use',
    externalId: 'STD-CLOUD-001',
  });

  const deprecatedFrameworks = await upsertFactSheet({
    id: 'fs-techcat-deprecated-frameworks',
    workspaceId: WORKSPACE_ID,
    typeId: techCategoryTypeId,
    name: 'Deprecated Frameworks',
    description: 'Frameworks slated for retirement — no new usage permitted',
    externalId: 'STD-DEPR-001',
  });

  const growDigitalRevenue = await upsertFactSheet({
    id: 'fs-objective-grow-digital-revenue',
    workspaceId: WORKSPACE_ID,
    typeId: objectiveTypeId,
    name: 'Grow Digital Revenue',
    description: 'Increase revenue attributable to digital sales channels',
    externalId: 'OBJ-001',
  });

  const eaCopilot = await upsertFactSheet({
    id: 'fs-aiagent-ea-copilot',
    workspaceId: WORKSPACE_ID,
    typeId: aiAgentTypeId,
    name: 'EA Copilot',
    description: 'Conversational agent answering architecture questions over the fact sheet repository',
    externalId: 'AGENT-001',
  });

  await upsertAttributeValue(approvedCloud.id, techCategoryTypeId, 'standardStatus', 'approved');
  await upsertAttributeValue(deprecatedFrameworks.id, techCategoryTypeId, 'standardStatus', 'deprecated');
  await upsertAttributeValue(eaCopilot.id, aiAgentTypeId, 'agentType', 'assistant');
  await upsertAttributeValue(eaCopilot.id, aiAgentTypeId, 'riskClassification', 'medium');
  await upsertAttributeValue(eaCopilot.id, aiAgentTypeId, 'modelProvider', 'Anthropic');

  const relTypes = await prisma.relationType.findMany({ where: { workspaceId: WORKSPACE_ID } });
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
  await upsertRelation('rel-ecom-approvedcloud', 'relApplicationToTechCategory', ecommerce.id, approvedCloud.id);
  await upsertRelation('rel-sales-growrevenue', 'relBusinessCapabilityToObjective', salesCapability.id, growDigitalRevenue.id);
  await upsertRelation('rel-eacopilot-sapcrm', 'relAIAgentToApplication', eaCopilot.id, sapCrm.id);
  await upsertRelation('rel-eacopilot-sales', 'relAIAgentToBusinessCapability', eaCopilot.id, salesCapability.id);

  // Tags
  const statusGroup = await prisma.tagGroup.upsert({
    where: { workspaceId_name: { workspaceId: WORKSPACE_ID, name: 'status' } },
    update: {},
    create: { id: 'taggroup-status', workspaceId: WORKSPACE_ID, name: 'status', description: 'Lifecycle status tags' },
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

/**
 * Second workspace's portfolio — deliberately small, and deliberately overlapping BY NAME (not
 * id) with ws-development's Applications/ITComponents. A real M&A due-diligence dataset is
 * exactly this shape: two independently-maintained inventories that happen to describe some of
 * the same real-world systems under slightly different names ("SAP CRM" vs "SAP Customer 360").
 */
async function seedAcquiredCoSampleData(typeIdByKey: Map<string, string>) {
  const appTypeId = typeIdByKey.get('Application')!;
  const itcTypeId = typeIdByKey.get('ITComponent')!;
  const providerTypeId = typeIdByKey.get('Provider')!;

  const crm2 = await upsertFactSheet({
    id: 'fs2-app-sap-customer-360',
    workspaceId: WORKSPACE_2_ID,
    typeId: appTypeId,
    name: 'SAP Customer 360',
    description: 'CRM system — same underlying SAP CRM product, different local naming',
    externalId: 'ACQ-CRM-001',
    createdBy: TECH_USER_2_ID,
  });

  const ecom2 = await upsertFactSheet({
    id: 'fs2-app-online-store',
    workspaceId: WORKSPACE_2_ID,
    typeId: appTypeId,
    name: 'Online Store',
    description: 'Customer-facing e-commerce storefront',
    externalId: 'ACQ-ECOM-001',
    createdBy: TECH_USER_2_ID,
  });

  const hrSystem = await upsertFactSheet({
    id: 'fs2-app-hr-system',
    workspaceId: WORKSPACE_2_ID,
    typeId: appTypeId,
    name: 'Workday HR',
    description: 'HR and payroll system — no equivalent in ws-development',
    externalId: 'ACQ-HR-001',
    createdBy: TECH_USER_2_ID,
  });

  const azureVm = await upsertFactSheet({
    id: 'fs2-itc-azure-vm',
    workspaceId: WORKSPACE_2_ID,
    typeId: itcTypeId,
    name: 'Azure VM',
    description: 'Compute instance — different cloud provider than ws-development\'s AWS EC2',
    externalId: 'ACQ-AZURE-VM-001',
    createdBy: TECH_USER_2_ID,
  });

  const azure = await upsertFactSheet({
    id: 'fs2-provider-azure',
    workspaceId: WORKSPACE_2_ID,
    typeId: providerTypeId,
    name: 'Microsoft Azure',
    description: 'Cloud infrastructure provider',
    externalId: 'ACQ-PROVIDER-AZURE',
    createdBy: TECH_USER_2_ID,
  });

  const relTypes = await prisma.relationType.findMany({ where: { workspaceId: WORKSPACE_2_ID } });
  const relTypeByKey = new Map(relTypes.map((r) => [r.technicalKey, r]));

  async function upsertRelation(id: string, technicalKey: string, sourceId: string, targetId: string) {
    const relType = relTypeByKey.get(technicalKey);
    if (!relType) return;
    await prisma.relation.upsert({
      where: { relationTypeId_sourceId_targetId: { relationTypeId: relType.id, sourceId, targetId } },
      update: {},
      create: { id, relationTypeId: relType.id, sourceId, targetId },
    });
  }

  await upsertRelation('rel2-ecom-azurevm', 'relApplicationToITComponent', ecom2.id, azureVm.id);
  await upsertRelation('rel2-azurevm-azure', 'relITComponentToProvider', azureVm.id, azure.id);

  return { crm2, ecom2, hrSystem };
}

async function main() {
  console.log('Seeding workspaces and users...');
  await seedWorkspaceAndUser();

  console.log('Seeding meta model (ws-development)...');
  const typeIdByKey = await seedMetaModel(WORKSPACE_ID);

  console.log('Seeding meta model (ws-acquired-co)...');
  const typeIdByKey2 = await seedMetaModel(WORKSPACE_2_ID);

  console.log('Seeding sample fact sheets, relations, tags, subscriptions (ws-development)...');
  await seedSampleData(typeIdByKey);

  console.log('Seeding sample fact sheets, relations (ws-acquired-co)...');
  await seedAcquiredCoSampleData(typeIdByKey2);

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
