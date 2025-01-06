// solanaUtils.js
const { Connection, PublicKey } = require("@solana/web3.js");

const connection = new Connection("https://dimensional-orbital-model.solana-mainnet.quiknode.pro/883895b5f4927fedf0b06ab9d84d1d787f6daa41/");

async function verifySolanaPayment(transactionHash, amount) {
  try {
    const transaction = await connection.getParsedTransaction(transactionHash, "confirmed");
    if (!transaction) throw new Error("Transaction not found");

    const payment = transaction.transaction.message.accountKeys.find(
      (account) => account.pubkey.toString() === process.env.SOL_RECEIVER_ADDRESS
    );
    const paidAmount = transaction.meta.postBalances[0] / 1e9; // Convert lamports to SOL

    return payment && paidAmount >= amount;
  } catch (error) {
    console.error("Error verifying payment:", error);
    return false;
  }
}

module.exports = { verifySolanaPayment };
