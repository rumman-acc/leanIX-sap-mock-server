import axios, { AxiosInstance } from 'axios';

export interface LeanIxClientConfig {
  baseUrl: string;
  apiToken: string;
  apiTokenSecret: string;
  /**
   * Skip this client's own OAuth exchange and use an already-obtained JWT directly — used by
   * the remote HTTP MCP endpoint (apps/api/src/mcp-server), which resolves the caller's own
   * Authorization header into a JWT itself and hands it here rather than minting a second one
   * against a fixed technical user.
   */
  presetToken?: string;
}

/**
 * Thin client the MCP tools share to talk to the mock server over the same GraphQL/REST APIs
 * (and the same OAuth token flow) any other consumer would use — per spec 13.3, MCP does not
 * get a separate auth path.
 */
export class LeanIxClient {
  private http: AxiosInstance;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: LeanIxClientConfig) {
    this.http = axios.create({ baseURL: config.baseUrl, timeout: 30_000 });
  }

  private async ensureToken(): Promise<string> {
    if (this.config.presetToken) {
      return this.config.presetToken;
    }
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');
    params.set('client_id', this.config.apiToken);
    params.set('client_secret', this.config.apiTokenSecret);

    const res = await this.http.post('/services/mtm/v1/oauth2/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    this.token = res.data.access_token;
    // refresh a little early to avoid racing token expiry
    this.tokenExpiresAt = Date.now() + (res.data.expires_in - 30) * 1000;
    return this.token!;
  }

  async graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const token = await this.ensureToken();
    const res = await this.http.post(
      '/services/pathfinder/v1/graphql',
      { query, variables },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.data.errors?.length) {
      throw new Error(res.data.errors.map((e: { message: string }) => e.message).join('; '));
    }
    return res.data.data as T;
  }

  async get<T = unknown>(path: string): Promise<T> {
    const token = await this.ensureToken();
    const res = await this.http.get(path, { headers: { Authorization: `Bearer ${token}` } });
    return res.data as T;
  }
}
