const express = require('express');
const app = express();
const path = require('path');

// Serve index.html and app.js from the current directory
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ChiCasual-Civies running at http://localhost:${PORT}`);
});
