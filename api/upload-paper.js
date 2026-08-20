const OWNER = 'Kgarmon99';
const REPO = 'moneybotlab';
const BRANCH = 'main';

function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function githubApi(path, token, options = {}) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${token}`,
      'User-Agent': 'moneybotlab-admin',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(data.message || `GitHub API error: ${response.status}`);
  }

  return data;
}

async function getFileSha(path, token) {
  try {
    const data = await githubApi(`/contents/${path}?ref=${BRANCH}`, token);
    return data.sha;
  } catch (error) {
    if (error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

async function commitFile(path, content, message, token, sha = null) {
  const body = {
    message,
    content,
    branch: BRANCH
  };
  if (sha) {
    body.sha = sha;
  }

  return githubApi(`/contents/${path}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { password, title, authors, category, abstract, date, pdfBase64, filename } = req.body;

    if (!password || password !== process.env.PAPER_ADMIN_PASSWORD) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    if (!title || !authors || !category || !abstract || !date || !pdfBase64) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const validCategories = ['EdTech', 'FinTech', 'MediaTech', 'ImmersiveTech'];
    if (!validCategories.includes(category)) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }

    const token = process.env.GH_TOKEN;
    if (!token) {
      res.status(500).json({ error: 'Server configuration error: missing GitHub token' });
      return;
    }

    const slug = toSlug(title);
    const pdfPath = `public/papers/${slug}.pdf`;

    // Get current papers.json
    let papers = { papers: [] };
    let papersSha = null;
    try {
      const papersFile = await githubApi(`/contents/papers.json?ref=${BRANCH}`, token);
      const papersContent = Buffer.from(papersFile.content, 'base64').toString('utf-8');
      papers = JSON.parse(papersContent);
      papersSha = papersFile.sha;
    } catch (error) {
      if (!error.message.includes('404')) {
        throw error;
      }
    }

    // Check for duplicate slug
    if (papers.papers.some(p => p.slug === slug)) {
      res.status(409).json({ error: 'A paper with this title already exists' });
      return;
    }

    // Add new paper
    const newPaper = {
      id: slug,
      slug,
      title,
      authors,
      category,
      date,
      abstract,
      pdfUrl: `/papers/${slug}.pdf`,
      filename: filename || `${slug}.pdf`
    };

    papers.papers.unshift(newPaper);

    // Commit PDF
    await commitFile(pdfPath, pdfBase64, `Add research paper: ${title}`, token);

    // Commit updated papers.json
    const updatedPapersJson = Buffer.from(JSON.stringify(papers, null, 2)).toString('base64');
    await commitFile('papers.json', updatedPapersJson, `Update papers.json: add ${title}`, token, papersSha);

    res.status(200).json({
      success: true,
      paper: newPaper,
      message: 'Paper uploaded successfully. Site will rebuild in 30-60 seconds.'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
}
