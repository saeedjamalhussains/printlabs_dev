import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  assistantChatRequestSchema,
  assistantChatResponseSchema,
  chatApiResponseSchema,
} from './index.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(packageRoot, 'json');
const schemas = {
  'assistant-chat-request.schema.json': assistantChatRequestSchema,
  'assistant-chat-response.schema.json': assistantChatResponseSchema,
  'chat-api-response.schema.json': chatApiResponseSchema,
};

await mkdir(outputDirectory, { recursive: true });
for (const [filename, schema] of Object.entries(schemas)) {
  const jsonSchema = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  });
  await writeFile(
    resolve(outputDirectory, filename),
    `${JSON.stringify(jsonSchema, null, 2)}\n`
  );
}
