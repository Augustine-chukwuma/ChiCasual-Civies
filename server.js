const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (e.g., public/index.html)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cloudinary configuration
cloudinary.config({
  cloud_name: 'dn71wkf7',
  api_key: '297328628727681',
  api_secret: 'oqn56WmLwfOT7FK4RU1cX5nBvcA',
});

// Multer and Cloudinary setup
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const productName = req.body.productName || 'Unnamed';
    const productPrice = req.body.productPrice || '0';
    const productDiscount = req.body.productDiscount || '0';

    return {
      folder: 'products',
      context: {
        name: productName,
        price: productPrice,
        discount: productDiscount,
      },
      allowed_formats: ['jpg', 'jpeg', 'png'],
    };
  },
});
const parser = multer({ storage: storage });

/**
 * POST /upload
 * Upload a product image with name, price, and discount
 */
app.post('/upload', parser.single('image'), async (req, res) => {
  const { productName, productPrice, productDiscount } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Add context manually (redundant safety if storage doesn't apply it)
    const contextStr = `name=${productName}|price=${productPrice}|discount=${productDiscount}`;
    await cloudinary.uploader.add_context(contextStr, req.file.filename);

    res.status(200).json({
      message: 'Upload successful',
      imageUrl: req.file.path,
      public_id: req.file.filename,
      name: productName,
      price: productPrice,
      discount: productDiscount,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload product', details: error.message });
  }
});

/**
 * GET /products
 * Fetch product images, names, prices, and discounts from Cloudinary
 */
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
      name: item.context?.custom?.name || 'Unnamed Product',
      price: item.context?.custom?.price || '0',
      discount: item.context?.custom?.discount || '0',
      public_id: item.public_id,
    }));

    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
