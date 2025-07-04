
const achiever = require('achiever');
const fs = require('fs');
const os = require('os');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const AdmZip = require('adm-zip');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TMP_DIR = path.join(__dirname, 'tmp');


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

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

app.post('/products', (req, res) => {
  const parser = achiever();
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

  let zipPath = '';
  const texts = [];

  req.pipe(parser)
    .on('file', (fieldname, file, filename) => {
      if (path.extname(filename).toLowerCase() !== '.zip') {
        return res.status(400).json({ error: 'Only ZIP files are allowed.' });
      }

      zipPath = path.join(TMP_DIR, `${Date.now()}-${filename}`);
      file.pipe(fs.createWriteStream(zipPath));
    })
    .on('field', (fieldname, value) => {
      if (fieldname.startsWith('texts')) texts.push(value);
    })
    .on('finish', () => {
      if (!zipPath || !fs.existsSync(zipPath)) {
        return res.status(400).json({ error: 'ZIP file not received properly.' });
      }

      res.json({
        message: 'Product ZIP and texts uploaded successfully',
        zipFile: path.basename(zipPath),
        savedTo: zipPath,
        sizeBytes: fs.statSync(zipPath).size,
        texts
      });
    })
    .on('error', err => {
      console.error('❌ Achiever error:', err);
      res.status(500).json({ error: 'Upload failed', details: err.message });
    });
});

// === Fetch All Products by Extracting .zip files ===
app.get('/products', (req, res) => {
  try {
    // Check if temporary directory exists
    if (!fs.existsSync(TMP_DIR)) {
      return res.status(404).json({ error: 'No products directory found' });
    }

    // Read all files in the directory
    const files = fs.readdirSync(TMP_DIR);
    const productFiles = files.filter(file => file.endsWith('.zip'));
    
    if (productFiles.length === 0) {
      return res.status(404).json({ message: 'No product files found' });
    }

    // Prepare response with all product files
    const products = productFiles.map(file => {
      const filePath = path.join(TMP_DIR, file);
      return {
        name: file,
        path: filePath,
        sizeBytes: fs.statSync(filePath).size,
        downloadUrl: `/products/download/${encodeURIComponent(file)}`,
        createdAt: fs.statSync(filePath).birthtime
      };
    });

    res.json({
      message: 'Products retrieved successfully',
      count: products.length,
      products
    });

  } catch (err) {
    console.error('❌ Product retrieval error:', err);
    res.status(500).json({ error: 'Failed to retrieve products', details: err.message });
  }
});// === Delete ZIP Product File by public_id ===
app.delete('/products/:public_id', async (req, res) => {
  const { public_id } = req.params;
  try {
    await cloudinary.uploader.destroy(public_id, { resource_type: 'raw' });
    res.json({ message: `Product ${public_id} deleted.` });
  } catch (err) {
    console.error(`❌ Delete error for ${public_id}:`, err);
    res.status(500).json({ error: 'Failed to delete product', details: err.message });
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
    console.error(`❌ Update error for ${public_id}:`, err);
    res.status(500).json({ error: 'Failed to update product', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ChiCasual-Civies API running at http://localhost:${PORT}`);
});
