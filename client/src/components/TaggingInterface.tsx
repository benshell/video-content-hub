import { useState } from "react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { Video, Tag } from "@db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, X, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createTag } from "../lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface TaggingInterfaceProps {
  video: Video & { tags: Tag[] };
}

export default function TaggingInterface({ video }: TaggingInterfaceProps) {
  const [newTag, setNewTag] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [categories, setCategories] = useState<string[]>(["general", "score", "foul", "possession", "substitution", "card", "corner", "penalty"]);
  const [newCategory, setNewCategory] = useState("");
  const [isManageOpen, setIsManageOpen] = useState(false);
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
      category: selectedCategory,
      timestamp: Math.floor(videoElement.currentTime),
      confidence: 100,
      aiGenerated: 0
    });
  };

  // Group tags by timestamp and category
  const groupedTags = video.tags.reduce((acc, tag) => {
    const key = tag.timestamp;
    if (!acc[key]) {
      acc[key] = {};
    }
    if (!acc[key][tag.category]) {
      acc[key][tag.category] = [];
    }
    acc[key][tag.category].push(tag);
    return acc;
  }, {} as Record<number, Record<string, Tag[]>>);

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory("");
    }
  };

  return (
    <div className="flex-1 border-b p-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings size={20} />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Event Categories</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Add custom event categories for your video analysis. Examples: goal, assist, tackle, etc.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="New category name..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <Button onClick={handleAddCategory} disabled={!newCategory.trim()}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge 
                    key={category} 
                    variant="secondary"
                    className="flex items-center gap-1 px-3 py-1"
                  >
                    {category}
                    {category !== 'general' && (
                      <X
                        size={14}
                        className="cursor-pointer hover:text-red-500 ml-1"
                        onClick={() => {
                          setCategories(categories.filter(c => c !== category));
                        }}
                      />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
                {Object.entries(tags).map(([category, categoryTags]) => (
                  <div key={category} className="mb-2">
                    <div className="text-sm font-medium text-gray-500 mb-1">
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {categoryTags.map((tag) => (
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
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}
