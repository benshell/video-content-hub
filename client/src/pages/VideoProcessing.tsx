import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { Video, Tag } from "@db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, FileVideo, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { fetchVideos } from "../lib/api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FrameMetadata = {
  semanticDescription: {
    summary: string;
    keyElements: string[];
    mood: string;
    composition: string;
  };
  objects: {
    people: string[];
    items: string[];
    environment: string[];
  };
  actions: {
    primary: string;
    secondary: string[];
    movements: string[];
  };
  technical: {
    lighting: string;
    cameraAngle: string;
    visualQuality: string;
  };
}

interface ProcessedKeyframe {
  id: number;
  timestamp: number;
  thumbnailUrl?: string;
  metadata?: FrameMetadata;
}

interface VideoWithKeyframes extends Video {
  keyframes: ProcessedKeyframe[];
  tags: Tag[];
}

type VideoProcessingStatus = {
  data?: VideoWithKeyframes[];
  isLoading: boolean;
  error: unknown;
};

export default function VideoProcessing() {
  const { data: videos, isLoading } = useQuery({
    queryKey: ["videos"] as const,
    queryFn: fetchVideos,
    refetchInterval: 5000 // Refetch every 5 seconds to update processing status
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-500">Loading videos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 h-screen overflow-y-auto">
      <div className="mb-8 sticky top-0 bg-background z-10 pb-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-2">
          Video Processing
        </h1>
        <p className="text-gray-500">
          View and manage AI-generated summaries for your video frames.
        </p>
      </div>

      <div className="grid gap-6">
        {videos?.map((video) => (
          <Card key={video.id} className="w-full">
            <CardHeader className="flex flex-row items-center gap-4">
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-32 h-24 object-cover rounded-lg"
                />
              ) : (
                <div className="w-32 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FileVideo size={32} className="text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <CardTitle className="text-xl mb-2">{video.title}</CardTitle>
                <p className="text-sm text-gray-500 line-clamp-2">
                  {video.description}
                </p>
              </div>
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/video/${video.id}`}>
                  <Play size={20} />
                  View Analysis
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="frames">
                  <AccordionTrigger>Frame Summaries</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      {video.keyframes?.map((keyframe) => (
                        <div key={keyframe.id} className="border rounded-lg p-4">
                          <div className="flex items-center gap-4 mb-2">
                            {keyframe.thumbnailUrl && (
                              <img
                                src={keyframe.thumbnailUrl}
                                alt={`Frame at ${keyframe.timestamp}s`}
                                className="w-24 h-24 object-cover rounded-lg"
                              />
                            )}
                            <div>
                              <p className="font-medium">
                                Timestamp: {new Date(keyframe.timestamp * 1000).toISOString().substr(11, 8)}
                              </p>
                              {keyframe.metadata && (
                                <div className="text-sm space-y-4">
                                  <div className="bg-gray-50 p-4 rounded-lg">
                                    <h4 className="font-semibold text-base mb-2">Semantic Analysis</h4>
                                    <p className="text-gray-700">{keyframe.metadata?.semanticDescription?.summary}</p>
                                    {keyframe.metadata?.semanticDescription?.keyElements?.length > 0 && (
                                      <div className="mt-2">
                                        <p className="font-medium text-gray-600">Key Elements</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {keyframe.metadata?.semanticDescription?.keyElements?.map((element: string, i: number) => (
                                            <Badge key={i} variant="outline">{element}</Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                      <div>
                                        <p className="font-medium text-gray-600">Mood</p>
                                        <p className="text-gray-700">{keyframe.metadata.semanticDescription?.mood}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-600">Composition</p>
                                        <p className="text-gray-700">{keyframe.metadata?.semanticDescription?.composition}</p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                      <h4 className="font-semibold text-base mb-2">Objects</h4>
                                      {keyframe.metadata?.objects?.people?.length > 0 && (
                                        <div className="mb-3">
                                          <p className="font-medium text-gray-600">People</p>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {keyframe.metadata.objects.people.map((person: string, i: number) => (
                                              <Badge key={i} variant="secondary">{person}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {keyframe.metadata?.objects?.items?.length > 0 && (
                                        <div className="mb-3">
                                          <p className="font-medium text-gray-600">Items</p>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {keyframe.metadata.objects.items.map((item: string, i: number) => (
                                              <Badge key={i} variant="secondary">{item}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {keyframe.metadata?.objects?.environment?.length > 0 && (
                                        <div>
                                          <p className="font-medium text-gray-600">Environment</p>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {keyframe.metadata.objects.environment.map((env: string, i: number) => (
                                              <Badge key={i} variant="secondary">{env}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded-lg">
                                      <h4 className="font-semibold text-base mb-2">Actions</h4>
                                      <div className="mb-3">
                                        <p className="font-medium text-gray-600">Primary Action</p>
                                        <p className="text-gray-700">{keyframe.metadata?.actions?.primary}</p>
                                      </div>
                                      {keyframe.metadata?.actions?.secondary?.length > 0 && (
                                        <div className="mb-3">
                                          <p className="font-medium text-gray-600">Secondary Actions</p>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {keyframe.metadata?.actions?.secondary?.map((action: string, i: number) => (
                                              <Badge key={i}>{action}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {keyframe.metadata?.actions?.movements?.length > 0 && (
                                        <div>
                                          <p className="font-medium text-gray-600">Movements</p>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {keyframe.metadata?.actions?.movements?.map((movement: string, i: number) => (
                                              <Badge key={i}>{movement}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="bg-gray-50 p-4 rounded-lg">
                                    <h4 className="font-semibold text-base mb-2">Technical Details</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                      <div>
                                        <p className="font-medium text-gray-600">Lighting</p>
                                        <p className="text-gray-700">{keyframe.metadata?.technical?.lighting}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-600">Camera Angle</p>
                                        <p className="text-gray-700">{keyframe.metadata?.technical?.cameraAngle}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-600">Visual Quality</p>
                                        <p className="text-gray-700">{keyframe.metadata?.technical?.visualQuality}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!video.keyframes || video.keyframes.length === 0) && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-gray-500">
                            <AlertCircle size={20} />
                            <p>
                              {video.processingStatus === 'processing' 
                                ? 'Processing video frames...' 
                                : 'Frame summaries will be generated when processing starts.'}
                            </p>
                          </div>
                          {video.processingStatus === 'processing' && video.totalFrames !== null && video.totalFrames > 0 && video.processedFrames !== null && (
                            <div className="space-y-2">
                              <Progress 
                                value={(video.processedFrames / video.totalFrames) * 100}
                                className="w-full"
                              />
                              <p className="text-sm text-gray-500 text-center">
                                Processed {video.processedFrames} of {video.totalFrames} frames
                              </p>
                              <p className="text-xs text-gray-400 text-center">
                                This process may take several minutes depending on the video length
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        ))}

        {!videos?.length && (
          <div className="text-center py-12">
            <FileVideo size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Videos Found</h3>
            <p className="text-gray-500 mb-4">
              Upload a video to start generating AI summaries.
            </p>
            <Button asChild>
              <Link href="/">Upload Video</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
