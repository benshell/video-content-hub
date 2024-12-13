# Frame Analysis System

## System Architecture Overview
The Frame Analysis System implements a sophisticated multi-agent architecture for video content analysis. Each component is designed to work independently while maintaining coordinated data flow through the system.

## Component Architecture

### 1. Video Processor (videoProcessor.ts)
Entry point for video processing pipeline:
```typescript
class VideoProcessor {
  constructor(openai: OpenAI, frameAnalyzer: FrameAnalyzer) {
    this.openai = openai;
    this.frameAnalyzer = frameAnalyzer;
  }
}
```
Key responsibilities:
- Frame extraction using FFmpeg
- Frame buffering and batch processing
- Progress tracking and error handling
- Temporary file management
- Analysis coordination

### 2. Frame Analyzer (frameAnalyzer.ts)
Central orchestrator implementing the Mediator pattern:
```typescript
class FrameAnalyzer {
  constructor(openai: OpenAI) {
    this.objectDetectionAgent = new ObjectDetectionAgent(openai);
    this.sceneClassificationAgent = new SceneClassificationAgent(openai);
    this.eventDetectionAgent = new EventDetectionAgent(openai);
    this.narrativeAgent = new NarrativeAgent(openai);
  }
}
```
Responsibilities:
- Agent lifecycle management
- Analysis pipeline orchestration
- Result aggregation and normalization
- Database transaction management
- Error handling and recovery

## Specialized AI Agents

### 1. Object Detection Agent (objectDetectionAgent.ts)
```typescript
class ObjectDetectionAgent {
  async analyze(frameBase64: string, frameNumber: number, timestamp: number): Promise<ObjectDetectionResult>
```
Technical specifications:
- Uses OpenAI's GPT-4 Vision model for object detection
- Implements bounding box calculation
- Confidence score normalization (0-1 range)
- Object classification with hierarchical categories
- Real-time detection optimization

Data flow:
1. Input: Base64 encoded frame image
2. Processing: OpenAI API interaction
3. Output: Structured object detection results
4. Integration: Results feed into Scene Classification

### 2. Scene Classification Agent (sceneClassificationAgent.ts)
```typescript
class SceneClassificationAgent {
  async analyze(
    frameBase64: string,
    frameNumber: number,
    timestamp: number,
    objectDetection: ObjectDetectionResult
  ): Promise<SceneClassification>
```
Technical details:
- Scene attribute extraction
- Lighting condition analysis
- Composition assessment
- Mood detection algorithm
- Visual quality evaluation

Dependencies:
- Requires object detection results
- Integrates with narrative generation
- Feeds into event detection

### 3. Event Detection Agent (eventDetectionAgent.ts)
```typescript
class EventDetectionAgent {
  private frameBuffer: Array<{
    frameNumber: number;
    timestamp: number;
    objectDetection: ObjectDetectionResult;
    sceneClassification: SceneClassification;
  }>;

  async detectEvents(): Promise<TemporalEvent[]>
```
Implementation details:
- Circular buffer implementation for frame history
- Temporal pattern recognition
- Event confidence calculation
- Object interaction tracking
- Event duration estimation

Buffer management:
- 30-frame buffer (1 second at 30fps)
- FIFO implementation
- Memory-efficient storage
- Automatic cleanup

### 4. Narrative Agent (narrativeAgent.ts)
```typescript
class NarrativeAgent {
  async analyze(
    frameBase64: string,
    frameNumber: number,
    timestamp: number,
    objectDetection: ObjectDetectionResult,
    sceneClassification: SceneClassification,
    events: TemporalEvent[]
  ): Promise<NarrativeContext>
```
Advanced features:
- Context-aware summarization
- Key element extraction
- Action hierarchy analysis
- Semantic relationship mapping
- Natural language generation

## Data Flow and Integration

### Analysis Pipeline Sequence
1. Video frame extraction (VideoProcessor)
2. Object detection analysis
3. Scene classification with object context
4. Event detection using temporal buffer
5. Narrative generation with full context
6. Result aggregation and storage

### Inter-Agent Communication
```typescript
interface AnalysisContext {
  frameBuffer: Buffer;
  frameNumber: number;
  timestamp: number;
  objectDetection?: ObjectDetectionResult;
  sceneClassification?: SceneClassification;
  events?: TemporalEvent[];
}
```

### Database Integration
Transaction flow:
```typescript
await db.transaction(async (tx) => {
  const [keyframe] = await tx.insert(keyframes).values({...}).returning();
  const insertedTags = await tx.insert(tags).values([...]).returning();
  return { keyframe, tags: insertedTags };
});
```

## Performance Optimizations

### Batch Processing
- Frame batching (5 frames per batch)
- Parallel agent execution
- Efficient memory management
- Resource pooling

### Error Recovery
- Automatic retry mechanism
- Graceful degradation
- Partial result handling
- Transaction rollback support

## Usage Examples

### Basic Frame Analysis
```typescript
const analyzer = new FrameAnalyzer(openai);
const result = await analyzer.analyzeFrame(frameBuffer, frameNumber, timestamp, videoId);
```

### Batch Processing
```typescript
const results = await analyzer.analyzeBatch(frames, videoId);
```

### Event Detection
```typescript
const events = await eventDetectionAgent.detectEvents();
```

## API Response Handling

### OpenAI Vision API Integration
```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o-2024-08-06",
  messages: [
    {
      role: "system",
      content: "Analysis prompt"
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Analysis request" },
        { type: "image_url", image_url: { url: base64Image } }
      ]
    }
  ],
  response_format: { type: "json_object" }
});
```

## Error Handling and Validation

### Response Validation
```typescript
const isValidEvent = (event: any): event is TemporalEvent => 
  typeof event.startFrame === 'number' &&
  typeof event.endFrame === 'number' &&
  typeof event.startTime === 'number' &&
  typeof event.endTime === 'number' &&
  typeof event.eventType === 'string' &&
  typeof event.confidence === 'number' &&
  typeof event.description === 'string' &&
  Array.isArray(event.involvedObjects);
```
