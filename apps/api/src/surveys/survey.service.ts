import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { LeanIxException } from '../common/exceptions/leanix.exception';
import { generateId, IdPrefix } from '../common/utils/id-generator';
import { CreateSurveyDefinitionDto, CreateSurveyRunDto, CreateInvitationDto, SubmitResponseDto } from '../rest/dto/survey.dto';

export interface SurveyResponseEnvelope<T> {
  status: 'OK';
  data: T;
}

@Injectable()
export class SurveyService {
  constructor(private readonly prisma: PrismaService) {}

  private wrap<T>(data: T): SurveyResponseEnvelope<T> {
    return { status: 'OK', data };
  }

  // --- Definitions ---------------------------------------------------

  async createDefinition(input: CreateSurveyDefinitionDto) {
    if (!input.name || !input.name.trim()) {
      throw new LeanIxException('VALIDATION_ERROR', 'name is required to create a survey definition');
    }
    if (!input.questions?.length) {
      throw new LeanIxException('VALIDATION_ERROR', 'questions must contain at least one question');
    }

    const definition = await this.prisma.surveyDefinition.create({
      data: {
        id: generateId(IdPrefix.SURVEY_DEFINITION),
        name: input.name,
        description: input.description,
        factSheetType: input.factSheetType,
        questions: input.questions as any,
      },
    });
    return this.wrap(definition);
  }

  async listDefinitions() {
    const definitions = await this.prisma.surveyDefinition.findMany({ orderBy: { createdAt: 'desc' } });
    return this.wrap(definitions);
  }

  async getDefinition(id: string) {
    const definition = await this.requireDefinition(id);
    return this.wrap(definition);
  }

  // --- Runs ------------------------------------------------------------

  async createRun(input: CreateSurveyRunDto) {
    await this.requireDefinition(input.definitionId);
    const run = await this.prisma.surveyRun.create({
      data: { id: generateId(IdPrefix.SURVEY_RUN), definitionId: input.definitionId },
    });
    return this.wrap(run);
  }

  async listRuns() {
    const runs = await this.prisma.surveyRun.findMany({ orderBy: { createdAt: 'desc' } });
    return this.wrap(runs);
  }

  async getRun(id: string) {
    const run = await this.requireRun(id);
    return this.wrap(run);
  }

  // --- Invitations -------------------------------------------------------

  async invite(runId: string, input: CreateInvitationDto) {
    await this.requireRun(runId);
    if (!input.userId) {
      throw new LeanIxException('VALIDATION_ERROR', 'userId is required to invite a respondent');
    }

    const invitation = await this.prisma.surveyInvitation.create({
      data: {
        id: generateId(IdPrefix.SURVEY_INVITATION),
        runId,
        userId: input.userId,
        factSheetId: input.factSheetId,
      },
    });
    return this.wrap(invitation);
  }

  async listInvitations(runId: string) {
    await this.requireRun(runId);
    const invitations = await this.prisma.surveyInvitation.findMany({
      where: { runId },
      include: { user: { select: { id: true, name: true, email: true } }, response: true },
      orderBy: { invitedAt: 'desc' },
    });
    return this.wrap(invitations);
  }

  // --- Responses -----------------------------------------------------------

  async submitResponse(runId: string, input: SubmitResponseDto) {
    await this.requireRun(runId);
    const invitation = await this.prisma.surveyInvitation.findUnique({ where: { id: input.invitationId } });
    if (!invitation || invitation.runId !== runId) {
      throw new LeanIxException('SURVEY_INVITATION_NOT_FOUND', `Invitation "${input.invitationId}" does not exist on run "${runId}"`);
    }
    if (!input.answers || Object.keys(input.answers).length === 0) {
      throw new LeanIxException('VALIDATION_ERROR', 'answers must contain at least one answer');
    }

    const [response] = await this.prisma.$transaction([
      this.prisma.surveyResponse.upsert({
        where: { invitationId: input.invitationId },
        update: { answers: input.answers as any },
        create: { id: generateId(IdPrefix.SURVEY_RESPONSE), invitationId: input.invitationId, answers: input.answers as any },
      }),
      this.prisma.surveyInvitation.update({ where: { id: input.invitationId }, data: { status: 'RESPONDED' } }),
    ]);
    return this.wrap(response);
  }

  // --- Results -----------------------------------------------------------

  async getResults(runId: string) {
    await this.requireRun(runId);
    const invitations = await this.prisma.surveyInvitation.findMany({
      where: { runId },
      include: { response: true },
    });

    const totalInvited = invitations.length;
    const totalResponded = invitations.filter((i) => i.response).length;

    return this.wrap({
      runId,
      totalInvited,
      totalResponded,
      responseRate: totalInvited === 0 ? 0 : Math.round((totalResponded / totalInvited) * 1000) / 10,
      responses: invitations.filter((i) => i.response).map((i) => ({ invitationId: i.id, userId: i.userId, answers: i.response!.answers })),
    });
  }

  private async requireDefinition(id: string) {
    const definition = await this.prisma.surveyDefinition.findUnique({ where: { id } });
    if (!definition) {
      throw new LeanIxException('SURVEY_DEFINITION_NOT_FOUND', `Survey definition "${id}" does not exist`, { id });
    }
    return definition;
  }

  private async requireRun(id: string) {
    const run = await this.prisma.surveyRun.findUnique({ where: { id } });
    if (!run) {
      throw new LeanIxException('SURVEY_RUN_NOT_FOUND', `Survey run "${id}" does not exist`, { id });
    }
    return run;
  }
}
