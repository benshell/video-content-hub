import { useState, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Video, Keyframe } from "@db/schema";
import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";

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

  return (
    <div className="p-4 border-t bg-gray-50">
      <div className="mb-4">
        <Slider
          value={[currentTime]}
          min={0}
          max={video.duration || 100}
          step={1}
          onValueChange={(value) => handleTimelineClick(value[0])}
          className="w-full"
        />
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
              className="flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
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
              <div className="p-2 text-xs text-center">
                {formatTime(keyframe.timestamp)}
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
