const express = require('express');
const multer = require('multer');
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

// === Cloudinary Config (via .env) ===
// Ensure .env has: CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
cloudinary.config(); 

// === Multer + Cloudinary Storage ===
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const { productName, productPrice, productDiscount, productCategory } = req.body;
    return {
      folder: 'products',
      context: {
        name: productName,
        price: productPrice,
        discount: productDiscount,
        category: productCategory,
      },
      allowed_formats: ['jpg', 'jpeg', 'png'],
    };
  },
});
const parser = multer({ storage });

// === Product Upload Endpoint ===
app.post('/upload', parser.single('image'), async (req, res) => {
  const { productName, productPrice, productDiscount, productCategory } = req.body;
  console.log('➡️ Upload request:', req.body);

  if (!req.file) {
    console.error('❌ No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const publicId = req.file.filename || req.file.public_id;
    console.log('✅ Uploaded image, publicId:', publicId);

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
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// === Fetch Products Endpoint ===
app.get('/products', async (req, res) => {
  console.log('🔍 Fetching products from Cloudinary...');

  try {
    const result = await cloudinary.search
      .expression('folder:products')
      .sort_by('created_at', 'desc')
      .with_field('context')
      .max_results(30)
      .execute();

    const products = result.resources.map((item, index) => {
      const ctx = item.context?.custom || {};
      const p = {
        url: item.secure_url,
        name: ctx.name || 'Unnamed',
        price: ctx.price || '0',
        discount: ctx.discount || '0',
        category: ctx.category || 'uncategorized',
        public_id: item.public_id,
      };
      console.log(`🛍️ Product ${index + 1}:`, p);
      return p;
    });

    console.log(`✅ ${products.length} products fetched`);
    res.json({ products });
  } catch (err) {
    console.error('❌ Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

// === Keep-Alive Ping ===
app.get('/ping', (req, res) => res.send('🏓 Pong'));
setInterval(() => {
  fetch(process.env.SELF_URL)
    .then(r => r.text())
    .then(d => console.log(`🔁 Pinged: ${d}`))
    .catch(err => console.error('⚠️ Ping error:', err));
}, 14 * 60 * 1000);

// === Start Server ===
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
