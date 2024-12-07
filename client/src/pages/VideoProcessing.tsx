import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Video, Keyframe } from "@db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, FileVideo, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { fetchVideos } from "../lib/api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function VideoProcessing() {
  const { data: videos, isLoading } = useQuery<Video[]>({
    queryKey: ["videos"],
    queryFn: fetchVideos
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
    <div className="container mx-auto p-6">
      <div className="mb-8">
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
                                <div className="text-sm text-gray-500">
                                  <p className="font-medium">Description:</p>
                                  <p>{keyframe.metadata.description}</p>
                                  {keyframe.metadata.objects?.length > 0 && (
                                    <div className="mt-2">
                                      <p className="font-medium">Objects:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {keyframe.metadata.objects.map((obj, i) => (
                                          <Badge key={i} variant="secondary">
                                            {obj}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {keyframe.metadata.actions?.length > 0 && (
                                    <div className="mt-2">
                                      <p className="font-medium">Actions:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {keyframe.metadata.actions.map((action, i) => (
                                          <Badge key={i} variant="secondary">
                                            {action}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!video.keyframes || video.keyframes.length === 0) && (
                        <div className="flex items-center gap-2 text-gray-500">
                          <AlertCircle size={20} />
                          <p>Frame summaries will be generated when processing is complete.</p>
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
