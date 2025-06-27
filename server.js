const express = require('express');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// === Static & Parsing Middleware ===
app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// === Admin Login Config ===
const ADMIN_USERNAME = 'admin';
const HASHED_PASSWORD = '$2b$10$4hO5JvNSiNIFe3ERPIv93.TmEnoVW/ZnPKbcS9Zuzhl9uTqN2ZaKq'; // hashed "thisisjustthebeginning"

// === Cloudinary Auto Config from .env ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_URL.split('@')[1],
  api_key: process.env.CLOUDINARY_URL.split('//')[1].split(':')[0],
  api_secret: process.env.CLOUDINARY_URL.split(':')[2].split('@')[0],
});

// === Multer Storage Setup ===
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const { productName, productPrice, productDiscount, productCategory } = req.body;
    return {
      folder: 'products',
      context: {
        name: productName || 'Unnamed',
        price: productPrice || '0',
        discount: productDiscount || '0',
        category: productCategory || 'uncategorized',
      },
      allowed_formats: ['jpg', 'jpeg', 'png'],
    };
  },
});
const parser = multer({ storage });

// === Product Upload ===
app.post('/upload', parser.single('image'), async (req, res) => {
  const { productName, productPrice, productDiscount, productCategory } = req.body;

  console.log('➡️ Incoming upload request with:');
  console.log({ productName, productPrice, productDiscount, productCategory });

  if (!req.file) {
    console.error('❌ No image file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const publicId = req.file.filename || req.file.public_id;
    const contextStr = `name=${productName}|price=${productPrice}|discount=${productDiscount}|category=${productCategory}`;

    console.log(`📤 Setting Cloudinary context for ${publicId}: ${contextStr}`);
    await cloudinary.uploader.add_context(contextStr, publicId);

    console.log('✅ Upload successful');
    res.status(200).json({
      message: '✅ Upload successful',
      imageUrl: req.file.path,
      public_id: publicId,
      name: productName,
      price: productPrice,
      discount: productDiscount,
      category: productCategory,
    });
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// === Fetch Products ===
app.get('/products', async (req, res) => {
  console.log('🔍 Fetching products from Cloudinary...');

  try {
    const result = await cloudinary.search
      .expression('folder:products')
      .sort_by('created_at', 'desc')
      .with_field('context')
      .max_results(30)
      .execute();

    const products = result.resources.map((item, i) => {
      const context = item.context?.custom || {};
      const product = {
        url: item.secure_url,
        name: context.name || 'Unnamed',
        price: context.price || '0',
        discount: context.discount || '0',
        category: context.category || 'uncategorized',
        public_id: item.public_id,
      };
      console.log(`🛍️ Product ${i + 1}:`, product);
      return product;
    });

    console.log(`✅ ${products.length} products fetched`);
    res.json({ products });
  } catch (err) {
    console.error('❌ Failed to fetch products:', err.message);
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

// === Keep Alive Ping ===
app.get('/ping', (req, res) => {
  res.send('🏓 Pong');
});

const SELF_URL = 'https://chicasual-civies-jof8.onrender.com/ping';
setInterval(() => {
  fetch(SELF_URL)
    .then(res => res.text())
    .then(data => console.log(`🔁 Self-ping: ${data}`))
    .catch(err => console.error('⚠️ Self-ping failed:', err.message));
}, 14 * 60 * 1000);

// === Start Server ===
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
