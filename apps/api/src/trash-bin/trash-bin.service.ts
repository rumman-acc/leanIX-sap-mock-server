import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TrashBinService {
  constructor(private readonly prisma: PrismaService) {}

  async listEntries() {
    return this.prisma.trashBinEntry.findMany({ orderBy: { autoDeleteAt: 'asc' } });
  }

  async findExpiredEntries(now: Date = new Date()) {
    return this.prisma.trashBinEntry.findMany({ where: { autoDeleteAt: { lte: now } } });
  }
}
