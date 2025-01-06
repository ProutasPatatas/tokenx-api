exports.CONFIG = {
    botToken: process.env.BOT_TOKEN,
    templateId: 'Y9zdHtTUz6GRCDmSWwvO'
};

exports.FLOW_STEPS = {
    mode: {
        prompt: "Do you want to manually enter token details or autofill with the contract address?",
        nextStepManual: "name",
        nextStepFetch: "contractAddressAutofill"
    },
    // ... rest of your FLOW_STEPS configuration
}; 
