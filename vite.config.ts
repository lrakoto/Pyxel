import { defineConfig, type Plugin } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TUNING_SCHEMA } from './src/tuningSchema';

function num(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`non-finite value: ${v}`);
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(4));
}

/**
 * Renders the canonical tuning.ts. Always emits every schema key in schema
 * order, so a partial or reordered payload can never drop or shuffle keys —
 * a missing key throws rather than silently clobbering the file.
 */
function renderTuning(values: Record<string, unknown>): string {
  const lines = TUNING_SCHEMA.map((p) => {
    if (!(p.key in values)) throw new Error(`missing tuning key: ${p.key}`);
    return `  ${p.key}: ${num(values[p.key])},`;
  });
  return (
    `// Live-tunable scene values. The numbers below are rewritten in place by the\n` +
    `// in-app tuning panel's Save button (dev server only) — prefer adjusting them\n` +
    `// with the sliders rather than editing by hand, so the panel stays in sync.\n` +
    `export const TUNING = {\n${lines.join('\n')}\n};\n\n` +
    `export type TuningKey = keyof typeof TUNING;\n`
  );
}

/** Dev-only endpoint: POST /__tune/save rewrites src/tuning.ts. */
function tuningSaver(): Plugin {
  return {
    name: 'tuning-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__tune/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const values = JSON.parse(body);
            writeFileSync(resolve(__dirname, 'src/tuning.ts'), renderTuning(values));
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [tuningSaver()],
});
