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
const Flutterwave = require('flutterwave-node-v3');
const carts = new Map(); // Add this with your other data stores

// Initialize Flutterwave
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY
);

// Unified Cart Endpoint
app.route('/api/cart/:userId')
  .get((req, res) => res.json(carts.get(req.params.userId) || []))
  .post((req, res) => {
    const { productId, quantity } = req.body;
    const product = products.find(p => p.id === productId);
    
    if (!product || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    
    const userCart = carts.get(req.params.userId) || [];
    const existingItem = userCart.find(item => item.productId === productId);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      userCart.push({
        productId,
        quantity,
        price: product.price,
        name: product.name,
        imageUrl: product.imageUrl
      });
    }
    
    carts.set(req.params.userId, userCart);
    res.json(userCart);
  })
  .delete((req, res) => {
    carts.delete(req.params.userId);
    res.status(204).send();
  });

// Update Cart Item
app.put('/api/cart/:userId/:productId', (req, res) => {
  const userCart = carts.get(req.params.userId);
  if (!userCart) return res.status(404).json({ error: 'Cart not found' });
  
  const item = userCart.find(i => i.productId === req.params.productId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  
  if (req.body.quantity <= 0) {
    userCart.splice(userCart.indexOf(item), 1);
  } else {
    item.quantity = req.body.quantity;
  }
  
  res.json(userCart);
});

// Payment Processing
app.post('/api/payment/initiate', async (req, res) => {
  try {
    const { userId, email } = req.body;
    const userCart = carts.get(userId);
    
    if (!userCart?.length) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    const amount = userCart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const paymentData = {
      tx_ref: `order-${Date.now()}`,
      amount: amount.toFixed(2),
      currency: 'USD',
      payment_options: 'card',
      customer: { email },
      customizations: {
        title: 'Your Store',
        description: 'Cart Payment'
      }
    };
    
    const response = await flw.Payment.initialize(paymentData);
    res.json({
      paymentLink: response.data.link,
      transactionId: response.data.tx_ref
    });
  } catch (error) {
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// Payment Webhook
app.post('/api/payment/webhook', (req, res) => {
  if (req.headers['verif-hash'] !== process.env.FLW_WEBHOOK_SECRET) {
    return res.status(401).end();
  }
  
  if (req.body.status === 'successful') {
    // Handle successful payment:
    // - Create order record
    // - Clear cart (carts.delete(req.body.meta.userId))
    // - Send confirmation email
  }
  
  res.status(200).end();
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
