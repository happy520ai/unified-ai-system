// Tool definitions shared by the MCP server and the HTTP demo.
import { DOMAIN_TO_TYPE } from './agent.js';

export const TOOLS = [
  {
    name: 'taste_recommend',
    description:
      'Turn things a person loves (artists, films, books, places, brands) into culturally grounded picks across other domains using Qloo Taste AI.',
    inputSchema: {
      type: 'object',
      properties: {
        likes: { type: 'array', items: { type: 'string' }, description: 'Names the person loves, e.g. ["Wong Kar-wai", "Radiohead"]' },
        goal: { type: 'string', description: 'What they want, e.g. "date night in Shanghai" or "a birthday gift"' },
        domains: { type: 'array', items: { type: 'string', enum: Object.keys(DOMAIN_TO_TYPE) } },
        location: { type: 'string', description: 'City or neighborhood for dining picks' },
        take: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
      },
      required: ['likes'],
    },
  },
  {
    name: 'taste_resolve',
    description: 'Resolve free-text names to Qloo entity ids and types.',
    inputSchema: {
      type: 'object',
      properties: { likes: { type: 'array', items: { type: 'string' } } },
      required: ['likes'],
    },
  },
];

export async function callTool(agent, name, args = {}) {
  if (name === 'taste_recommend') return agent.recommend(args);
  if (name === 'taste_resolve') return agent.resolveSeeds(args.likes || []);
  throw new Error(`Unknown tool: ${name}`);
}
