import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import VideoUpload from "../components/VideoUpload";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { fetchVideos } from "../lib/api";
import { Video } from "@db/schema";
import { FileVideo, Plus } from "lucide-react";

export default function Dashboard() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const { data: videos, isLoading } = useQuery<Video[]>({
    queryKey: ["videos"],
    queryFn: fetchVideos
  });

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
            <Link key={video.id} href={`/video/${video.id}`}>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
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
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
