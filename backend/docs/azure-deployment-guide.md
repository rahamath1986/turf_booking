# Azure App Service & Container Deployment Guide

This guide walks you through deploying the **Turf Booking Backend** to Microsoft Azure using either **Azure App Service (Web App for Containers)** or **Azure Container Apps**, backed by your live **Azure Database for PostgreSQL Flexible Server** (`sansamg-turf-pg`).

---

## 1. Prerequisites Checklist

- [x] **PostgreSQL Database**: `sansamg-turf-pg.postgres.database.azure.com` (Migrations & Seed applied)
- [x] **Container Definition**: Production multi-stage [`backend/Dockerfile`](file:///Users/rahamathalikhan/Documents/turf_booking/backend/Dockerfile) (built & verified)
- [ ] **Azure Resource Group**: `rg-sansamg-platform` (or your existing group)
- [ ] **Azure Container Registry (ACR)** or **Docker Hub**: to store container images

---

## 2. Option A: Azure App Service (Web App for Containers)

### Step 1: Create Azure Container Registry (ACR)
In Azure Portal or via Azure CLI / Cloud Shell:
```bash
# 1. Create ACR (Basic SKU)
az acr create \
  --resource-group rg-sansamg-platform \
  --name sansamgturfacr \
  --sku Basic \
  --admin-enabled true
```

### Step 2: Build & Push Image to ACR
From your local terminal:
```bash
# Log in to ACR
az acr login --name sansamgturfacr

# Tag and push the verified Docker image
docker tag turf-backend:test sansamgturfacr.azurecr.io/turf-backend:latest
docker push sansamgturfacr.azurecr.io/turf-backend:latest
```
*(Or use ACR Cloud Build without Docker locally)*:
```bash
cd backend
az acr build --registry sansamgturfacr --image turf-backend:latest .
```

### Step 3: Create App Service Plan & Web App
```bash
# Create Linux App Service Plan (B1 basic or Free F1)
az appservice plan create \
  --name plan-sansamg-turf \
  --resource-group rg-sansamg-platform \
  --is-linux \
  --sku B1

# Create Web App for Containers
az webapp create \
  --resource-group rg-sansamg-platform \
  --plan plan-sansamg-turf \
  --name app-sansamg-turf-api \
  --deployment-container-image-name sansamgturfacr.azurecr.io/turf-backend:latest
```

### Step 4: Configure App Settings & Environment Variables
In **Azure Portal** $\rightarrow$ **app-sansamg-turf-api** $\rightarrow$ **Settings** $\rightarrow$ **Environment variables**:

| Key | Value | Description |
| :--- | :--- | :--- |
| `WEBSITES_PORT` | `4000` | Tells Azure which port the container listens on |
| `PORT` | `4000` | NestJS port |
| `NODE_ENV` | `production` | Production mode |
| `DATABASE_URL` | `postgresql://turfadmin:Psyec9120%23@sansamg-turf-pg.postgres.database.azure.com:5432/turf_booking_db?sslmode=require` | Azure PostgreSQL connection |
| `JWT_ACCESS_SECRET` | *(64-char random string)* | Production JWT secret |
| `JWT_REFRESH_SECRET` | *(64-char random string)* | Production refresh secret |
| `CHECKIN_QR_SECRET` | *(64-char random string)* | Check-in HMAC secret |
| `CORS_ORIGINS` | `https://your-frontend-domain.com,http://localhost:3000` | Allowed origins |
| `REDIS_HOST` | *(Azure Redis host or localhost)* | Slot hold & cache host |
| `REDIS_PORT` | `6379` | Redis port |

---

## 3. Option B: Azure Container Apps (Serverless & Free Tier)

Azure Container Apps has a generous monthly free tier (180,000 vCPU-seconds and 360,000 GiB-seconds free every month):

```bash
# 1. Create Container Apps Environment
az containerapp env create \
  --name env-sansamg-turf \
  --resource-group rg-sansamg-platform \
  --location eastus

# 2. Deploy Container App
az containerapp create \
  --name turf-backend-api \
  --resource-group rg-sansamg-platform \
  --environment env-sansamg-turf \
  --image sansamgturfacr.azurecr.io/turf-backend:latest \
  --target-port 4000 \
  --ingress external \
  --registry-server sansamgturfacr.azurecr.io \
  --env-vars \
    NODE_ENV=production \
    PORT=4000 \
    DATABASE_URL="postgresql://turfadmin:Psyec9120%23@sansamg-turf-pg.postgres.database.azure.com:5432/turf_booking_db?sslmode=require" \
    JWT_ACCESS_SECRET="secret" \
    JWT_REFRESH_SECRET="secret" \
    CHECKIN_QR_SECRET="secret"
```

---

## 4. Azure Portal GUI Deployment (Step-by-Step)

If you prefer using the **Azure Portal web interface**:
1. Click **+ Create a resource** $\rightarrow$ Search for **Web App**.
2. **Basics**:
   - **Resource Group**: `rg-sansamg-platform`
   - **Name**: `app-sansamg-turf-api` (or your preferred name)
   - **Publish**: Select **Container**
   - **Operating System**: **Linux**
   - **Pricing Plan**: Free F1 or Basic B1
3. **Container**:
   - Select **Azure Container Registry** (or Docker Hub)
   - Select your image `turf-backend:latest`
4. Click **Review + Create**.
5. Once provisioned, open **Configuration / Environment variables** and add `WEBSITES_PORT=4000` and `DATABASE_URL`.
