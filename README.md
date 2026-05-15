# UniAI

A demo project with a React + Vite frontend and an Azure Functions backend.

The frontend is a decision-support prototype that uses Google Generative AI (`@google/generative-ai`) with a Gemini model fallback. When no API key is provided, it runs a local rule-based demo mode.

The backend is a simple Azure Functions HTTP trigger.

## Features

- React + Vite app with AI-powered text analysis
- Demo and manual input modes
- Gemini AI integration via `VITE_GEMINI_API_KEY`
- Azure Functions backend with a simple HTTP trigger
- Tailwind-style styling and markdown output

## Repository Structure

- `frontend/` — React application using Vite
- `azure/` — Azure Functions backend

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm installed
- (Optional) Azure Functions Core Tools if you want to run the backend locally
- Google Gemini API key if you want AI mode instead of demo mode

### Install dependencies

```powershell
cd frontend
npm.cmd install

cd ..\azure
npm.cmd install
```

### Configure environment

Create `frontend/.env` with:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

If you do not provide a Gemini API key, the app will use rule-based demo mode automatically.

## Run the Frontend

```powershell
cd frontend
npm.cmd run dev
```

This starts the Vite development server. Open the printed URL in your browser, for example:

```text
http://localhost:5173
```

> If VS Code opens the app in a preview tab, copy the URL and paste it into Google Chrome or another browser.

## Run the Backend

```powershell
cd azure
npm.cmd run start
```

If needed, build first:

```powershell
cd azure
npm.cmd run build
npm.cmd run start
```

## Notes

- Use `npm.cmd` on Windows PowerShell if `npm` script execution is blocked.
- The frontend uses `@google/generative-ai` and `react-markdown` to display analysis results.
- The backend currently exposes a simple HTTP endpoint for demos and can be expanded later.

## License

This repository does not currently include a license file.
