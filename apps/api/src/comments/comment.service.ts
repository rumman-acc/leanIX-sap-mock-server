import { Injectable } from '@nestjs/common';
import { JwtClaims } from '@leanix-mock/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { LeanIxException } from '../common/exceptions/leanix.exception';
import { generateId, IdPrefix } from '../common/utils/id-generator';

const COMMENT_INCLUDE = { user: true } as const;

export interface CommentResponse<T> {
  status: 'OK';
  data: T;
}

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  private wrap<T>(data: T): CommentResponse<T> {
    return { status: 'OK', data };
  }

  private toDto(comment: { id: string; factSheetId: string; message: string; createdAt: Date; user: { id: string; name: string; email: string } }) {
    return {
      id: comment.id,
      factSheetId: comment.factSheetId,
      message: comment.message,
      author: { id: comment.user.id, name: comment.user.name, email: comment.user.email },
      createdAt: comment.createdAt,
    };
  }

  async create(factSheetId: string, message: string, actor: JwtClaims) {
    await this.requireFactSheet(factSheetId);
    if (!message || !message.trim()) {
      throw new LeanIxException('VALIDATION_ERROR', 'message is required to create a comment');
    }

    const comment = await this.prisma.comment.create({
      data: {
        id: generateId(IdPrefix.COMMENT),
        factSheetId,
        userId: actor.sub,
        message,
      },
      include: COMMENT_INCLUDE,
    });
    return this.wrap(this.toDto(comment));
  }

  async listForFactSheet(factSheetId: string) {
    await this.requireFactSheet(factSheetId);
    const comments = await this.prisma.comment.findMany({
      where: { factSheetId },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return this.wrap(comments.map((c) => this.toDto(c)));
  }

  private async requireFactSheet(factSheetId: string) {
    const factSheet = await this.prisma.factSheet.findUnique({ where: { id: factSheetId } });
    if (!factSheet) {
      throw new LeanIxException('FACT_SHEET_NOT_FOUND', `Fact sheet "${factSheetId}" does not exist`, { id: factSheetId });
    }
    return factSheet;
  }
}
