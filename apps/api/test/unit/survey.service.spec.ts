import { SurveyService } from '../../src/surveys/survey.service';
import { LeanIxException } from '../../src/common/exceptions/leanix.exception';

function buildPrismaMock() {
  const mock: any = {
    surveyDefinition: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    surveyRun: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    surveyInvitation: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    surveyResponse: { upsert: jest.fn() },
  };
  mock.$transaction = jest.fn(async (ops: any[]) => Promise.all(ops));
  return mock;
}

describe('SurveyService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: SurveyService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new SurveyService(prisma as any);
  });

  it('creates a survey definition with at least one question', async () => {
    prisma.surveyDefinition.create.mockResolvedValue({ id: 'def-1', name: 'Owner check' });
    const result = await service.createDefinition({ name: 'Owner check', questions: [{ id: 'q1', text: 'Still active?' }] });
    expect(result.data.id).toBe('def-1');
  });

  it('rejects a definition with no questions', async () => {
    await expect(service.createDefinition({ name: 'Owner check', questions: [] })).rejects.toThrow(LeanIxException);
  });

  it('rejects creating a run against a nonexistent definition', async () => {
    prisma.surveyDefinition.findUnique.mockResolvedValue(null);
    await expect(service.createRun({ definitionId: 'missing' })).rejects.toThrow(LeanIxException);
  });

  it('rejects an invitation without a userId', async () => {
    prisma.surveyRun.findUnique.mockResolvedValue({ id: 'run-1' });
    await expect(service.invite('run-1', { userId: '' } as any)).rejects.toThrow(LeanIxException);
  });

  it('rejects a response for an invitation belonging to a different run', async () => {
    prisma.surveyRun.findUnique.mockResolvedValue({ id: 'run-1' });
    prisma.surveyInvitation.findUnique.mockResolvedValue({ id: 'inv-1', runId: 'run-2' });
    await expect(service.submitResponse('run-1', { invitationId: 'inv-1', answers: { q1: 'yes' } })).rejects.toThrow(LeanIxException);
  });

  it('does not select sensitive user fields when listing invitations', async () => {
    prisma.surveyRun.findUnique.mockResolvedValue({ id: 'run-1' });
    prisma.surveyInvitation.findMany.mockResolvedValue([]);

    await service.listInvitations('run-1');

    expect(prisma.surveyInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ user: { select: { id: true, name: true, email: true } } }),
      }),
    );
  });

  it('computes response rate in results', async () => {
    prisma.surveyRun.findUnique.mockResolvedValue({ id: 'run-1' });
    prisma.surveyInvitation.findMany.mockResolvedValue([
      { id: 'inv-1', userId: 'user-1', response: { answers: { q1: 'yes' } } },
      { id: 'inv-2', userId: 'user-2', response: null },
    ]);

    const result = await service.getResults('run-1');

    expect(result.data.totalInvited).toBe(2);
    expect(result.data.totalResponded).toBe(1);
    expect(result.data.responseRate).toBe(50);
  });
});
