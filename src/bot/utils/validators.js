exports.validators = {
    ticker: (value) => {
        const tickerRegex = /^\$[A-Z0-9]{1,10}$/;
        return tickerRegex.test(value);
    },
    socialLink: (value) => {
        if (value.toLowerCase() === 'skip') return true;
        return value.startsWith('https://');
    }
}; 