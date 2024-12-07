import { useState, useEffect } from "react";
import { Video, Tag } from "@db/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createTag } from "../lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ReviewAgentProps {
  video: Video & { tags: Tag[] };
}

// Simulated AI suggestions based on existing tags
function generateAISuggestions(tags: Tag[]): Array<{ name: string; confidence: number; timestamp: number }> {
  const existingConcepts = new Set(tags.map(t => t.name.toLowerCase()));
  const suggestions = [
    { name: "Person", confidence: 95 },
    { name: "Indoor", confidence: 88 },
    { name: "Outdoor", confidence: 82 },
    { name: "Speaking", confidence: 90 },
    { name: "Action", confidence: 85 }
  ];

  return suggestions
    .filter(s => !existingConcepts.has(s.name.toLowerCase()))
    .map(s => ({
      ...s,
      timestamp: Math.floor(Math.random() * (video.duration || 100))
    }));
}

export default function ReviewAgent({ video }: ReviewAgentProps) {
  const [suggestions, setSuggestions] = useState<Array<{ name: string; confidence: number; timestamp: number }>>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createTagMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video", video.id] });
      toast({
        title: "Success",
        description: "AI suggestion accepted",
      });
    },
  });

  useEffect(() => {
    // Simulate AI processing
    const aiSuggestions = generateAISuggestions(video.tags);
    setSuggestions(aiSuggestions);
  }, [video.tags]);

  const handleAcceptSuggestion = (suggestion: typeof suggestions[0]) => {
    createTagMutation.mutate({
      videoId: video.id,
      name: suggestion.name,
      timestamp: suggestion.timestamp,
      confidence: suggestion.confidence,
      aiGenerated: 1
    });
    setSuggestions(suggestions.filter(s => s.name !== suggestion.name));
  };

  const handleRejectSuggestion = (suggestion: typeof suggestions[0]) => {
    setSuggestions(suggestions.filter(s => s.name !== suggestion.name));
    toast({
      title: "Suggestion rejected",
      description: `Rejected tag: ${suggestion.name}`,
    });
  };

  return (
    <div className="flex-1 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="text-blue-500" />
        <h3 className="font-semibold">AI Suggestions</h3>
      </div>

      <ScrollArea className="h-[calc(100%-2rem)]">
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="secondary" className="mb-2">
                    {suggestion.confidence}% confidence
                  </Badge>
                  <div className="font-medium">{suggestion.name}</div>
                  <div className="text-sm text-gray-500">
                    at {new Date(suggestion.timestamp * 1000).toISOString().substr(11, 8)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleAcceptSuggestion(suggestion)}
                  >
                    <ThumbsUp size={20} className="text-green-500" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRejectSuggestion(suggestion)}
                  >
                    <ThumbsDown size={20} className="text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {suggestions.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No more suggestions available
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
