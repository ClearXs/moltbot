# Bid Agent Frontend

A modern Next.js frontend for the Bid Agent platform, built with TypeScript, Tailwind CSS, and Shadcn UI.

## Features

- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Shadcn UI** components
- **Zustand** for state management
- **Real-time communication** with SSE support
- **Dark/Light theme** support
- **Responsive design**

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
src/
├── app/                    # Next.js App Router
├── components/
│   ├── ui/                 # Shadcn UI components
│   ├── chat/               # Chat-related components
│   ├── sidebar/            # Sidebar components
│   ├── agent/              # Agent panel components
│   └── layout/             # Layout components
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
├── stores/                 # Zustand stores
└── types/                  # TypeScript type definitions
```

## Key Components

- **Chat System**: Real-time chat with AI assistant
- **Agent Panel**: Monitor and control AI agent execution
- **Sidebar**: Navigation between chats and agent status
- **Theme System**: Dark/light mode toggle
- **State Management**: Zustand stores for chat, agent, and UI state

## Dependencies

- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Radix UI](https://www.radix-ui.com/) - Headless UI components
- [Lucide React](https://lucide.dev/) - Icon library
- [Zustand](https://github.com/pmndrs/zustand) - State management

## Contributing

1. Follow the existing code style and conventions
2. Add TypeScript types for new components
3. Test your changes thoroughly
4. Update documentation as needed
