const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// === Middleware ===
app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// === Cloudinary Config ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === Storage Setup with Custom Metadata ===
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const { productName, productPrice, productDiscount, productCategory } = req.body;
    return {
      folder: 'products',
      context: {
        'custom.name': productName,
        'custom.price': productPrice,
        'custom.discount': productDiscount,
        'custom.category': productCategory,
      },
      allowed_formats: ['jpg', 'jpeg', 'png'],
    };
  },
});
const parser = multer({ storage });

// === Upload Product Endpoint ===
app.post('/upload', parser.single('image'), async (req, res) => {
  const { productName, productPrice, productDiscount, productCategory } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const publicId = req.file.filename || req.file.public_id;
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
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// === Fetch All Products Grouped by Category ===
app.get('/products', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('folder:products')
      .sort_by('created_at', 'desc')
      .with_field('context')
      .max_results(100)
      .execute();

    const grouped = {};
    result.resources.forEach((item) => {
      const ctx = item.context?.custom || {};
      const product = {
        url: item.secure_url,
        name: ctx.name || 'Unnamed',
        price: ctx.price || '0',
        discount: ctx.discount || '0',
        category: ctx.category || 'uncategorized',
        public_id: item.public_id,
      };
      const categoryKey = product.category.toLowerCase();
      if (!grouped[categoryKey]) grouped[categoryKey] = [];
      grouped[categoryKey].push(product);
    });

    res.json({ grouped });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

// === Fetch Products by Category ===
app.get('/products/category', async (req, res) => {
  const category = req.query.name?.toLowerCase();
  if (!category) return res.status(400).json({ error: 'Category name is required' });

  try {
    const result = await cloudinary.search
      .expression(`folder:products AND context.custom.category=${category}`)
      .sort_by('created_at', 'desc')
      .with_field('context')
      .max_results(100)
      .execute();

    const products = result.resources.map((item) => {
      const ctx = item.context?.custom || {};
      return {
        url: item.secure_url,
        name: ctx.name || 'Unnamed',
        price: ctx.price || '0',
        discount: ctx.discount || '0',
        category: ctx.category || 'uncategorized',
        public_id: item.public_id,
      };
    });

    res.json({ category, products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch category', details: err.message });
  }
});

// === Edit/Rename Product Metadata ===
app.put('/edit/:public_id', async (req, res) => {
  const { public_id } = req.params;
  const { name, price, discount, category } = req.body;

  try {
    const result = await cloudinary.uploader.update_metadata({
      name,
      price,
      discount,
      category,
    }, public_id);

    res.json({ message: '✅ Metadata updated', result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product', details: err.message });
  }
});

// === Delete Product ===
app.delete('/delete/:public_id', async (req, res) => {
  const { public_id } = req.params;

  try {
    const result = await cloudinary.uploader.destroy(public_id);
    if (result.result === 'ok') {
      res.json({ message: '✅ Product deleted successfully' });
    } else {
      res.status(404).json({ error: 'Product not found or already deleted' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product', details: err.message });
  }
});

// === Ping for Keepalive ===
app.get('/ping', (req, res) => res.send('🏓 Pong'));
setInterval(() => {
  fetch(process.env.SELF_URL)
    .then(r => r.text())
    .then(d => console.log(`🔁 Pinged: ${d}`))
    .catch(err => console.error('⚠️ Ping error:', err));
}, 14 * 60 * 1000);

// === Start Server ===
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
