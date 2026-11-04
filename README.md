This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Run the chatbot locally with Ollama

This chatbot uses a local Ollama model, so it does not need an OpenAI API key or a paid API plan.
Install Ollama from [ollama.com/download](https://ollama.com/download), start Ollama, then download
the default model:

```bash
ollama pull llama3.2
```

If Ollama is not already running, start it with `ollama serve`. To use a different model, pull it
with Ollama and set `OLLAMA_MODEL` in your environment to its model name. The API endpoint defaults
to `http://127.0.0.1:11434/v1/`; override it with `OLLAMA_BASE_URL` if your Ollama server uses a
different address.

Nimbot can answer general questions using the selected model's built-in knowledge, and uses the
included FAQ as the source of truth for Nimbus-specific details. It does not browse the web, so
answers may be incomplete or out of date; verify important information.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Google sign-in and MongoDB

Copy `.env.example` to `.env.local` and set:

- `AUTH_SECRET` to a unique random secret (generate one with `npx auth secret`).
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` from a Google OAuth web client.
- `MONGODB_URI` to a MongoDB connection string and optionally `MONGODB_DB` to the database name.

Set the Google OAuth authorized redirect URI to
`http://localhost:3000/api/auth/callback/google` for local development. Add the equivalent
callback URL for each deployed hostname in Google Cloud Console.

The MongoDB Auth.js adapter stores Google-linked users and accounts. Conversations (including
their message lists) are stored in the `conversations` collection, and per-user preferences are
stored in `settings`. The chat and data APIs require an authenticated session and scope records
to the signed-in user. Sessions use Auth.js encrypted JWT cookies; they are not stored in MongoDB.

The `/api/conversations` endpoint returns the signed-in user's 50 most recently updated
conversations, and `/api/settings` supports reading and updating `appearance` (light only),
`compactMode`, `notifications`, and `language` preferences.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
