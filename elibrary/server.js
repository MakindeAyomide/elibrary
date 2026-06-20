const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data', 'materials.json');
const PDF_DIR = path.join(__dirname, 'uploads', 'pdfs');
const COVER_DIR = path.join(__dirname, 'uploads', 'covers');

[PDF_DIR, COVER_DIR, path.dirname(DATA_FILE)].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

// ---------- Helpers: flat JSON datastore ----------
function readMaterials() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error reading data file:', err);
    return [];
  }
}

function writeMaterials(materials) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(materials, null, 2));
}

// ---------- Multer storage config ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'pdf') cb(null, PDF_DIR);
    else if (file.fieldname === 'cover') cb(null, COVER_DIR);
    else cb(new Error('Unexpected field'), null);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${uuidv4()}${ext}`;
    cb(null, unique);
  }
});

function fileFilter(req, file, cb) {
  if (file.fieldname === 'pdf') {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed for the document field'));
  } else if (file.fieldname === 'cover') {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed for the cover field'));
  } else {
    cb(new Error('Unexpected field'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max per file
});

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads/pdfs', express.static(PDF_DIR));
app.use('/uploads/covers', express.static(COVER_DIR));

// ---------- Routes ----------

// Get all materials with optional search/filter
app.get('/api/materials', (req, res) => {
  let materials = readMaterials();
  const { search, category, uploader } = req.query;

  if (search) {
    const q = search.toLowerCase();
    materials = materials.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.author.toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q) ||
      (m.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (category && category !== 'all') {
    materials = materials.filter(m => m.category === category);
  }

  if (uploader) {
    materials = materials.filter(m => m.uploadedBy.toLowerCase() === uploader.toLowerCase());
  }

  materials.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  res.json(materials);
});

// Get distinct categories (for filter dropdown)
app.get('/api/categories', (req, res) => {
  const materials = readMaterials();
  const categories = [...new Set(materials.map(m => m.category))].filter(Boolean).sort();
  res.json(categories);
});

// Get a single material by id
app.get('/api/materials/:id', (req, res) => {
  const materials = readMaterials();
  const material = materials.find(m => m.id === req.params.id);
  if (!material) return res.status(404).json({ error: 'Material not found' });
  res.json(material);
});

// Upload a new material (pdf + cover image + metadata)
app.post('/api/materials', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'cover', maxCount: 1 }
]), (req, res) => {
  try {
    const { title, author, category, description, uploadedBy, tags } = req.body;

    if (!title || !author || !uploadedBy) {
      return res.status(400).json({ error: 'Title, author, and uploader name are required' });
    }
    if (!req.files || !req.files.pdf) {
      return res.status(400).json({ error: 'A PDF file is required' });
    }

    const pdfFile = req.files.pdf[0];
    const coverFile = req.files.cover ? req.files.cover[0] : null;

    const materials = readMaterials();
    const newMaterial = {
      id: uuidv4(),
      title: title.trim(),
      author: author.trim(),
      category: category ? category.trim() : 'Uncategorized',
      description: description ? description.trim() : '',
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      uploadedBy: uploadedBy.trim(),
      pdfFilename: pdfFile.filename,
      pdfOriginalName: pdfFile.originalname,
      coverFilename: coverFile ? coverFile.filename : null,
      fileSize: pdfFile.size,
      uploadDate: new Date().toISOString(),
      downloads: 0
    };

    materials.push(newMaterial);
    writeMaterials(materials);

    res.status(201).json(newMaterial);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload material' });
  }
});

// Download a PDF (increments download counter)
app.get('/api/materials/:id/download', (req, res) => {
  const materials = readMaterials();
  const material = materials.find(m => m.id === req.params.id);
  if (!material) return res.status(404).json({ error: 'Material not found' });

  const filePath = path.join(PDF_DIR, material.pdfFilename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on server' });

  material.downloads = (material.downloads || 0) + 1;
  writeMaterials(materials);

  res.download(filePath, material.pdfOriginalName || `${material.title}.pdf`);
});

// Delete a material (only the uploader should call this from the UI)
app.delete('/api/materials/:id', (req, res) => {
  const materials = readMaterials();
  const idx = materials.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Material not found' });

  const [removed] = materials.splice(idx, 1);

  const pdfPath = path.join(PDF_DIR, removed.pdfFilename);
  if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  if (removed.coverFilename) {
    const coverPath = path.join(COVER_DIR, removed.coverFilename);
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
  }

  writeMaterials(materials);
  res.json({ success: true });
});

// Error handler for multer & general errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Fallback to index.html for the SPA
app.get('*', (req, res) => {
  res.sendFile ? null : null;
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`E-Library server running at http://localhost:${PORT}`);
});
