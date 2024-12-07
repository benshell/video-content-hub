import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Video, Tag } from "@db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createTag } from "../lib/api";

interface TaggingInterfaceProps {
  video: Video & { tags: Tag[] };
}

export default function TaggingInterface({ video }: TaggingInterfaceProps) {
  const [newTag, setNewTag] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createTagMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video", video.id] });
      setNewTag("");
      toast({
        title: "Success",
        description: "Tag added successfully",
      });
    },
  });

  const handleAddTag = async () => {
    if (!newTag.trim()) return;

    const videoElement = document.querySelector('video');
    if (!videoElement) return;

    createTagMutation.mutate({
      videoId: video.id,
      name: newTag.trim(),
      timestamp: Math.floor(videoElement.currentTime),
      confidence: 100,
      aiGenerated: 0
    });
  };

  const groupedTags = video.tags.reduce((acc, tag) => {
    const key = tag.timestamp;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(tag);
    return acc;
  }, {} as Record<number, Tag[]>);

  return (
    <div className="flex-1 border-b p-4">
      <div className="flex items-center gap-2 mb-4">
        <Input
          placeholder="Add new tag..."
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
        />
        <Button
          onClick={handleAddTag}
          disabled={!newTag.trim() || createTagMutation.isLoading}
          size="icon"
        >
          <Plus size={20} />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100%-4rem)]">
        <div className="space-y-4">
          {Object.entries(groupedTags)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([timestamp, tags]) => (
              <div key={timestamp} className="space-y-2">
                <div className="text-sm text-gray-500">
                  {new Date(Number(timestamp) * 1000).toISOString().substr(11, 8)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={tag.aiGenerated ? "secondary" : "default"}
                      className="flex items-center gap-1"
                    >
                      {tag.name}
                      {tag.confidence && (
                        <span className="text-xs opacity-70">
                          ({tag.confidence}%)
                        </span>
                      )}
                      <X
                        size={14}
                        className="ml-1 cursor-pointer hover:text-red-500"
                        onClick={() => {
                          // Handle tag deletion
                        }}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}
