exports.sendMessageToBotality = async (message) => {
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
            throw new Error(`Error sending message: ${await response.text()}`);
        }

        const data = await response.json();
        console.log('Message sent to Botality:', data);
    } catch (error) {
        console.error('Error sending message to Botality:', error.message);
    }
}; 