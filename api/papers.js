import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const filePath = join(process.cwd(), 'papers.json');
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load papers', message: error.message });
  }
}
