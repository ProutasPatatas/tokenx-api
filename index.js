// Import dependencies
const express = require("express");
const cors = require("cors");
const { verifySolanaPayment } = require("./solanaUtils.js"); // Utility to verify SOL payments
const bot = require("./bot.js"); // Import Telegram bot
require("dotenv").config();

// Initialize Express app
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());


// Webhook for TokenX bot
app.post("/bot/webhook", async (req, res) => {
    const { userId, action, data } = req.body;

    try {
        if (action === "payment") {
            // Verify Solana payment
            const isPaid = await verifySolanaPayment(data.transactionHash, 0.1);
            if (!isPaid) {
                return res.status(400).send({ error: "Payment not verified" });
            }
            res.send({ success: true, message: "Payment verified. Proceed with token data." });
        } else {
            res.status(400).send({ error: "Invalid action" });
        }
    } catch (error) {
        console.error("Error handling webhook:", error);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);

    // Start Telegram bot
    bot.launch();
    console.log("Telegram bot is running");
});
