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

// === Cloudinary Config ===
cloudinary.config({
  cloud_name: 'dn71wkf7',
  api_key: '297328628727681',
  api_secret: 'oqn56WmLwfOT7FK4RU1cX5nBvcA',
});

// === Cloudinary Storage ===
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

// === Product Upload Route ===
app.post('/upload', parser.single('image'), async (req, res) => {
  const { productName, productPrice, productDiscount, productCategory } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const contextStr = `name=${productName}|price=${productPrice}|discount=${productDiscount}|category=${productCategory}`;
    const publicId = req.file.filename || req.file.public_id || req.file.originalname;

    // Set context for image (optional, Cloudinary uses params.context already)
    await cloudinary.uploader.add_context(contextStr, publicId);

    res.status(200).json({
      message: 'Upload successful',
      imageUrl: req.file.path,
      public_id: publicId,
      name: productName,
      price: productPrice,
      discount: productDiscount,
      category: productCategory,
    });
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// === Fetch Products Route ===
app.get('/products', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('folder:products')
      .sort_by('created_at', 'desc')
      .with_field('context')
      .max_results(30)
      .execute();

    const products = result.resources.map(item => ({
      url: item.secure_url,
      name: item.context?.custom?.name || 'Unnamed',
      price: item.context?.custom?.price || '0',
      discount: item.context?.custom?.discount || '0',
      category: item.context?.custom?.category || 'uncategorized',
      public_id: item.public_id,
    }));

    res.json({ products });
  } catch (err) {
    console.error('Fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
