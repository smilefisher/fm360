export interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const startedAt = Date.now();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({
        ok: true,
        app: 'fm360',
        version: '0.1.0',
        uptime: Math.round((Date.now() - startedAt) / 1000),
        now: Date.now(),
      });
    }

    return env.ASSETS.fetch(request);
  },

  // M1: catalog → probe → publish → cleanup
  async scheduled(): Promise<void> {
    // 数据管线在下一个里程碑接入。
  },
};
