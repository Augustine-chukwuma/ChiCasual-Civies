require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('./'));

// Cloudinary Configuration with env variables
cloudinary.config({
  cloud_name: 'dn71wkf7j',
  api_key: '297328628727681',
  api_secret: 'oqn56WmLwfOT7FK4RU1cX5nBvcA'
});

// In-memory database (Replace with real DB in production)
let products = [];

// Multer configuration for file handling
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Utility to upload image to Cloudinary
const uploadToCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'ecommerce-products' },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    
    stream.end(fileBuffer);
  });
};

// Search Products - New endpoint
app.get('/api/products/search', (req, res) => {
  const { q } = req.query;
  
  if (!q || q.trim() === '') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const searchTerm = q.toLowerCase();
  const results = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm) ||
    product.category.toLowerCase().includes(searchTerm) ||
    product.description?.toLowerCase().includes(searchTerm)
  );

  res.json(results);
});

// Create Product
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { name, price, category, discount, description } = req.body;
    const file = req.file;

    // Validation
    if (!name || !price || !category || !file) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Upload image
    const result = await uploadToCloudinary(file.buffer);

    // Create product object
    const newProduct = {
      id: uuidv4(),
      name,
      price: parseFloat(price),
      category,
      description: description || '',
      discount: discount ? parseFloat(discount) : 0,
      imageUrl: result.secure_url,
      cloudinaryId: result.public_id,
      createdAt: new Date().toISOString()
    };

    products.push(newProduct);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get All Products (updated to support basic search via query param)
app.get('/api/products', (req, res) => {
  const { q } = req.query;
  
  if (q && q.trim() !== '') {
    const searchTerm = q.toLowerCase();
    const results = products.filter(product => 
      product.name.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm) ||
      product.description?.toLowerCase().includes(searchTerm)
    );
    return res.json(results);
  }
  
  res.json(products);
});

// Get Single Product
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// Update Product
app.put('/api/products/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, category, discount, description } = req.body;
    const file = req.file;

    const productIndex = products.findIndex(p => p.id === id);
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let updateData = {
      ...products[productIndex],
      name: name || products[productIndex].name,
      price: price ? parseFloat(price) : products[productIndex].price,
      category: category || products[productIndex].category,
      description: description || products[productIndex].description,
      discount: discount ? parseFloat(discount) : products[productIndex].discount,
    };

    // Handle image update
    if (file) {
      // Delete old image from Cloudinary
      await cloudinary.uploader.destroy(products[productIndex].cloudinaryId);
      
      // Upload new image
      const result = await uploadToCloudinary(file.buffer);
      updateData.imageUrl = result.secure_url;
      updateData.cloudinaryId = result.public_id;
    }

    products[productIndex] = updateData;
    res.json(products[productIndex]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete Product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const productIndex = products.findIndex(p => p.id === id);
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Delete image from Cloudinary
    await cloudinary.uploader.destroy(products[productIndex].cloudinaryId);
    
    // Remove product
    products = products.filter(p => p.id !== id);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
