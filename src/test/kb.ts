import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { KnowledgeBase } from '../core/types';

/** The demo clinic knowledge base, read from disk so tests exercise the real content. */
export const clinicKb = JSON.parse(
  readFileSync(resolve(__dirname, '../../public/kb/brightsmile.json'), 'utf-8'),
) as KnowledgeBase;
