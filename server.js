import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy for Webflow API
app.use('/api', createProxyMiddleware({
    target: 'https://api.webflow.com',
    changeOrigin: true,
    pathRewrite: async function (path, req) {
        // Force removal of /api prefix if it exists
        return path.replace(/^\/api/, ''); 
    },
    onProxyReq: (proxyReq, req, res) => {
        // Explicitly set Host header
        proxyReq.setHeader('Host', 'api.webflow.com');
        proxyReq.setHeader('User-Agent', 'EventsViewer/1.0');
        
        // Remove forwarded headers
        proxyReq.removeHeader('x-forwarded-host');
        proxyReq.removeHeader('x-forwarded-proto');
        proxyReq.removeHeader('x-forwarded-for');

        console.log(`[Proxy] ${req.method} ${req.originalUrl} -> https://api.webflow.com${proxyReq.path}`);
    },
    onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        res.status(500).send('Proxy Error');
    }
}));

app.get('/health', (req, res) => {
    res.send('OK');
});

app.get('/debug-config', (req, res) => {
    res.json({
        port: PORT,
        node_env: process.env.NODE_ENV,
        dist_exists: 'Check logs', // We can't easily check fs here without importing fs, but static serve handles it
        headers: req.headers
    });
});

// Proxy for TinyPNG API
app.use('/tinify', createProxyMiddleware({
    target: 'https://api.tinify.com',
    changeOrigin: true,
    pathRewrite: {
        '^/tinify': '', // remove /tinify prefix
    },
    onProxyReq: (proxyReq, req, res) => {
        // Remove forwarded headers that might confuse the target
        proxyReq.removeHeader('x-forwarded-host');
        proxyReq.removeHeader('x-forwarded-proto');
        proxyReq.removeHeader('x-forwarded-for');
    }
}));

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA routing - return index.html for all other routes
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
