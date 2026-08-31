import { Injectable } from '@nestjs/common';
import { JwtClaims, Patch } from '@leanix-mock/shared';
import { LeanIxException } from '../common/exceptions/leanix.exception';
import { FactSheetService } from '../graphql/services/fact-sheet.service';
import { FactSheetPatchService } from '../graphql/services/fact-sheet-patch.service';
import { DiscoverAgentDto } from '../rest/dto/ai-agent-discovery.dto';

@Injectable()
export class AiAgentDiscoveryService {
  constructor(
    private readonly factSheetService: FactSheetService,
    private readonly patchService: FactSheetPatchService,
  ) {}

  /**
   * Upserts an AI agent card as an `AIAgent` fact sheet, reusing the same create/patch logic
   * every other fact sheet write goes through — no separate persistence path for AI agents.
   */
  async discover(input: DiscoverAgentDto, actor: JwtClaims) {
    if (!input.name || !input.name.trim()) {
      throw new LeanIxException('VALIDATION_ERROR', 'name is required to register an AI agent');
    }

    const factSheet = await this.factSheetService.create(
      { name: input.name, type: 'AIAgent', description: input.description, externalId: input.externalId },
      actor,
    );

    const patches: Patch[] = [];
    if (input.agentType) patches.push({ op: 'replace', path: '/agentType', value: input.agentType });
    if (input.riskClassification) patches.push({ op: 'replace', path: '/riskClassification', value: input.riskClassification });
    if (input.modelProvider) patches.push({ op: 'replace', path: '/modelProvider', value: input.modelProvider });

    if (patches.length === 0) {
      return { status: 'OK' as const, data: factSheet };
    }

    const updated = await this.patchService.update(factSheet.id, patches, actor);
    return { status: 'OK' as const, data: updated };
  }
}
