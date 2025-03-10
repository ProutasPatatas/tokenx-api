// Import dependencies
const express = require("express");
const cors = require("cors");
const { verifySolanaPayment } = require("./solanaUtils.js");
const bot = require("./bot.js");
const aiGenerateRouter = require("./ai-generate.js");
const { createFirebaseSite, getOrCreateUser, getTemplateData } = require("./firebaseSites.js");
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
require("dotenv").config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file upload
const upload = multer();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Root route
app.get("/", (req, res) => {
    res.send("Hello!");
});

// Website creation endpoint
app.post("/api/website", upload.single('image'), async (req, res) => {
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

// Mount routes
// app.use('/api/telegram', botRouter);
app.use('/api/ai', aiGenerateRouter); // Add AI routes under /api/ai prefix

// Webhook for TokenX bot
// app.post("/bot/webhook", async (req, res) => {
//     const { userId, action, data } = req.body;
//     console.log("Webhook received:", req.body);

//     try {
//         if (action === "payment") {
//             // Verify Solana payment
//             const isPaid = await verifySolanaPayment(data.transactionHash, 0.1);
//             if (!isPaid) {
//                 return res.status(400).send({ error: "Payment not verified" });
//             }
//             res.send({ success: true, message: "Payment verified. Proceed with token data." });
//         } else {
//             res.status(400).send({ error: "Invalid action" });
//         }
//     } catch (error) {
//         console.error("Error handling webhook:", error);
//         res.status(500).send({ error: "Internal Server Error" });
//     }
// });

// Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);

    // Start Telegram bot
    bot.launch();
    console.log("Telegram bot is running", process.env.DEBUG_MODE ? process.env.BOT_TOKEN_DEV : process.env.BOT_TOKEN);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
