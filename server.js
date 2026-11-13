import express from 'express';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import app from './server/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const port = process.env.PORT || 3026;

// Serve static build assets if dist directory exists
const distDir = join(__dirname, 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
}

// SPA fallback for frontend client routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = resolve(distDir, 'index.html');
  if (existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(200).send('MD2PDF Express backend is running. Run "npm run build" to compile client assets.');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
