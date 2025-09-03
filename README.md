# 📚 Decentralized E-Textbook Marketplace

Welcome to a revolutionary Web3 solution for affordable e-textbooks! This project creates a decentralized marketplace on the Stacks blockchain, where publishers can sell verified authentic e-textbooks at low costs, buyers in low-resource areas can access them affordably, and blockchain ensures piracy is combated through immutable authenticity checks and NFT-based ownership.

## ✨ Features

📖 Upload and mint e-textbooks as NFTs for digital ownership  
🔍 Verify textbook authenticity via cryptographic hashes to prevent piracy  
💰 Affordable pricing with micro-transactions in STX or custom tokens  
🛒 Decentralized marketplace for listing, buying, and reselling textbooks  
👥 User roles for publishers, buyers, and verifiers with secure registration  
📈 Royalty distribution to original creators on resales  
⚖️ Dispute resolution for transaction issues  
🔒 License management to control access and prevent unauthorized sharing  
🌍 Focused on low-resource areas with low-fee transactions on Stacks  
📝 Review and rating system to build trust in the community  

## 🛠 How It Works

This project leverages 8 smart contracts written in Clarity to handle various aspects of the marketplace securely and transparently.

### Smart Contracts Overview
- **UserRegistry**: Registers users (publishers, buyers) with roles and profiles.  
- **TextbookNFT**: Mints NFTs representing e-textbooks, storing metadata like hashes for authenticity.  
- **AuthenticityVerifier**: Checks cryptographic hashes against registered textbooks to confirm originality.  
- **Marketplace**: Handles listing, bidding, and direct sales of textbook NFTs.  
- **PaymentSplitter**: Manages payments, royalties, and splits for creators and platform fees.  
- **LicenseManager**: Issues and revokes access licenses tied to NFT ownership.  
- **DisputeResolution**: Allows users to raise and resolve disputes via on-chain voting or arbitration.  
- **ReviewSystem**: Enables ratings and reviews linked to verified purchases.  

**For Publishers**  
- Register your account via UserRegistry.  
- Generate a SHA-256 hash of your e-textbook PDF/content.  
- Mint an NFT with TextbookNFT, including the hash, title, description, and price.  
- List it on the Marketplace for sale.  
- Earn royalties automatically via PaymentSplitter on any resales.  

**For Buyers**  
- Register via UserRegistry.  
- Browse listings on the Marketplace and purchase with STX.  
- Receive an NFT for ownership and a license via LicenseManager for access.  
- Resell textbooks if needed, with built-in royalty splits.  
- Leave reviews on the ReviewSystem after purchase.  

**For Verifiers/Anti-Piracy**  
- Use AuthenticityVerifier to input a hash and check against registered NFTs.  
- Confirm ownership and originality instantly via get-textbook-details.  
- Raise disputes in DisputeResolution if piracy is suspected.  

That's it! A secure, affordable way to distribute knowledge while protecting creators in underserved regions.