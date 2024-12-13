# Frame Analysis System

## Overview
The Frame Analysis System is a sophisticated video content analysis pipeline that processes video frames using multiple specialized AI agents. Each agent focuses on different aspects of video analysis, from object detection to narrative understanding.

## Video Processing Pipeline

### videoProcessor.ts
The video processor serves as the entry point for video analysis:
- Handles video upload and processing
- Extracts frames at specified intervals
- Coordinates with the frame analysis system
- Manages temporary file cleanup
- Provides progress tracking and status updates

## Frame Analysis Components

### frameAnalyzer.ts
The main orchestrator that:
- Coordinates all analysis agents
- Manages the analysis pipeline
- Handles database transactions
- Combines results from different agents
- Generates unified metadata and tags

### Specialized AI Agents

#### 1. Object Detection Agent (objectDetectionAgent.ts)
- Identifies and locates objects within frames
- Provides bounding boxes and confidence scores
- Specializes in person detection and object classification
- Uses OpenAI's vision model for accurate detection

#### 2. Scene Classification Agent (sceneClassificationAgent.ts)
- Analyzes overall scene composition
- Determines lighting conditions and visual quality
- Identifies scene settings and moods
- Provides confidence scores for classifications

#### 3. Event Detection Agent (eventDetectionAgent.ts)
- Maintains a frame buffer for temporal analysis
- Identifies actions and events across frame sequences
- Tracks object interactions over time
- Generates event descriptions with timestamps

#### 4. Narrative Agent (narrativeAgent.ts)
- Generates human-readable scene descriptions
- Identifies key narrative elements
- Analyzes actions and their significance
- Provides context for detected events

## Data Models and Types

### Types (types.ts)
Contains comprehensive type definitions for:
- Frame analysis results
- Object detection data
- Scene classifications
- Temporal events
- Narrative contexts
- Unified metadata structure

## Database Integration

The system uses a PostgreSQL database to store:
- Frame analysis results
- Generated tags
- Video metadata
- Temporal events
- Scene classifications

### Transaction Management
- Uses Drizzle ORM for database operations
- Implements atomic transactions for data consistency
- Handles batch insertions for performance
- Maintains referential integrity

## Usage Example

```typescript
// Initialize the frame analyzer
const frameAnalyzer = new FrameAnalyzer(openai);

// Process a video frame
const analysis = await frameAnalyzer.analyzeFrame(
  frameBuffer,
  frameNumber,
  timestamp,
  videoId
);

// Access analysis results
const {
  objectDetection,
  sceneClassification,
  events,
  narrative,
  tags,
  metadata
} = analysis;
```

## Error Handling

The system implements robust error handling:
- Validates API responses
- Handles malformed JSON responses
- Provides detailed error logging
- Implements graceful fallbacks

## Performance Considerations

- Batch processing for multiple frames
- Buffer management for temporal analysis
- Efficient database operations
- Resource cleanup after processing
