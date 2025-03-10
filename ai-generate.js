const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const sharp = require('sharp');
const upload = multer();
require("dotenv").config();

// Initialize clients
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const STABILITY_API_KEY = process.env.STABILITY_API_KEY;

// OpenAI routes
router.post('/openai/variations', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Process image with sharp
        const processedImage = await sharp(req.file.buffer)
            .resize(1024, 1024, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .png()
            .toBuffer();

        // Create form data
        const formData = new FormData();
        formData.append('image', processedImage, {
            filename: 'image.png',
            contentType: 'image/png'
        });
        formData.append('n', '1');
        formData.append('size', '1024x1024');
        formData.append('response_format', 'b64_json');

        const response = await axios({
            method: 'post',
            url: 'https://api.openai.com/v1/images/variations',
            data: formData,
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Accept': 'application/json'
            }
        });

        // Get the base64 image data
        const imageData = response.data.data[0].b64_json;
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(imageData, 'base64');

        // Set response headers for PNG image
        res.set('Content-Type', 'image/png');
        res.set('Content-Disposition', 'inline');
        
        // Send the image buffer directly
        res.send(imageBuffer);

    } catch (error) {
        console.error('OpenAI Error:', error);
        if (error.response) {
            console.error('API Response Error:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        res.status(500).json({ 
            error: error.message || 'Connection error.',
            details: error.response?.data || error
        });
    }
});

router.post('/openai/generate', async (req, res) => {
    try {
        const { prompt, model } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'No prompt provided' });
        }

        // Create form data
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('n', '1');
        formData.append('model', model || 'dall-e-2');
        formData.append('size', model === 'dall-e-3' ? '1024x1024' : '512x512');
        formData.append('quality', 'standard');
        formData.append('response_format', 'b64_json');

        const response = await axios({
            method: 'post',
            url: 'https://api.openai.com/v1/images/generations',
            data: formData,
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Accept': 'application/json'
            }
        });

        res.json({
            success: true,
            data: response.data.data.map((img, index) => ({
                b64_json: img.b64_json,
                index: index + 1
            }))
        });
    } catch (error) {
        console.error('OpenAI Error:', error);
        if (error.response) {
            console.error('API Response Error:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        res.status(500).json({ 
            error: error.message || 'Connection error.',
            details: error.response?.data || error
        });
    }
});

// Add this new endpoint for image analysis
router.post('/openai/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Convert buffer to base64
        const base64Image = req.file.buffer.toString('base64');
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Create a concise prompt to generate a Telegram sticker based on this image. Focus on key visual elements and style that would work well as a sticker."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${req.file.mimetype};base64,${base64Image}`,
                                detail: "low"
                            }
                        }
                    ]
                }
            ],
            max_tokens: 300
        });

        res.json({
            success: true,
            description: response.choices[0].message.content
        });

    } catch (error) {
        console.error('OpenAI Vision Error:', error);
        if (error.response) {
            console.error('API Response Error:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        res.status(500).json({ 
            error: error.message || 'Failed to analyze image',
            details: error.response?.data || error
        });
    }
});

// Stability AI routes
router.post('/stability/sd3/variations', upload.single('image'), async (req, res) => {
    try {
        // Validate required inputs
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided. Please upload an image file.' });
        }

        const { prompt, strength } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'No prompt provided. Please include a text prompt to guide the image variation.' });
        }

        // Create form data using form-data package instead of browser's FormData
        const formData = new FormData();
        formData.append('image', req.file.buffer, {
            filename: 'image.png',
            contentType: req.file.mimetype
        });
        formData.append('prompt', prompt);
        formData.append('output_format', 'png');
        formData.append('mode', 'image-to-image');
        formData.append('strength', strength || '0.25');

        // Log request details for debugging
        console.log('Request details:', {
            prompt,
            strength,
            imageSize: req.file.size,
            mimeType: req.file.mimetype
        });

        const response = await axios({
            method: 'post',
            url: 'https://api.stability.ai/v2beta/stable-image/generate/sd3',
            data: formData,
            headers: {
                ...formData.getHeaders(), // Use form-data's headers
                'Authorization': `Bearer ${STABILITY_API_KEY}`,
                'Accept': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Full error:', error);
        
        // Handle specific error cases
        if (error.response) {
            console.error('API Response Error:', {
                status: error.response.status,
                data: error.response.data
            });

            if (error.response.status === 401) {
                return res.status(401).json({ error: 'Invalid API key. Please check your Stability AI credentials.' });
            }
            if (error.response.status === 429) {
                return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
            }
            return res.status(error.response.status).json({ 
                error: `Stability AI API error: ${error.response.data?.message || error.message}`,
                details: error.response.data
            });
        }

        // Handle network or other errors
        res.status(500).json({ 
            error: 'Internal server error while processing image variation request.',
            details: error.message
        });
    }
});

router.post('/stability/sd3/generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('output_format', 'png');

        const response = await axios({
            method: 'post',
            url: 'https://api.stability.ai/v2beta/stable-image/generate/sd3',
            data: formData,
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${STABILITY_API_KEY}`,
                'Accept': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        handleStabilityError(error, res);
    }
});

router.post('/stability/ultra/variations', upload.single('image'), async (req, res) => {
    try {
        const { prompt, strength } = req.body;
        
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('output_format', 'png');
        formData.append('image', req.file.buffer, {
            filename: 'image.png',
            contentType: req.file.mimetype
        });
        formData.append('mode', 'image-to-image');
        formData.append('strength', strength || '0.25');
        formData.append('cfg_scale', '7');
        formData.append('steps', '30');

        const response = await axios({
            method: 'post',
            url: 'https://api.stability.ai/v2beta/stable-image/generate/ultra',
            data: formData,
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${STABILITY_API_KEY}`,
                'Accept': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        handleStabilityError(error, res);
    }
});

router.post('/stability/ultra/generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('output_format', 'png');
        formData.append('cfg_scale', '7');
        formData.append('steps', '30');

        const response = await axios({
            method: 'post',
            url: 'https://api.stability.ai/v2beta/stable-image/generate/ultra',
            data: formData,
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${STABILITY_API_KEY}`,
                'Accept': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        handleStabilityError(error, res);
    }
});

router.post('/stability/remove-background', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const formData = new FormData();
        formData.append('image', req.file.buffer, {
            filename: 'image.png',
            contentType: req.file.mimetype
        });
        formData.append('output_format', 'png');

        const response = await axios({
            method: 'post',
            url: 'https://api.stability.ai/v2beta/stable-image/edit/remove-background',
            data: formData,
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${STABILITY_API_KEY}`,
                'Accept': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        handleStabilityError(error, res);
    }
});

// Helper function for consistent error handling
function handleStabilityError(error, res) {
    console.error('Full error:', error);
    
    if (error.response) {
        console.error('API Response Error:', {
            status: error.response.status,
            data: error.response.data
        });

        if (error.response.status === 401) {
            return res.status(401).json({ error: 'Invalid API key. Please check your Stability AI credentials.' });
        }
        if (error.response.status === 429) {
            return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
        }
        return res.status(error.response.status).json({ 
            error: `Stability AI API error: ${error.response.data?.message || error.message}`,
            details: error.response.data
        });
    }

    res.status(500).json({ 
        error: 'Internal server error while processing request.',
        details: error.message
    });
}

module.exports = router; 