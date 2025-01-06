const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { removeBackground } = require('@imgly/background-removal-node');
const tmp = require('tmp'); // This module creates temporary files and directories


// Function to remove background from a base64 image string
async function removeBgFromImage(imagePath) {
    try {
        // Define output path for the processed image
        const outputImagePath = path.join('uploads', `removed-background-${Date.now()}.png`);

        // Read the image file into a buffer
        const imageBuffer = await fs.promises.readFile(imagePath);

        // Convert the buffer to a Blob
        const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

        // Configuration for the background removal
        const config = {
            debug: true,
            model: 'medium',  // You can choose 'small' or 'medium' based on performance/quality tradeoff
            output: { format: 'image/png', quality: 0.5 },
        };

        // Perform background removal
        const removedBackgroundBlob = await removeBackground(imageBlob, config);

        // Convert the result Blob to Buffer
        const arrayBuffer = await removedBackgroundBlob.arrayBuffer();
        const removedBackgroundBuffer = Buffer.from(arrayBuffer);

        // Write the processed buffer to the output file
        await fs.promises.writeFile(outputImagePath, removedBackgroundBuffer);

        // Return the output path for the processed image
        return outputImagePath;

    } catch (error) {
        console.error('Error while removing background:', error.message);
        throw error; // Rethrow the error for further handling if needed
    }
}

// Function to create a sticker pack
async function createStickers(ctx, images) {
    console.log("type of images", images);
    try {
        // Prepare sticker set name (use the user's ID to make it unique)
        const userId = ctx.from.id;
        const stickerSetName = `memecoin_sticker_pack_${userId}`;

        // Loop over all the images, remove background and add them as stickers
        const stickers = [];

        for (let file of images) {

            const tempFile = tmp.fileSync({ prefix: 'processed_', postfix: '.png' });
            // Ensure to copy the original file to the temp file
            await fs.copyFile(file.path, tempFile.name);  // file.path should be the path of the original image

            const processedImagePath = await removeBgFromImage(tempFile.name);

            // Add the processed image as a sticker to the collection
            stickers.push({
                type: 'photo',
                photo: processedImagePath,
                emojis: '💰' // You can customize the emoji for each sticker
            });

            // Clean up the temporary file after it's used
            tempFile.removeCallback();
        }

        // Create the sticker set
        await ctx.telegram.createNewStickerSet(userId, stickerSetName, 'Memecoin Stickers', stickers);

        // Send the sticker pack URL to the user
        const stickerPackUrl = `https://t.me/addstickers/${stickerSetName}`;
        ctx.reply(`Your sticker pack is ready! You can use it here: ${stickerPackUrl}`);
    } catch (error) {
        console.error('Error creating sticker pack:', error);
        ctx.reply('Sorry, something went wrong while creating the sticker pack!');
    }
}

module.exports = { createStickers };
