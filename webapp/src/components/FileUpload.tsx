"use client";

import { useCallback, useState } from "react";

interface FileUploadProps {
  onFileLoaded: (filename: string, content: string) => void;
  onImagesLoaded: (files: FileList) => void;
}

export default function FileUpload({ onFileLoaded, onImagesLoaded }: FileUploadProps) {
  const [csvName, setCsvName] = useState<string | null>(null);
  const [imageCount, setImageCount] = useState<number>(0);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      processFiles(files);
    },
    [onFileLoaded, onImagesLoaded]
  );

  const handleCSVChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) readCSV(file);
    },
    [onFileLoaded]
  );

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        setImageCount(files.length);
        onImagesLoaded(files);
      }
    },
    [onImagesLoaded]
  );

  function processFiles(files: FileList) {
    // Separate CSV from images
    const imageFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith(".csv")) {
        readCSV(file);
      } else if (file.type.startsWith("image/")) {
        imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      // Create a synthetic FileList-like structure via DataTransfer
      const dt = new DataTransfer();
      imageFiles.forEach((f) => dt.items.add(f));
      setImageCount(imageFiles.length);
      onImagesLoaded(dt.files);
    }
  }

  function readCSV(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvName(file.name);
      onFileLoaded(file.name, text);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      {/* CSV Upload */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center
                   hover:border-blue-500 hover:bg-gray-900/50 transition-colors cursor-pointer"
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleCSVChange}
          className="hidden"
          id="csv-upload"
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <p className="text-lg font-medium text-gray-300">
            Drop your <code className="text-blue-400">trail_data.csv</code> here
          </p>
          <p className="text-sm text-gray-500 mt-2">
            or click to browse
          </p>
          {csvName && (
            <p className="text-sm text-green-400 mt-2">
              Loaded: {csvName}
            </p>
          )}
        </label>
      </div>

      {/* Image Folder Upload */}
      <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center
                      hover:border-purple-500 hover:bg-gray-900/50 transition-colors cursor-pointer">
        <input
          type="file"
          accept="image/*"
          multiple
          /* @ts-expect-error webkitdirectory is not in React types */
          webkitdirectory=""
          onChange={handleImageChange}
          className="hidden"
          id="image-upload"
        />
        <label htmlFor="image-upload" className="cursor-pointer">
          <p className="text-base font-medium text-gray-300">
            Upload image folder <span className="text-gray-500">(optional)</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Select the folder containing <code className="text-purple-400">img_0000.jpg</code>, <code className="text-purple-400">img_0001.jpg</code>, etc.
          </p>
          {imageCount > 0 && (
            <p className="text-sm text-green-400 mt-2">
              {imageCount} images loaded
            </p>
          )}
        </label>
      </div>
    </div>
  );
}
