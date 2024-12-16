
import { useState, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Video, Keyframe } from "@db/schema";
import { Card } from "@/components/ui/card";
import { Clock, Tag } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";

interface TimelineViewerProps {
  video: Video & { keyframes: Keyframe[] };
}

export default function TimelineViewer({ video }: TimelineViewerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const video = document.querySelector('video');
    if (video) {
      videoRef.current = video;
      video.addEventListener('timeupdate', () => {
        setCurrentTime(video.currentTime);
      });
    }
  }, []);

  const handleTimelineClick = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const renderMetadataBadges = (metadata: any) => {
    const badges = [];
    
    if (metadata?.actions?.primary) {
      badges.push(
        <Badge key="action" variant="secondary" className="mr-1">
          {metadata.actions.primary}
        </Badge>
      );
    }

    if (metadata?.objects?.people?.length) {
      badges.push(
        <Badge key="people" variant="outline" className="mr-1">
          {metadata.objects.people.length} People
        </Badge>
      );
    }

    if (metadata?.technical?.lighting) {
      badges.push(
        <Badge key="lighting" variant="secondary" className="mr-1">
          {metadata.technical.lighting}
        </Badge>
      );
    }

    return badges;
  };

  const timelineMarkers = video.keyframes
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((keyframe) => ({
      timestamp: keyframe.timestamp,
      summary: keyframe.metadata?.semanticDescription?.summary || '',
      metadata: keyframe.metadata
    }));

  return (
    <div className="p-4 border-t bg-gray-50">
      <div className="mb-4 relative">
        <Slider
          value={[currentTime]}
          min={0}
          max={video.duration || 100}
          step={1}
          onValueChange={(value) => handleTimelineClick(value[0])}
          className="w-full"
        />
        
        <div className="absolute top-0 left-0 right-0 h-full pointer-events-none">
          {timelineMarkers.map((marker) => (
            <HoverCard key={marker.timestamp}>
              <HoverCardTrigger asChild>
                <div
                  className="absolute w-1 h-4 bg-blue-500 cursor-pointer pointer-events-auto"
                  style={{
                    left: `${(marker.timestamp / (video.duration || 100)) * 100}%`,
                    transform: 'translateX(-50%)'
                  }}
                  onClick={() => handleTimelineClick(marker.timestamp)}
                />
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <p className="text-sm font-medium">{formatTime(marker.timestamp)}</p>
                  <p className="text-sm">{marker.summary}</p>
                  <div className="flex flex-wrap gap-1">
                    {marker.metadata && renderMetadataBadges(marker.metadata)}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          ))}
        </div>

        <div className="flex justify-between text-sm text-gray-500 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(video.duration || 0)}</span>
        </div>
      </div>

      <ScrollArea className="h-32">
        <div className="flex gap-4 p-2">
          {video.keyframes.sort((a, b) => a.timestamp - b.timestamp).map((keyframe) => (
            <Card
              key={keyframe.id}
              className="flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all relative group"
              onClick={() => handleTimelineClick(keyframe.timestamp)}
            >
              {keyframe.thumbnailUrl ? (
                <img
                  src={keyframe.thumbnailUrl}
                  alt={`Keyframe at ${formatTime(keyframe.timestamp)}`}
                  className="w-32 h-24 object-cover rounded-t-lg"
                />
              ) : (
                <div className="w-32 h-24 bg-gray-200 flex items-center justify-center rounded-t-lg">
                  <Clock className="text-gray-400" />
                </div>
              )}
              <div className="p-2 text-xs">
                <div className="text-center">{formatTime(keyframe.timestamp)}</div>
                {keyframe.metadata?.semanticDescription?.keyElements && (
                  <div className="absolute inset-0 bg-black/75 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs overflow-y-auto">
                    {keyframe.metadata.semanticDescription.keyElements.join(', ')}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
