require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const Flutterwave = require('flutterwave-node-v3');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('./'));

// Auth Middleware
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// File Handling
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Cloudinary Upload Utility
const uploadToCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'ecommerce-products' },
      (error, result) => error ? reject(error) : resolve(result)
    );
    stream.end(fileBuffer);
  });
};

// Product Search
app.get('/api/products/search', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: 'Search query required' });

  try {
    const { data, error } = await supabase.rpc('search_products', {
      search_term: q
    });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Create Product (Admin Only)
app.post('/api/products', async (req, res) => {
  const { name, price, category, discount, imageUrl } = req.body;
  if (!name || !price || !category || !imageUrl)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    const { data, error } = await supabase
      .from('products')
      .insert({
        name,
        price: parseFloat(price),
        category,
        discount: parseFloat(discount) || 0,
        image_url: imageUrl
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Product creation failed' });
  }
});

    // Upload image
    const result = await uploadToCloudinary(req.file.buffer);

    // Insert into Supabase
    const { data, error } = await supabase
      .from('products')
      .insert({
        name,
        price: parseFloat(price),
        category,
        description: description || '',
        discount: discount ? parseFloat(discount) : 0,
        image_url: result.secure_url,
        cloudinary_id: result.public_id
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Product creation failed' });
  }
});

// Get Products
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Single Product
app.get('/api/products/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Product not found' });
  }
});

// Update Product
app.put('/api/products/:id', authenticate, upload.single('image'), async (req, res) => {
  if (!req.user.user_metadata?.is_admin)
    return res.status(403).json({ error: 'Forbidden' });

  try {
    // Get existing product
    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select('cloudinary_id')
      .eq('id', req.params.id)
      .single();
    
    if (fetchError) throw fetchError;

    // Handle image update
    let updateData = { ...req.body };
    if (req.file) {
      // Delete old image
      await cloudinary.uploader.destroy(existing.cloudinary_id);
      const result = await uploadToCloudinary(req.file.buffer);
      updateData.image_url = result.secure_url;
      updateData.cloudinary_id = result.public_id;
    }

    // Numeric conversions
    if (updateData.price) updateData.price = parseFloat(updateData.price);
    if (updateData.discount) updateData.discount = parseFloat(updateData.discount);

    // Update database
    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Delete Product
app.delete('/api/products/:id', authenticate, async (req, res) => {
  if (!req.user.user_metadata?.is_admin)
    return res.status(403).json({ error: 'Forbidden' });

  try {
    // Get product data
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('cloudinary_id')
      .eq('id', req.params.id)
      .single();
    
    if (fetchError) throw fetchError;

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(product.cloudinary_id);

    // Delete from database
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Deletion failed' });
  }
});

// Cart Endpoints
app.route('/api/cart')
  .all(authenticate)
  .get(async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('carts')
        .select('product_id, quantity, products(name, price, image_url)')
        .eq('user_id', req.user.id)
        .join('products', 'product_id', 'id');
      
      if (error) throw error;
      res.json(data.map(item => ({
        ...item.products,
        product_id: item.product_id,
        quantity: item.quantity
      })));
    } catch (error) {
      res.status(500).json({ error: 'Failed to get cart' });
    }
  })
  .post(async (req, res) => {
    try {
      const { product_id, quantity } = req.body;
      if (!product_id || !quantity || quantity < 1)
        return res.status(400).json({ error: 'Invalid request' });

      const { error } = await supabase
        .from('carts')
        .upsert(
          { user_id: req.user.id, product_id, quantity },
          { onConflict: 'user_id,product_id' }
        );
      
      if (error) throw error;
      res.status(201).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Cart update failed' });
    }
  })
  .delete(async (req, res) => {
    try {
      const { error } = await supabase
        .from('carts')
        .delete()
        .eq('user_id', req.user.id);
      
      if (error) throw error;
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Cart clearance failed' });
    }
  });

// Update Cart Item
app.put('/api/cart/:product_id', authenticate, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity < 1) {
      // Remove item
      const { error } = await supabase
        .from('carts')
        .delete()
        .eq('user_id', req.user.id)
        .eq('product_id', req.params.product_id);
      
      if (error) throw error;
      return res.status(204).send();
    }

    // Update quantity
    const { error } = await supabase
      .from('carts')
      .update({ quantity })
      .eq('user_id', req.user.id)
      .eq('product_id', req.params.product_id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Cart update failed' });
  }
});

// Payment Processing
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY
);

app.post('/api/payment/initiate', authenticate, async (req, res) => {
  try {
    // Get user cart
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('product_id, quantity, products(price)')
      .eq('user_id', req.user.id)
      .join('products', 'product_id', 'id');
    
    if (cartError) throw cartError;
    if (!cart?.length) return res.status(400).json({ error: 'Cart is empty' });

    // Calculate total
    const amount = cart.reduce((total, item) => 
      total + (item.products.price * item.quantity), 0);

    // Create payment
    const paymentData = {
      tx_ref: `order-${Date.now()}-${req.user.id}`,
      amount: amount.toFixed(2),
      currency: 'USD',
      customer: { email: req.user.email },
      redirect_url: process.env.PAYMENT_REDIRECT_URL
    };

    const response = await flw.Payment.initialize(paymentData);
    res.json({
      paymentLink: response.data.link,
      transactionId: response.data.tx_ref
    });
  } catch (error) {
    res.status(500).json({ error: 'Payment initiation failed' });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
