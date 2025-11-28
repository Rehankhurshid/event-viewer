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
    // pathRewrite is not needed because app.use('/api') strips the prefix
    onProxyReq: (proxyReq, req, res) => {
        // Explicitly set Host header
        proxyReq.setHeader('Host', 'api.webflow.com');
        
        // Remove forwarded headers
        proxyReq.removeHeader('x-forwarded-host');
        proxyReq.removeHeader('x-forwarded-proto');
        proxyReq.removeHeader('x-forwarded-for');

        console.log('--- Proxy Request ---');
        console.log(`Method: ${req.method}`);
        console.log(`Original URL: ${req.originalUrl}`);
        console.log(`Proxy Path: ${proxyReq.path}`);
        console.log(`Target Host: api.webflow.com`);
        console.log(`Auth Header Present: ${!!req.headers.authorization}`);
        console.log('---------------------');
    },
    onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        res.status(500).send('Proxy Error');
    }
}));

app.get('/health', (req, res) => {
    res.send('OK');
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
