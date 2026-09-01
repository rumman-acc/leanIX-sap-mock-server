import { Controller, Delete, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { LeanIxClient, registerFactSheetTools, registerInventoryTools, registerRelationTools } from '@leanix-mock/mcp';
import { Public } from '../common/decorators/public.decorator';
import { LeanIxConfig } from '../config/leanix.config';
import { McpServerAuthService } from './mcp-server-auth.service';

const AVAILABLE_TOOLSETS = ['inventory'];

/**
 * Real LeanIX's MCP contract, verified against SAP's own setup docs (github.com/SAP/leanix-ai-
 * plugins/blob/main/MCP-SETUP.md, docs/API_REFERENCE.md): path `/services/mcp-server/v1/mcp`,
 * Streamable HTTP transport, `Authorization: Token <api-token>` or `Bearer <jwt>`, tool exposure
 * gated by `?toolsets=`. Registered @Public() — auth here is the Token/Bearer contract above,
 * parsed by McpServerAuthService, not the global Bearer-only LeanIxAuthGuard.
 */
@Controller('services/mcp-server/v1/mcp')
export class McpServerController {
  constructor(
    private readonly mcpAuth: McpServerAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post()
  async handlePost(@Req() req: Request, @Res() res: Response): Promise<void> {
    let jwt: string;
    try {
      ({ jwt } = await this.mcpAuth.resolve(req.headers.authorization));
    } catch (err) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: err instanceof Error ? err.message : 'Unauthorized' },
        id: null,
      });
      return;
    }

    const requestedToolsets = this.parseToolsets(req.query.toolsets);

    const config = this.configService.get<LeanIxConfig>('leanix')!;
    // Loopback, not the public LEANIX_BASE_URL — this process is already the target.
    const client = new LeanIxClient({
      baseUrl: `http://localhost:${config.port}`,
      apiToken: '',
      apiTokenSecret: '',
      presetToken: jwt,
    });

    const server = new McpServer({ name: 'leanix-mock-mcp', version: '1.0.0' });
    if (requestedToolsets.includes('inventory')) {
      registerInventoryTools(server, client);
      registerFactSheetTools(server, client);
      registerRelationTools(server, client);
    }

    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        transport.close();
        server.close();
      });
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: err instanceof Error ? err.message : 'Internal server error' },
          id: null,
        });
      }
    }
  }

  @Public()
  @Get()
  handleGet(@Res() res: Response): void {
    this.methodNotAllowed(res);
  }

  @Public()
  @Delete()
  handleDelete(@Res() res: Response): void {
    this.methodNotAllowed(res);
  }

  private methodNotAllowed(res: Response): void {
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  }

  /**
   * `?toolsets=` unset → default to `inventory` (mock-only leniency; real LeanIX returns nothing
   * if omitted, per its own docs, but an agent platform that forgot the param shouldn't just get
   * an empty toolbox with no explanation). `?toolsets=` set → only the listed toolsets, matching
   * real behavior exactly (currently `inventory` is the only one this mock has).
   */
  private parseToolsets(raw: unknown): string[] {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return AVAILABLE_TOOLSETS;
    }
    return raw.split(',').map((t) => t.trim());
  }
}
