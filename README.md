# Video Content Hub

A comprehensive video content management platform that enables video upload, processing, and timeline-based viewing. The system features AI-powered tagging capabilities for automated content classification and review workflows.

## Key Features

- Video upload and processing pipeline
- AI-powered content tagging and classification
- Timeline-based video management interface
- Review workflow system
- Export capabilities for tagged videos

## Project Structure

```
├── client/                  # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── ui/        # Shadcn UI components
│   │   │   └── ...        # Custom components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions and API clients
│   │   ├── pages/         # Page components
│   │   └── main.tsx       # Application entry point
│   └── index.html         # HTML template
├── db/                     # Database configuration
│   ├── schema.ts          # Drizzle ORM schema definitions
│   └── index.ts           # Database connection setup
├── server/                 # Backend Express server
│   ├── services/          # Business logic services
│   │   └── videoProcessor.ts  # Video processing service
│   ├── utils/             # Utility functions
│   │   └── cleanup.ts     # File cleanup utilities
│   ├── routes.ts          # API route definitions
│   └── index.ts           # Server entry point
└── uploads/               # Upload directories
    ├── videos/            # Stored video files
    ├── frames/            # Extracted video frames
    └── thumbnails/        # Generated thumbnails
```

## Dependencies

### Frontend Dependencies
- **React**: Core frontend framework
- **Wouter**: Lightweight routing solution
- **@tanstack/react-query**: Data fetching and state management
- **Shadcn UI**: Component library based on Radix UI
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Dropzone**: File upload handling

### Backend Dependencies
- **Express**: Web server framework
- **Multer**: File upload middleware
- **Sharp**: Image processing
- **FFmpeg**: Video processing
- **OpenAI**: AI-powered video analysis
- **Drizzle ORM**: Database ORM
- **PostgreSQL**: Database
- **CORS**: Cross-origin resource sharing

### Development Dependencies
- **TypeScript**: Type safety
- **Vite**: Build tool and development server
- **Tailwind CSS**: CSS framework
- **Drizzle Kit**: Database migration tools

## Setup and Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `OPENAI_API_KEY`: OpenAI API key
   - Additional database configuration variables

4. Start the development server:
   ```bash
   npm run dev
   ```

## Features

### Video Management
- Upload videos (supports MP4, MOV, AVI, WebM)
- Automatic video processing and frame extraction
- Timeline-based video viewing
- Video deletion with cleanup

### Content Analysis
- AI-powered frame analysis
- Automatic content tagging
- Custom event categories
- Confidence scoring

### Data Export
- Export video metadata
- Export frame analysis
- Export tagged events
- JSON format support

## Environment Variables

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key for content analysis
- `PGUSER`: PostgreSQL username
- `PGPASSWORD`: PostgreSQL password
- `PGHOST`: PostgreSQL host
- `PGPORT`: PostgreSQL port
- `PGDATABASE`: PostgreSQL database name
