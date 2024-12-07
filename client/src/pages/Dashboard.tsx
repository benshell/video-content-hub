import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import VideoUpload from "../components/VideoUpload";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchVideos, deleteVideo } from "../lib/api";
import { Video } from "@db/schema";
import { FileVideo, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: videos, isLoading } = useQuery<Video[]>({
    queryKey: ["videos"],
    queryFn: fetchVideos
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast({
        title: "Success",
        description: "Video deleted successfully",
      });
      setVideoToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete video",
        variant: "destructive",
      });
      setVideoToDelete(null);
    },
  });

  const handleDeleteVideo = (id: number) => {
    setVideoToDelete(id);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
          Video Content Hub
        </h1>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={20} />
              Upload Video
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <VideoUpload onSuccess={() => setIsUploadOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-[200px] bg-gray-200" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos?.map((video) => (
            <div key={video.id}>
              <Card className="hover:shadow-lg transition-shadow">
                <Link href={`/video/${video.id}`}>
                  <CardHeader className="p-0">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-[200px] object-cover rounded-t-lg"
                      />
                    ) : (
                      <div className="w-full h-[200px] bg-gray-100 rounded-t-lg flex items-center justify-center">
                        <FileVideo size={48} className="text-gray-400" />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-4">
                    <CardTitle className="text-lg mb-2">{video.title}</CardTitle>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {video.description}
                    </p>
                  </CardContent>
                </Link>
                <div className="px-4 pb-4">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleDeleteVideo(video.id)}
                  >
                    Delete Video
                  </Button>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
      <AlertDialog open={videoToDelete !== null} onOpenChange={() => setVideoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the video and all its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (videoToDelete) {
                  deleteMutation.mutate(videoToDelete);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
