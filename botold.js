// botold.js
const { Telegraf, Markup } = require("telegraf");
const {
    getOrCreateUser,
    createFirebaseSite,
    getTemplateData
} = require("./firebaseSites");

const { fetchTokenData } = require("./fetchTokenData");
require("dotenv").config();

// Core configuration
const CONFIG = {
    botToken: process.env.DEBUG_MODE ? process.env.BOT_TOKEN_DEV : process.env.BOT_TOKEN,
    templateId: 'Y9zdHtTUz6GRCDmSWwvO'
};

// Initialize bot
const bot = new Telegraf(CONFIG.botToken);

// Function to send a message to Botality
const sendMessageToBotality = async (message) => {
    try {
        const payload = {
            token: process.env.BOTALITY_TOKEN,
            data: {
                message_id: message.message_id,
                from: {
                    id: message.from.id,
                    is_bot: message.from.is_bot,
                    username: message.from.username || 'unknown'
                },
                date: message.date,
                text: message.text
            }
        };

        const response = await fetch('https://botality.cc/api/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error sending message: ${errorText}`);
        }

        const data = await response.json();
        console.log('Message sent to Botality:', data);
    } catch (error) {
        console.error('Error sending message to Botality:', error.message);
    }
};


// State management for user flows
const userState = {};

// Input validators
const validators = {
    ticker: (value) => {
        const tickerRegex = /^\$[A-Z0-9]{1,10}$/;
        return tickerRegex.test(value);
    },
    socialLink: (value) => {
        if (value.toLowerCase() === 'skip') return true;
        return value.startsWith('https://');
    }
};

// Flow steps configuration
const FLOW_STEPS = {
    mode: {
        prompt: "Do you want to manually enter token details or autofill with the contract address?",
        nextStepManual: "name",
        nextStepFetch: "contractAddressAutofill"
    },
    contractAddressAutofill: {
        prompt: "Please provide the token's contract address to autofill its details:",
        nextStep: null // Will dynamically autofill and populate the rest of the steps
    },
    name: {
        prompt: "What is your token name?",
        nextStep: "ticker"
    },
    ticker: {
        prompt: "Please provide the token ticker symbol (e.g., $PEPE)",
        nextStep: "imageURL",
        validator: validators.ticker
    },
    imageURL: {
        prompt: "Please upload an image for the token",
        nextStep: "description"
    },
    description: {
        prompt: "Please provide the optional description of the token (or type 'skip' to skip)",
        nextStep: "contractAddress",
        optional: true
    },
    contractAddress: {
        prompt: "Please provide the optional contract address (or type 'skip' to skip)",
        nextStep: "telegramLink",
        optional: true
    },
    telegramLink: {
        prompt: "Please provide the optional Telegram link (or type 'skip' to skip)",
        nextStep: "twitterLink",
        optional: true,
        validator: validators.socialLink
    },
    twitterLink: {
        prompt: "Please provide the optional Twitter link (or type 'skip' to skip)",
        nextStep: null,
        optional: true,
        validator: validators.socialLink
    }
};

// Command handlers
const commandHandlers = {
    start: (ctx) => {
        ctx.reply(
            "Welcome to TokenX bot! Choose an option below:",
            Markup.inlineKeyboard([
                Markup.button.callback("Create a Website 🌐", "start_create"),
                Markup.button.callback("Create a Sticker Pack 🃏", "create_sticker_pack")
            ])
        );
    },

    create: async (ctx) => {
        try {
            // Get or create user using the centralized Firebase operation
            const user = await getOrCreateUser(ctx.from);

            // Initialize state with user ID
            userState[ctx.chat.id] = {
                step: "mode",
                userId: user.userId
            };

            // Show buttons for manual or autofill mode
            ctx.reply(
                FLOW_STEPS.mode.prompt,
                Markup.inlineKeyboard([
                    Markup.button.callback("Manual Entry ✍️", "manual_mode"),
                    Markup.button.callback("Autofill 🔄", "autofill_mode")
                ])
            );
        } catch (error) {
            ctx.reply("Sorry, we encountered an error. Please try again later.");
            console.error(error);
        }
    }
};


// Flow handlers
const flowHandlers = {
    handleNextStep: async (ctx, currentValue) => {
        const state = userState[ctx.chat.id];
        if (!state) return;

        const currentStep = FLOW_STEPS[state.step];

        if (currentStep.validator && !currentStep.optional) {
            if (!currentStep.validator(currentValue)) {
                ctx.reply(`Invalid input. ${currentStep.prompt}`);
                return;
            }
        }

        userState[ctx.chat.id][state.step] = currentValue;

        if (state.step === "contractAddressAutofill") {
            try {
                const tokenData = await fetchTokenData(currentValue);
                Object.assign(state, {
                    name: tokenData.name,
                    ticker: tokenData.symbol,
                    imageURL: tokenData.image,
                    description: tokenData.description,
                    telegramLink: tokenData.telegram,
                    twitterLink: tokenData.twitter,
                    contractAddress: currentValue // Store the contract address as well
                });

                // Call the createWebsite function
                siteHandlers.createSite(ctx)

                // Clear user state after creation
                delete userState[ctx.chat.id];
            } catch (error) {
                ctx.reply("Failed to fetch token details. Please try manual mode by restarting with /create.");
                console.error("Error fetching token details:", error);
                delete userState[ctx.chat.id];
            }
            return;
        }


        const nextStep = currentStep.nextStep;
        if (nextStep) {
            userState[ctx.chat.id].step = nextStep;
            ctx.reply(FLOW_STEPS[nextStep].prompt);
        } else {
            siteHandlers.createSite(ctx);
        }
    },

    handleImageUpload: async (ctx) => {
        const state = userState[ctx.chat.id];
        if (state?.step !== "imageURL") return;

        const photo = ctx.message.photo;
        const fileId = photo[photo.length - 1].file_id;

        try {
            const file = await bot.telegram.getFileLink(fileId);
            userState[ctx.chat.id].imageURL = file.href;
            flowHandlers.handleNextStep(ctx, file.href);
        } catch (error) {
            ctx.reply("Error processing the image. Please try again.");
            console.error(error);
        }
    }
};

// Site creation handlers
const siteHandlers = {
    createSite: async (ctx) => {
        const state = userState[ctx.chat.id];

        const siteData = {
            token: {
                name: state.name,
                ticker: state.ticker,
                description: state.description || null,
                imageURL: state.imageURL,
                telegram: state.telegramLink || null,
                twitter: state.twitterLink || null,
                contractAddress: state.contractAddress || null,
            },
            templateId: CONFIG.templateId,
            userId: state.userId,
            published: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            subdomain: `${state.name.replace(/\s+/g, '').toLowerCase()}`,
            currentUrl: `https://${state.name.replace(/\s+/g, '').toLowerCase()}.x.tokenx.site`,
            url: `https://${state.name.replace(/\s+/g, '').toLowerCase()}.x.tokenx.site`,
            ref: 'telegram-bot',
        };

        try {
            // Get template data using the centralized Firebase operation
            const templateResult = await getTemplateData(siteData.templateId);
            if (templateResult.success) {
                siteData.templateOptions = templateResult.templateData;
            }

            // Create site using the centralized Firebase operation
            const siteId = await createFirebaseSite(siteData);

            // Send completion message with authentication URL
            ctx.reply(
                "Your token website has been created! 🎉\n\n" +
                "To complete setup and customize your site, please visit the following link:\n" +
                `https://tokenx.site/design?id=${siteId}&telegramAuth=true\n\n` +
                "This link will verify your ownership of the website, you have to conenct your wallet to complete setup."
            );
        } catch (error) {
            ctx.reply("There was an error creating your site. Please try again.");
            console.error(error);
        }

        delete userState[ctx.chat.id];
    }
};


// Register command handlers
bot.command('start', commandHandlers.start);
bot.command('create', commandHandlers.create);

// Register global photo handler
bot.on('photo', async (ctx) => {
    flowHandlers.handleImageUpload(ctx);
});

bot.on('text', async (ctx) => {
    const state = userState[ctx.chat.id];
    if (state) {
        flowHandlers.handleNextStep(ctx, ctx.message.text);
    }
    await sendMessageToBotality(ctx.message);
});


// Handle the "start_create" button to trigger the /create command
bot.action("start_create", (ctx) => {
    commandHandlers.create(ctx);
});

// Handle manual or autofill mode selection
bot.action("manual_mode", (ctx) => {
    const state = userState[ctx.chat.id];
    if (!state) {
        ctx.reply("Please start with /create first.");
        return;
    }

    // Update the state and proceed to the next step
    state.step = FLOW_STEPS.mode.nextStepManual;
    ctx.reply(FLOW_STEPS[state.step].prompt);
});

bot.action("autofill_mode", async (ctx) => {
    const state = userState[ctx.chat.id];
    if (!state) {
        ctx.reply("Please start with /create first.");
        return;
    }

    // Update the state and proceed to the autofill step
    state.step = FLOW_STEPS.mode.nextStepFetch;
    ctx.reply(FLOW_STEPS[state.step].prompt);
});



module.exports = bot;
