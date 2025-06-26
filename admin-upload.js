// admin-upload.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ChiCasual-Civies',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  },
});

const upload = multer({ storage: storage });

// Admin route to upload a product
router.post('/admin/upload', upload.single('image'), (req, res) => {
  const { name, price } = req.body;
  const imageUrl = req.file.path;

  // Simulated DB save
  const product = { name, price, image: imageUrl };

  console.log('Product uploaded:', product);
  res.status(200).json({ message: 'Product uploaded successfully', product });
});

module.exports = router;
