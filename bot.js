const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const axios = require('axios');
const FormData = require('form-data');
const {
    getOrCreateUser,
    createFirebaseSite,
    getTemplateData
} = require("./firebaseSites");
const { fetchTokenData } = require("./fetchTokenData");
require("dotenv").config();
const PORT = process.env.PORT || 3001;


// Predefined prompts for memecoins
const PREDEFINED_PROMPTS = [
    { label: "🚀 Bullish", prompt: "Excited mascot with rocket emojis, moon background, laser eyes" },
    { label: "🐻 Bearish", prompt: "Crying mascot, falling charts, red candles, tears" },
    { label: "💎 HODL", prompt: "Diamond hands, determined expression, sparkles, strong pose" },
    { label: "😱 FOMO", prompt: "Panicked mascot, wide eyes, sweating, rising charts background" },
    { label: "🎰 Degen", prompt: "Wild-eyed mascot, casino chips, crazy expression, gambling" },
    { label: "🤑 Rich", prompt: "Mascot with money eyes, raining coins, luxury items, gold chain" },
    { label: "🧘 Zen", prompt: "Meditating mascot, peaceful expression, floating coins, calm" },
    { label: "🎯 DCA", prompt: "Strategic mascot, calculator, charts, steady growth arrows" },
    { label: "🔥 Pump", prompt: "Energetic mascot, fire effects, upward arrows, excitement" },
    { label: "💩 Dump", prompt: "Shocked mascot, falling coins, red arrows, despair" },
    { label: "🦍 Ape", prompt: "Gorilla-mode mascot, bananas, jungle theme, wild energy" },
    { label: "🎭 Cope", prompt: "Mascot with fake smile, copium tanks, hiding pain" }
];

// Core configuration
const CONFIG = {
    botToken: process.env.DEBUG_MODE ? process.env.BOT_TOKEN_DEV : process.env.BOT_TOKEN,
    templateId: 'Y9zdHtTUz6GRCDmSWwvO'
};

// Initialize bot
const bot = new Telegraf(CONFIG.botToken);

// State management
const stickerState = {};

// Enhanced sticker creation handlers
const stickerHandlers = {
    startCreation: async (ctx) => {
        // Initialize sticker state for the chat if it doesn't exist
        if (!stickerState[ctx.chat.id]) {
            stickerState[ctx.chat.id] = {
                step: 'initial',
                stickers: [],
                userId: ctx.from.id
            };
        }

        const buttons = [
            [Markup.button.callback("Upload Image 🖼", "upload_image")],
            [Markup.button.callback("Use Predefined Prompt 📝", "show_prompts")],
            [Markup.button.callback("Custom Prompt ✍️", "custom_prompt")]
        ];

        if (stickerState[ctx.chat.id].stickers.length > 0) {
            buttons.push([Markup.button.callback("Create Pack 📦", "create_pack")]);
        }

        ctx.reply(
            "Let's create some stickers! Choose how you want to create your sticker:",
            Markup.inlineKeyboard(buttons)
        );
    },

    showPrompts: async (ctx) => {
        const buttons = PREDEFINED_PROMPTS.map(p => [
            Markup.button.callback(p.label, `prompt_${PREDEFINED_PROMPTS.indexOf(p)}`)
        ]);
        
        ctx.reply(
            "Choose a predefined prompt for your sticker:",
            Markup.inlineKeyboard(buttons)
        );
    },

    generateSticker: async (ctx, prompt, imageBuffer = null) => {
        try {
            const formData = new FormData();
            
            if (imageBuffer) {
                // If image is provided, use variations endpoint
                formData.append('image', imageBuffer, { filename: 'image.png' });
                formData.append('prompt', prompt);
                
                const response = await axios.post(
                    `http://localhost:${PORT}/api/stability/sd3/variations`,
                    formData,
                    { headers: formData.getHeaders() }
                );
                
                return response.data;
            } else {
                // Generate from scratch
                formData.append('prompt', prompt);
                
                const response = await axios.post(
                    `http://localhost:${PORT}/api/stability/sd3/generate`,
                    formData,
                    { headers: formData.getHeaders() }
                );
                
                return response.data;
            }
        } catch (error) {
            console.error('Error generating sticker:', error);
            throw error;
        }
    },

    removeBackground: async (imageBuffer) => {
        const formData = new FormData();
        formData.append('image', imageBuffer, { filename: 'image.png' });
        
        const response = await axios.post(
            `http://localhost:${PORT}/api/stability/remove-background`,
            formData,
            { headers: formData.getHeaders() }
        );
        
        return response.data;
    },

    processGeneratedImage: async (imageBuffer) => {
        // Remove background
        const noBgImage = await stickerHandlers.removeBackground(imageBuffer);
        
        // Add outline stroke
        const processedImage = await sharp(noBgImage)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .composite([{
                input: Buffer.from(
                    `<svg><rect x="0" y="0" width="512" height="512" fill="none" 
                    stroke="white" stroke-width="4"/></svg>`
                ),
                blend: 'over'
            }])
            .png()
            .toBuffer();

        return processedImage;
    },

    handleGeneratedSticker: async (ctx, imageBuffer) => {
        const processedImage = await stickerHandlers.processGeneratedImage(imageBuffer);
        
        // Send preview to user
        await ctx.replyWithPhoto(
            { source: processedImage },
            Markup.inlineKeyboard([
                [
                    Markup.button.callback("Add to Pack ➕", "add_to_pack"),
                    Markup.button.callback("Ignore ❌", "ignore_sticker")
                ]
            ])
        );

        // Store the processed image temporarily
        stickerState[ctx.chat.id].currentSticker = processedImage;
    },

    handleImageUpload: async (ctx) => {
        // Ensure stickerState is initialized
        if (!stickerState[ctx.chat.id]) {
            stickerState[ctx.chat.id] = { stickers: [] }; // Initialize if not present
        }

        const photo = ctx.message.photo;
        const fileId = photo[photo.length - 1].file_id;
        
        try {
            const file = await ctx.telegram.getFile(fileId);
            const response = await fetch(`https://api.telegram.org/file/bot${CONFIG.botToken}/${file.file_path}`);
            const imageBuffer = await response.arrayBuffer();
            
            // Analyze image with OpenAI
            const formData = new FormData();
            formData.append('image', imageBuffer, { filename: 'image.png' });
            
            const analysis = await axios.post(
                `http://localhost:${PORT}/api/openai/analyze`,
                formData,
                { headers: formData.getHeaders() }
            );

            // Show prompt options
            ctx.reply(
                "I've analyzed your image. Choose a prompt option:",
                Markup.inlineKeyboard([
                    [Markup.button.callback("Use AI Suggestion 🤖", "use_ai_prompt")],
                    [Markup.button.callback("Custom Prompt ✍️", "custom_prompt")],
                    [Markup.button.callback("Show Predefined Prompts 📝", "show_prompts")]
                ])
            );

            stickerState[ctx.chat.id].uploadedImage = imageBuffer;
            stickerState[ctx.chat.id].aiPrompt = analysis.data.description;

        } catch (error) {
            ctx.reply("Error processing the image. Please try again.");
            console.error(error);
        }
    },

    createStickerSet: async (ctx) => {
        const state = stickerState[ctx.chat.id];
        if (!state || state.stickers.length === 0) {
            ctx.reply("No stickers to create a pack with! Add some stickers first.");
            return;
        }

        ctx.reply(
            "Let's create your sticker pack! First, give it a name (letters, numbers, and underscores only):",
            Markup.forceReply()
        );
        state.step = 'naming_pack';
    }
};

// Command handlers
bot.command('stickers', (ctx) => stickerHandlers.startCreation(ctx));

// Action handlers
bot.action('show_prompts', (ctx) => stickerHandlers.showPrompts(ctx));

bot.action('upload_image', (ctx) => {
    // Ensure stickerState is initialized
    if (!stickerState[ctx.chat.id]) {
        stickerState[ctx.chat.id] = { stickers: [] }; // Initialize if not present
    }
    ctx.reply("Please send me an image to create a sticker from.");
    stickerState[ctx.chat.id].step = 'awaiting_image';
});

bot.action('custom_prompt', (ctx) => {
    ctx.reply("Please enter your custom prompt for the sticker:");
    stickerState[ctx.chat.id].step = 'awaiting_prompt';
});

bot.action(/^prompt_(\d+)$/, async (ctx) => {
    const promptIndex = parseInt(ctx.match[1]);
    const prompt = PREDEFINED_PROMPTS[promptIndex].prompt;
    const state = stickerState[ctx.chat.id];

    try {
        const generatedImage = await stickerHandlers.generateSticker(
            ctx, 
            prompt,
            state.uploadedImage || null
        );
        await stickerHandlers.handleGeneratedSticker(ctx, generatedImage);
    } catch (error) {
        ctx.reply("Error generating sticker. Please try again.");
        console.error(error);
    }
});

bot.action('add_to_pack', async (ctx) => {
    const state = stickerState[ctx.chat.id];
    if (state.currentSticker) {
        state.stickers.push(state.currentSticker);
        delete state.currentSticker;
        
        ctx.reply(
            `Sticker added! Total stickers: ${state.stickers.length}`,
            Markup.inlineKeyboard([
                [Markup.button.callback("Add Another Sticker ➕", "start_creation")],
                [Markup.button.callback("Create Pack 📦", "create_pack")]
            ])
        );
    }
});

bot.action('create_pack', (ctx) => stickerHandlers.createStickerSet(ctx));

// Handle image uploads
bot.on('photo', async (ctx) => {
    const state = stickerState[ctx.chat.id];
    if (state && state.step === 'awaiting_image') {
        await stickerHandlers.handleImageUpload(ctx);
    }
});

// Handle text inputs
bot.on('text', async (ctx) => {
    const state = stickerState[ctx.chat.id];
    if (!state) return;

    if (state.step === 'awaiting_prompt') {
        try {
            const generatedImage = await stickerHandlers.generateSticker(
                ctx,
                ctx.message.text,
                state.uploadedImage || null
            );
            await stickerHandlers.handleGeneratedSticker(ctx, generatedImage);
        } catch (error) {
            ctx.reply("Error generating sticker. Please try again.");
            console.error(error);
        }
    } else if (state.step === 'naming_pack') {
        // Handle pack creation with the provided name
        // ... (rest of the pack creation logic)
    }
});

module.exports = bot;
