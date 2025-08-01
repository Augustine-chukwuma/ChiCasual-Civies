const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const unzipper = require('unzipper');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dn71wkf7j',
  api_key: '297328628727681',
  api_secret: 'oqn56WmLwfOT7FK4RU1cX5nBvcA'
});

const app = express();
const PORT = 5000;
let products = [];
let currentId = 1;

// ---- MULTER SETUP ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- BACKUP + RESTORE ----
async function saveStateToCloudinary() {
  const tmpZip = '/tmp/business.zip';
  fs.writeFileSync('/tmp/products.json', JSON.stringify({ products, currentId }));
  const output = fs.createWriteStream(tmpZip);
  const archive = archiver('zip');
  archive.pipe(output);
  if (fs.existsSync('uploads')) archive.directory('uploads/', 'uploads');
  archive.file('/tmp/products.json', { name: 'products.json' });
  await archive.finalize();
  await cloudinary.uploader.upload(tmpZip, { resource_type: 'raw', public_id: 'business_backup', overwrite: true });
  console.log('✅ State backed up to Cloudinary');
}

async function loadStateFromCloudinary() {
  try {
    const { secure_url } = await cloudinary.api.resource('business_backup', { resource_type: 'raw' });
    const response = await axios({ url: secure_url, method: 'GET', responseType: 'stream' });
    await new Promise((resolve, reject) => {
      response.data.pipe(unzipper.Extract({ path: '.' })).on('close', resolve).on('error', reject);
    });
    if (fs.existsSync('products.json')) {
      const data = JSON.parse(fs.readFileSync('products.json', 'utf-8'));
      products = data.products || [];
      currentId = data.currentId || 1;
    }
    console.log('✅ State restored from Cloudinary');
  } catch (e) {
    console.log('⚠️ No backup found or failed to load');
  }
}

// ---- BUSINESS ROUTES ----
app.post('/business/save', async (req, res) => {
  await saveStateToCloudinary();
  res.json({ message: 'Business saved' });
});

app.get('/business/reload', async (req, res) => {
  await loadStateFromCloudinary();
  res.json({ message: 'Business reloaded' });
});

// ---- PRODUCT ROUTES ----
app.get('/products', (req, res) => res.json(products));
app.get('/products/search', (req, res) => {
  const q = req.query.q?.toLowerCase();
  if (!q) return res.status(400).json({ error: 'Search query required' });
  res.json(products.filter(p => p.name.toLowerCase().includes(q)));
});
app.get('/products/:id', (req, res) => {
  const product = products.find(p => p.id == req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});
app.post('/products', upload.single('image'), (req, res) => {
  const { name, price, category, description } = req.body;
  if (!name || !price || !category || !req.file)
    return res.status(400).json({ error: 'Missing fields' });
  const newProduct = {
    id: currentId++, name, price: parseFloat(price), category,
    description: description || '', image_url: `/uploads/${req.file.filename}`
  };
  products.push(newProduct);
  res.status(201).json(newProduct);
});
app.put('/products/:id', upload.single('image'), (req, res) => {
  const p = products.find(p => p.id == req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const { name, price, category, description } = req.body;
  if (name) p.name = name;
  if (price) p.price = parseFloat(price);
  if (category) p.category = category;
  if (description) p.description = description;
  if (req.file) p.image_url = `/uploads/${req.file.filename}`;
  res.json(p);
});
app.delete('/products/:id', (req, res) => {
  const index = products.findIndex(p => p.id == req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Product not found' });
  products.splice(index, 1);
  res.status(204).send();
});

// ---- STARTUP/SHUTDOWN ----
loadStateFromCloudinary();
process.on('SIGINT', async () => {
  await saveStateToCloudinary();
  process.exit();
});

app.listen(PORT, () => {
  console.log(`🛒 E-Commerce API running on http://localhost:${PORT}`);
});
