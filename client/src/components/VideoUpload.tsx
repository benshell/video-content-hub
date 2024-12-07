import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadVideo } from "../lib/api";

interface VideoUploadProps {
  onSuccess?: () => void;
}

export default function VideoUpload({ onSuccess }: VideoUploadProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: uploadVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast({
        title: "Success",
        description: "Video uploaded successfully",
      });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload video",
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title);
    formData.append("description", description);

    uploadMutation.mutate({
      formData,
      onProgress: (progress) => setProgress(progress),
    });
  }, [title, description]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.webm']
    },
    multiple: false
  });

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Upload Video</h2>
      
      <div className="space-y-4">
        <Input
          placeholder="Video Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        
        <Textarea
          placeholder="Video Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors
            ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-4 text-gray-400" size={48} />
          {isDragActive ? (
            <p>Drop the video here...</p>
          ) : (
            <p>Drag and drop a video, or click to select</p>
          )}
        </div>

        {uploadMutation.isLoading && (
          <Progress value={progress} className="w-full" />
        )}

        <Button
          disabled={!title || uploadMutation.isLoading}
          onClick={() => document.querySelector('input[type="file"]')?.click()}
          className="w-full"
        >
          {uploadMutation.isLoading ? "Uploading..." : "Upload Video"}
        </Button>
      </div>
    </div>
  );
}
