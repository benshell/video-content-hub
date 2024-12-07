import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { fetchVideoDetails } from "../lib/api";
import TimelineViewer from "../components/TimelineViewer";
import TaggingInterface from "../components/TaggingInterface";
import ReviewAgent from "../components/ReviewAgent";
import { Video, Tag, Keyframe } from "@db/schema";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useToast } from "@/hooks/use-toast";

interface VideoDetails extends Video {
  tags: Tag[];
  keyframes: Keyframe[];
}

export default function VideoEditor() {
  const { id } = useParams();
  const { toast } = useToast();
  const { data: video, isLoading, error } = useQuery<VideoDetails>({
    queryKey: ["video", id],
    queryFn: () => {
      if (!id || isNaN(parseInt(id))) {
        throw new Error("Invalid video ID");
      }
      return fetchVideoDetails(parseInt(id));
    },
    retry: false
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-500">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <X size={48} className="mx-auto" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Video Not Found</h2>
          <p className="text-gray-500 mb-4">
            The video you're looking for could not be found or may have been removed.
          </p>
          <Button asChild>
            <Link href="/">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      <div className="border-b p-4 flex-shrink-0 flex justify-between items-center">
        <h1 className="text-2xl font-bold">{video.title}</h1>
        <Button
          onClick={() => {
            const exportData = {
              videoId: video.id,
              title: video.title,
              description: video.description,
              duration: video.duration,
              tags: video.tags.map(tag => ({
                name: tag.name,
                category: tag.category,
                timestamp: tag.timestamp,
                confidence: tag.confidence,
                aiGenerated: tag.aiGenerated
              })),
              keyframes: video.keyframes.map(keyframe => ({
                timestamp: keyframe.timestamp,
                thumbnailUrl: keyframe.thumbnailUrl,
                metadata: keyframe.metadata
              }))
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${video.title.replace(/\s+/g, '_')}_export.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            toast({
              title: "Export Successful",
              description: "Video data has been exported successfully",
            });
          }}
          className="flex items-center gap-2"
        >
          <Download size={20} />
          Export Data
        </Button>
      </div>
      
      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        <ResizablePanel defaultSize={70}>
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 p-4 overflow-hidden">
              <div className="relative w-full h-full">
                <video
                  src={video.url}
                  controls
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                />
              </div>
            </div>
            <TimelineViewer video={video} />
          </div>
        </ResizablePanel>
        
        <ResizableHandle />
        
        <ResizablePanel defaultSize={30}>
          <div className="h-full flex flex-col">
            <TaggingInterface video={video} />
            <ReviewAgent video={video} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
