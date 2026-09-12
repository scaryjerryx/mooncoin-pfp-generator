require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

const token = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_TOKEN_HERE';
const bot = new TelegramBot(token, { polling: true });

console.log('Mooncoin PFP Generator is running...');

// The Button Layout
const keyboardLayout = {
    reply_markup: {
        inline_keyboard: [[
            { text: "Moon Me 🍑", callback_data: "generate_pfp" }
        ]]
    }
};

// Secret command to get the Chat ID
bot.onText(/\/getid/, (msg) => {
    bot.sendMessage(msg.chat.id, `This Chat ID is: ${msg.chat.id}`);
});

// Listen for /start or /moon command
bot.onText(/\/(start|moon)/, async (msg) => {
    const bannerPath = path.join(__dirname, 'moon_banner.jpg');
    try {
        await bot.sendPhoto(msg.chat.id, bannerPath, {
            caption: "Welcome to the Mooncoin PFP Generator! 🚀\n\nClick the button below to strap on a random spacesuit:",
            ...keyboardLayout
        });
    } catch (e) {
        console.error("Failed to send banner:", e);
    }
});

// 2. Button Click Handler
bot.on('callback_query', async (query) => {
    if (query.data === 'generate_pfp') {
        const chatId = query.message.chat.id;
        const userId = query.from.id;

        // Acknowledge button click to stop the loading circle on the button
        bot.answerCallbackQuery(query.id);
        
        await generateAndSendPFP(chatId, userId);
    }
});

// 3. Fallback for people who just type the command
bot.onText(/\/moonme/, async (msg) => {
    await generateAndSendPFP(msg.chat.id, msg.from.id);
});

async function generateAndSendPFP(chatId, userId) {
    try {
        console.log(`Starting generation for user ${userId} in chat ${chatId}`);
        bot.sendMessage(chatId, "🚀 Firing up the rockets... generating your random Mooncoin PFP!");

        // Fetch User PFP
        console.log("Fetching user profile photos...");
        const profiles = await bot.getUserProfilePhotos(userId, { offset: 0, limit: 1 });
        if (profiles.total_count === 0) {
            console.log("User has no profile picture.");
            return bot.sendMessage(chatId, "You don't have a Telegram profile picture set! Please upload one to use this feature.");
        }

        const fileId = profiles.photos[0][profiles.photos[0].length - 1].file_id;
        console.log("Got fileId, fetching file link...");
        const fileLink = await bot.getFileLink(fileId);
        console.log("File link fetched:", fileLink);

        // Randomly select a variant suit
        const variantsDir = path.join(__dirname, 'variants');
        const files = fs.readdirSync(variantsDir).filter(f => f.endsWith('.png'));
        const randomVariant = files[Math.floor(Math.random() * files.length)];
        const suitPath = path.join(variantsDir, randomVariant);

        // Load Images
        const background = await Jimp.read(path.join(__dirname, 'background.png'));
        const userAvatar = await Jimp.read(fileLink);
        const spacesuit = await Jimp.read(suitPath);

        // Normalize background and suit to 512x512
        background.resize(512, 512);
        spacesuit.resize(512, 512);

        // Find matching JSON for the chosen variant
        const jsonPath = suitPath.replace('.png', '.json');
        let coords = { center_x: 256, center_y: 128, w: 100, h: 100 };
        try {
            const raw = fs.readFileSync(jsonPath);
            coords = JSON.parse(raw);
        } catch (e) {
            console.log("No JSON found, using fallback coords.");
        }

        // The image is scaled to 512x512, so halve the 1024x1024 coordinates
        const targetW = coords.w / 2;
        const targetH = coords.h / 2;
        const centerX = coords.center_x / 2;
        const centerY = coords.center_y / 2;

        // Scale the avatar to fit the bounding box
        const size = Math.max(targetW, targetH) + 20; 
        userAvatar.resize(size, size);
        
        // Crop the user's avatar into a perfect circle
        userAvatar.circle();
        
        // Center it behind the visor
        const placeX = centerX - (size / 2);
        const placeY = centerY - (size / 2);
        
        // First lay down the user's avatar
        background.composite(userAvatar, placeX, placeY); 
        // Then slap the transparent spacesuit template ON TOP
        background.composite(spacesuit, 0, 0);

        // Send back to Telegram
        console.log("Generating buffer...");
        const finalImageBuffer = await background.getBufferAsync(Jimp.MIME_PNG);
        
        // Select a funny caption
        const funnyCaptions = [
            "🌕 Houston, we have a problem... and it's a bare ass.",
            "🚀 Taking a selfie while getting MOONED! Typical.",
            "📸 Space selfie ruined by a wild Mooncoin degen!",
            "🍑 That's one small step for man, one giant LEAP for Mooncoin!",
            "🔭 I just wanted a nice PFP, but this guy had other plans...",
            "👽 Is this what they meant by the dark side of the moon?",
            "👨‍🚀 10/10 Spacesuit. 0/10 situational awareness.",
            "🌠 Look mom, I'm in space! Wait, who is that behind me?",
            "✨ Interstellar photobomb level: EXPERT."
        ];
        const randomCaption = funnyCaptions[Math.floor(Math.random() * funnyCaptions.length)];
        
        console.log("Sending photo to Telegram...");
        await bot.sendPhoto(chatId, finalImageBuffer, { 
            caption: `${randomCaption}\n\nClick below to go again:`,
            reply_markup: keyboardLayout.reply_markup
        });
        console.log("Photo sent successfully.");

    } catch (error) {
        console.error("Error generating PFP:", error);
        bot.sendMessage(chatId, "Oops! Something went wrong while launching your rocket. Please try again.");
    }
}
