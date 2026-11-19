# DoorDelight — Full-Stack Food Delivery Platform

DoorDelight is a production-style, full-stack food delivery platform built with **React + Vite (JSX)**, **Python FastAPI**, **MongoDB**, **WebSockets**, **Google Gemini AI**, **Razorpay Test Mode**, and **Docker Compose**.

---

## Architecture & Tech Stack

- **Frontend (`client/`)**: React 18, Vite, JavaScript (JSX), React Router, Axios, Lucide React icons, custom responsive CSS.
- **Backend (`server/`)**: Python 3.12, FastAPI, Motor (async MongoDB), Pydantic v2, JWT authentication, bcrypt password hashing, FastAPI WebSockets, SlowAPI rate limiting.
- **Database**: MongoDB 7.0 with persistent Docker volume (`mongodb_data`) and indexed collections.
- **AI Integration (`server/app/ai/`)**: Google Gemini API (`google-genai` SDK, default `gemini-2.5-flash`) for Customer Chatbot, AI Food Recommendations, and AI Admin Business Analytics.
- **Payments**: Razorpay Test Mode (HMAC-SHA256 signature & webhook verification) + Cash on Delivery (COD).

---

## Project Structure

```
DoorDelight/
├── client/                 # React + Vite frontend (JSX only)
│   ├── src/
│   │   ├── components/     # Reusable UI components & AIChatWidget
│   │   ├── context/        # AuthContext, CartContext, ToastContext
│   │   ├── hooks/          # useOrderWebSocket
│   │   ├── layouts/        # Role-specific layouts (Customer, Manager, Delivery, Admin)
│   │   ├── pages/          # Role-based pages & dashboards
│   │   ├── services/       # Centralized Axios API client
│   │   ├── styles/         # Responsive CSS design system
│   │   └── utils/          # Formatters & helpers
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.js
├── server/                 # FastAPI backend
│   ├── app/
│   │   ├── ai/             # Google Gemini client & grounded AI services (chatbot, recommendations, analytics)
│   │   ├── config/         # Pydantic settings
│   │   ├── database/       # MongoDB connection & indexes
│   │   ├── middleware/     # JWT auth, RBAC, rate limiting
│   │   ├── models/         # Enums & status transition rules
│   │   ├── routes/         # Modular REST & WebSocket routers
│   │   ├── schemas/        # Pydantic request/response models
│   │   ├── services/       # Business logic & WebSocket manager
│   │   ├── utils/          # Security & serialization helpers
│   │   └── main.py
│   ├── seed_data.py        # Optional sample catalog seeder
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Environment Setup

1. Copy `.env.example` to `.env` and fill in your values:
   - `ADMIN_EMAIL` & `ADMIN_PASSWORD`: Initial Admin account created automatically on startup.
   - `JWT_SECRET`: Strong random secret for signing JWT access tokens.
   - `GEMINI_API_KEY`: Your Google Gemini API key (kept strictly on the backend).
   - `GEMINI_MODEL`: Supported Gemini model name (default `gemini-2.5-flash`).
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: Razorpay Test Mode credentials.

---

## Running with Docker Compose (Recommended)

```bash
docker compose up --build
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **FastAPI OpenAPI Docs**: http://localhost:8000/docs

### Optional: Seed Sample Restaurants & Menu Items

In a new terminal while containers are running:

```bash
docker compose exec server python seed_data.py
```

This creates sample restaurants, dishes, a sample manager (`manager@doordelight.com` / `Manager@123`), and a sample delivery partner (`delivery@doordelight.com` / `Delivery@123`).

---

## Key Security & Business Rules

- **Strict Backend RBAC**: Every endpoint validates JWT and enforces role/ownership (`ADMIN`, `CUSTOMER`, `RESTAURANT_MANAGER`, `DELIVERY_PARTNER`).
- **Authoritative Pricing**: Cart totals, taxes (5% GST), and delivery fees are always calculated on the backend from MongoDB prices.
- **WebSocket Authorization**: `/ws/orders/{order_id}` and `/ws/feed` validate JWT and order ownership before accepting connections.
- **AI Safety**: Google Gemini AI only receives read-only verified MongoDB context and cannot execute queries, alter prices, or modify orders.
