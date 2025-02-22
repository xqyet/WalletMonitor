## WalletMonitor

This project is a simple blockchain monitoring and fund interception tool - designed specifically for tracking scammer wallets. 


**Supported Chains** – Supports Ethereum, Binance Smart Chain (BSC), Polygon, Arbitrum, and Solana.  
**Seed Phrase Monitoring** – Derives wallet addresses from a seed phrase to track movements.  
**Automatic Transfer** – Monitors incoming transactions redirects funds to an external wallet.  
**Automatic Execution** – Runs at intervals to continuously monitor and act - also includes an event listener for incoming transactions (if not being rate limited on a public node)

---


### **Prerequisites**
Have the following installed:  
- [Node.js](https://nodejs.org/) (v16+ recommended)  
- npm or yarn  
- A `.env` file with the scammers seed phrase  

### **Clone Repo**
```sh
git clone https://github.com/xqyet/WalletMonitor.git
```

