const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const stream = require('stream');
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TMP_DIR = path.join(__dirname, 'tmp');


// Cloudinary Configuration with env variables
cloudinary.config({
  cloud_name: 'dn71wkf7j',
  api_key: '297328628727681',
  api_secret: 'oqn56WmLwfOT7FK4RU1cX5nBvcA'
});

// Memory storage for file handling
const memoryStorage = multer.memoryStorage();
const upload = multer({ 
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Create TMP_DIR if not exists
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// === Upload Product to Cloudinary ===
app.post('/products', upload.any(), async (req, res) => {
  try {
    const files = req.files || [];
    const texts = Object.entries(req.body)
      .filter(([key]) => key.startsWith('texts'))
      .map(([, value]) => value);

    // Validate ZIP file
    const zipFile = files.find(f => 
      path.extname(f.originalname).toLowerCase() === '.zip'
    );
    
    if (!zipFile) {
      return res.status(400).json({ error: 'Missing or invalid ZIP file' });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'products',
          resource_type: 'raw',
          public_id: `product_${Date.now()}`,
          overwrite: false
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
      
      // Create readable stream from buffer
      const bufferStream = new stream.PassThrough();
      bufferStream.end(zipFile.buffer);
      bufferStream.pipe(uploadStream);
    });

    res.json({
      message: 'Product uploaded successfully',
      public_id: result.public_id,
      secure_url: result.secure_url,
      created_at: result.created_at,
      bytes: result.bytes,
      texts
    });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ 
      error: 'Upload failed', 
      details: err.message 
    });
  }
});

// === Fetch All Products from Cloudinary ===
app.get('/products', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'products/',
      resource_type: 'raw',
      max_results: 100
    });

    const products = result.resources.map(resource => ({
      public_id: resource.public_id,
      secure_url: resource.secure_url,
      created_at: resource.created_at,
      bytes: resource.bytes,
      format: resource.format,
      download_url: `/products/download/${resource.public_id.replace(/\//g, '::')}`
    }));

    res.json({
      message: 'Products retrieved successfully',
      count: products.length,
      products
    });
  } catch (err) {
    console.error('❌ Product retrieval error:', err);
    res.status(500).json({ 
      error: 'Failed to retrieve products', 
      details: err.message 
    });
  }
});

// === Download Product ===
app.get('/products/download/:public_id', async (req, res) => {
  try {
    const public_id = req.params.public_id.replace(/::/g, '/');
    const url = cloudinary.url(public_id, {
      resource_type: 'raw',
      attachment: true
    });
    res.redirect(url);
  } catch (err) {
    console.error('❌ Download error:', err);
    res.status(500).json({ 
      error: 'Download failed', 
      details: err.message 
    });
  }
});

// === Delete Product ===
app.delete('/products/:public_id', async (req, res) => {
  try {
    const public_id = req.params.public_id.replace(/::/g, '/');
    const result = await cloudinary.uploader.destroy(public_id, { 
      resource_type: 'raw' 
    });
    
    if (result.result !== 'ok') {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ 
      message: `Product ${public_id} deleted`,
      result
    });
  } catch (err) {
    console.error('❌ Delete error:', err);
    res.status(500).json({ 
      error: 'Deletion failed', 
      details: err.message 
    });
  }
});

// === Update Product ===
app.put('/products/:public_id', upload.single('file'), async (req, res) => {
  try {
    const { public_id } = req.params;
    const file = req.file;

    // Validate input
    if (!file || path.extname(file.originalname).toLowerCase() !== '.zip') {
      return res.status(400).json({ error: 'Invalid or missing ZIP file' });
    }

    // Upload new version
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: public_id.replace(/::/g, '/'),
          resource_type: 'raw',
          overwrite: true
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
      
      const bufferStream = new stream.PassThrough();
      bufferStream.end(file.buffer);
      bufferStream.pipe(uploadStream);
    });

    res.json({
      message: 'Product updated successfully',
      public_id: result.public_id,
      secure_url: result.secure_url,
      bytes: result.bytes
    });
  } catch (err) {
    console.error('❌ Update error:', err);
    res.status(500).json({ 
      error: 'Update failed', 
      details: err.message 
    });
  }
});

// Temporary file cleanup cron
setInterval(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR);
  console.log('🧹 Cleaned temporary directory');
}, 24 * 60 * 60 * 1000); // Daily cleanup

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
