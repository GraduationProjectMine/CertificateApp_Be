# Backend Service — Certificate Management System (DATN)

A robust, enterprise-ready REST API built with **NestJS 11**, **TypeScript**, and **Prisma ORM (MariaDB)** for issuing, managing, verifying, and anchoring academic and professional certificates to the Ethereum blockchain (Sepolia testnet) and IPFS.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture & Modules](#architecture--modules)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Installation & Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [Database Management (Prisma)](#database-management-prisma)
- [API Documentation (Swagger)](#api-documentation-swagger)
- [Testing & Quality](#testing--quality)
- [Docker Deployment](#docker-deployment)

---

## Features

- **Role-Based Authentication & Authorization:** Multi-role access control (Admin, Issuer/Staff, Student, Verifier) with JWT authentication and secure HTTP cookies.
- **Blockchain Integration:** Smart contract interaction via Ethers.js (v6) for on-chain certificate verification, revocation, and automated issuer wallet authorization on Ethereum Sepolia.
- **Decentralized Storage (IPFS):** Certificate metadata and assets pinning using Pinata IPFS.
- **OCR Verification:** Optical Character Recognition powered by Google Cloud Vision API to verify physical and scanned certificate legitimacy.
- **Media Storage:** Cloudinary integration for scalable digital certificate asset and template storage.
- **Batch Processing & Export:** Support for mass certificate generation, Excel parsing, and certificate template processing.
- **Security & Rate Limiting:** Throttling guards via `@nestjs/throttler`, input validation via `class-validator`, and cookie protection.

---

## Tech Stack

- **Framework:** [NestJS 11](https://nestjs.com/) (Node.js framework)
- **Language:** TypeScript 5.7+
- **Database & ORM:** MariaDB / MySQL via [Prisma ORM 7](https://www.prisma.io/) with `@prisma/adapter-mariadb`
- **Blockchain:** [Ethers.js v6](https://docs.ethers.org/v6/) & Sepolia Testnet
- **Storage & Cloud Services:** Cloudinary, Pinata (IPFS), Google Cloud Vision API
- **API Documentation:** OpenAPI / Swagger (`@nestjs/swagger`)

---

## Architecture & Modules

The backend is structured into modular feature domains located in `src/modules/` and core shared services in `src/core/`:

```text
src/
├── app.module.ts              # Root application module
├── main.ts                    # Application entrypoint & Swagger bootstrap
├── core/
│   ├── blockchain/            # Blockchain interaction & contract integration service
│   ├── ipfs/                  # IPFS & Pinata upload integration
│   └── prisma/                # Prisma ORM database connection service
└── modules/
    ├── auth/                  # Authentication, JWT strategy, login/register
    ├── certificate/           # Certificate issuance, queries, and verification
    ├── batches/               # Batch certificate processing
    ├── templates/             # Certificate design templates
    ├── issuer/                # Issuer profile and authorization management
    ├── student/               # Student information & records
    ├── staff/                 # Staff accounts and management
    ├── verifier/              # Verification portal logic
    ├── ocr/                   # Google Cloud Vision OCR processing
    ├── cloudinary/            # Cloudinary asset management
    ├── dispute/               # Dispute handling & resolution
    ├── notifications/         # Notification system
    ├── audit/                 # Audit trail and event logging
    └── monitor/               # System health and monitoring
```

---

## Prerequisites

Before running the backend, make sure you have the following installed:

1. **Node.js:** v18.x, v20.x, or v24.x (LTS recommended)
2. **Package Manager:** npm, yarn, or pnpm
3. **Database:** MariaDB or MySQL (v10.5+ / v8.0+)
4. **External Services (Optional for full features):**
   - [Alchemy](https://www.alchemy.com/) or Infura Sepolia RPC URL
   - Ethereum wallet private key with Sepolia ETH
   - [Cloudinary](https://cloudinary.com/) Account (Cloud Name, API Key, Secret)
   - [Pinata](https://pinata.cloud/) Account (JWT or API Keys)
   - [Google Cloud Vision](https://cloud.google.com/vision) Service Account key (`ocr-key.json`)

---

## Environment Configuration

Create a `.env` file in the `backend/` directory:
Put ocr-key.json in /backend

```bash
```

Configure the environment variables as shown below:

```env
# Application Port & Environment
PORT=3000
NODE_ENV=development

# Database Connection (MariaDB / MySQL)
# Format: mariadb://USER:PASSWORD@HOST:PORT/DATABASE_NAME
DATABASE_URL="mariadb://root:password@localhost:3306/certificate_db"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key"

# Cloudinary (Image & Certificate Storage)
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
# Or single URL format:
# CLOUDINARY_URL="cloudinary://api_key:api_secret@cloud_name"

# Pinata / IPFS
PINATA_JWT="your_pinata_jwt_token"
PINATA_API_KEY="your_pinata_api_key"
PINATA_API_SECRET="your_pinata_api_secret"

# Google Cloud Vision (OCR)
GOOGLE_APPLICATION_CREDENTIALS="./ocr-key.json"

# Blockchain & Sepolia Testnet
RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY"
BLOCKCHAIN_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY"
SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY"

# Deployer / Contract Owner Private Key (Must have Sepolia ETH)
ADMIN_PRIVATE_KEY="0xYourWalletPrivateKey"
SEPOLIA_PRIVATE_KEY="0xYourWalletPrivateKey"

# Deployed CertificateRegistry Smart Contract Address
CONTRACT_ADDRESS="0xYourDeployedContractAddress"
BLOCKCHAIN_CONTRACT_ADDRESS="0xYourDeployedContractAddress"
SEPOLIA_CONTRACT_ADDRESS="0xYourDeployedContractAddress"

CHAIN_ID=11155111
```

---

## Installation & Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

4. **Sync Database Schema:**
   Push the schema to your MariaDB instance:
   ```bash
   npx prisma db push
   ```

5. **(Optional) Seed Database:**
   Populate the database with initial sample data / roles:
   ```bash
   npm run seed
   ```

---

## Running the Application

### Development Mode (with hot-reload)
```bash
npm run start:dev
```
The server will start at `http://localhost:3000`.

### Debug Mode
```bash
npm run start:debug
```

### Production Build & Execution
```bash
# 1. Build the TypeScript bundle
npm run build

# 2. Run the compiled production app
npm run start:prod
```

---

## Database Management (Prisma)

- **View & Edit Database via GUI (Prisma Studio):**
  ```bash
  npx prisma studio
  ```
  Opens Prisma Studio in your browser at `http://localhost:5555`.

- **Create a Database Migration:**
  ```bash
  npx prisma migrate dev --name <migration_name>
  ```

- **Format Prisma Schema:**
  ```bash
  npx prisma format
  ```

---

## API Documentation (Swagger)

Once the application is running, the interactive Swagger UI documentation is available at:

👉 **[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

You can test all endpoints, view request schemas, and authenticate using the Bearer JWT token directly from the Swagger UI.

---

## Testing & Quality

```bash
# Run unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:cov

# Run end-to-end (e2e) tests
npm run test:e2e

# Run linter and auto-fix formatting
npm run lint
npm run format
```

---

## Docker Deployment

Build and run the backend container using Docker:

```bash
# Build the Docker image
docker build -t certificate-backend .

# Run the container
docker run -p 3000:3000 \
  --env-file .env \
  certificate-backend
```
