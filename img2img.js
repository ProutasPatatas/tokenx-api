// img2img.js
require("dotenv").config();

const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

// Hardcoded negative prompt to avoid unwanted elements in the generated image
const NEGATIVE_PROMPT = 'No text, no logos, no watermarks, no artifacts, no blur, no noise, no backgrounds';

async function generateImage({ imageUrl, prompt, height = 512, width = 512, num_steps = 20, strength = 1, guidance = 7.5, seed }) {
    try {
        // Fetch the image to send as input
        const inputImage = await fetch(imageUrl);
        const imageBuffer = await inputImage.arrayBuffer();

        const inputs = {
            prompt: prompt,  // Text description for the image generation
            negative_prompt: NEGATIVE_PROMPT,  // Use the hardcoded negative prompt
            height: height,  // Height of the generated image
            width: width,    // Width of the generated image
            image: Array.from(new Uint8Array(imageBuffer)),  // Convert image buffer to an array of numbers for JSON serialization
            num_steps: num_steps,  // Number of diffusion steps
            strength: strength,  // Strength of transformation during img2img
            guidance: guidance,  // Controls prompt adherence
            seed: seed,  // Random seed for reproducibility
        };

        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/runwayml/stable-diffusion-v1-5-img2img`, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${CLOUDFLARE_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(inputs)
        });

        if (response.ok) {
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            return Buffer.from(arrayBuffer); // Convert the array buffer to a buffer that can be used with ctx.replyWithPhoto
        } else {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error:", error);
        throw error;  // Rethrow the error for handling in the caller function
    }
}

module.exports = { generateImage };  // Export the function for use in other files
