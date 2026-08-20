export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const response = await fetch('https://raw.githubusercontent.com/Kgarmon99/moneybotlab/main/papers.json');
    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load papers', message: error.message });
  }
}
