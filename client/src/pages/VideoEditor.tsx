import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { fetchVideoDetails } from "../lib/api";
import TimelineViewer from "../components/TimelineViewer";
import TaggingInterface from "../components/TaggingInterface";
import ReviewAgent from "../components/ReviewAgent";
import { Video, Tag, Keyframe } from "@db/schema";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

interface VideoDetails extends Video {
  tags: Tag[];
  keyframes: Keyframe[];
}

export default function VideoEditor() {
  const { id } = useParams();
  const { data: video, isLoading } = useQuery<VideoDetails>({
    queryKey: ["video", id],
    queryFn: () => fetchVideoDetails(parseInt(id || "0"))
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!video) {
    return <div>Video not found</div>;
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      <div className="border-b p-4 flex-shrink-0">
        <h1 className="text-2xl font-bold">{video.title}</h1>
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
