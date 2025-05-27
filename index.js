// Import dependencies
const express = require("express");
const cors = require("cors");
const { createFirebaseSite, getOrCreateUser, getTemplateData } = require("./firebaseSites.js");
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
require("dotenv").config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file upload with error handling
const upload = multer({
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB in bytes
    }
}).single('image');

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Root route
app.get("/", (req, res) => {
    res.send("Hello!");
});

// Website creation endpoint
app.post("/api/website", (req, res) => {
    upload(req, res, async function(err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: "File size too large. Maximum size is 5MB"
                });
            }
            return res.status(400).json({
                success: false,
                message: err.message
            });
        } else if (err) {
            return res.status(500).json({
                success: false,
                message: "Error uploading file"
            });
        }

        try {
            const { 
                name, 
                ticker, 
                twitter, 
                telegram, 
                description, 
                contract, 
                subdomain, 
                userWallet,
                template
            } = req.body;

            // Validate required fields
            if (!name || !ticker || !subdomain || !userWallet || !req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: name, ticker, subdomain, userWallet, and image file are required"
                });
            }

            // Validate file type
            if (!req.file.mimetype.startsWith('image/')) {
                return res.status(400).json({
                    success: false,
                    message: "Uploaded file must be an image"
                });
            }

            // Upload image to media server
            const formData = new FormData();
            formData.append('file', req.file.buffer, req.file.originalname);
            
            const imageUploadResponse = await axios.post(
                'https://media.tokenx.site/upload',
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    }
                }
            );

            // Get or create user based on wallet address
            const user = await getOrCreateUser({
                walletAddress: userWallet
            });

            // Get template data
            const templateOptions = await getTemplateData(template || "Y9zdHtTUz6GRCDmSWwvO");
          
            // Prepare site data with token information
            const siteData = {
                token: {
                    name,
                    ticker,
                    imageURL: imageUploadResponse.data.url,
                    // Optional social links
                    twitter: twitter || null,
                    telegram: telegram || null,
                    description: description || null,
                    contractAddress: contract || null
                },
                subdomain,
                userId: user.userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                published: true,
                ref: 'api',
                templateId: template || "Y9zdHtTUz6GRCDmSWwvO",
                templateOptions: templateOptions.templateData || {}
            };

            // Create the site using the existing Firebase function
            const siteId = await createFirebaseSite(siteData);

            // Return success response with the site URL and user info
            res.status(201).json({
                success: true,
                message: "Website created successfully",
                siteId,
                url: `https://${siteData.subdomain}.x.tokenx.site`,
                editLink: `https://www.tokenx.site/design?id=${siteId}`,
                user: {
                    userId: user.userId,
                    walletAddress: user.walletAddress
                }
            });

        } catch (error) {
            console.error("Error creating website:", error);
            res.status(500).json({
                success: false,
                message: "Failed to create website",
                error: error.message
            });
        }
    });
});



// Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
