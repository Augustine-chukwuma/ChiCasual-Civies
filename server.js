const express = require('express');
const cors = require('cors');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// === Cloudinary Configuration ===
cloudinary.config({
  cloud_name: 'dn71wkf7j',
  api_key: '297328628727681',
  api_secret: 'oqn56WmLwfOT7FK4RU1cX5nBvcA'
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'products',
    resource_type: 'raw',
    format: async () => 'zip',
    public_id: () => `product_${Date.now()}`
  }
});

const upload = multer({ storage });

// === Upload Product as .zip (includes metadata.json + image) ===
app.post('/products', upload.single('file'), async (req, res) => {
  try {
    const fileData = req.file;
    if (!fileData || !fileData.originalname.endsWith('.zip')) {
      return res.status(400).json({ error: 'Only ZIP files allowed with metadata and image.' });
    }
    res.json({ message: 'Product ZIP uploaded successfully', file: fileData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed', details: err });
  }
});

// === Fetch All Products by Extracting .zip files ===
app.get('/products', async (req, res) => {
  try {
    const { resources } = await cloudinary.search
      .expression('folder:products AND resource_type:raw AND format:zip')
      .sort_by('public_id', 'desc')
      .max_results(100)
      .execute();

    const products = await Promise.all(resources.map(async resource => {
      const response = await fetch(resource.secure_url);
      const buffer = await response.buffer();
      const zip = new AdmZip(buffer);
      const jsonEntry = zip.getEntry('metadata.json');
      if (!jsonEntry) return null;
      const metadata = JSON.parse(jsonEntry.getData().toString('utf8'));
      return metadata;
    }));

    res.json({ products: products.filter(Boolean) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products', details: err });
  }
});

// === Delete ZIP Product File by public_id ===
app.delete('/products/:public_id', async (req, res) => {
  const { public_id } = req.params;
  try {
    await cloudinary.uploader.destroy(public_id, { resource_type: 'raw' });
    res.json({ message: `Product ${public_id} deleted.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product', details: err });
  }
});

// === Update Product ZIP by Replacing the Old One ===
app.put('/products/:public_id', upload.single('file'), async (req, res) => {
  const { public_id } = req.params;

  try {
    const fileData = req.file;
    if (!fileData || !fileData.originalname.endsWith('.zip')) {
      return res.status(400).json({ error: 'Only ZIP files allowed for update.' });
    }

    await cloudinary.uploader.destroy(public_id, { resource_type: 'raw' });

    res.json({ message: 'Product updated successfully', file: fileData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product', details: err });
  }
});

app.listen(PORT, () => {
  console.log(`ChiCasual-Civies API running at http://localhost:${PORT}`);
});
