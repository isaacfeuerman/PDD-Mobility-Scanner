"use client";

import { useCallback, useState } from "react";

interface FileUploadProps {
  onFileLoaded: (filename: string, content: string) => void;
  onImagesLoaded: (files: FileList) => void;
  onReady: () => void;
  hasCSV: boolean;
  hasImages: boolean;
  imageCount: number;
}

export default function FileUpload({
  onFileLoaded,
  onImagesLoaded,
  onReady,
  hasCSV,
  hasImages,
  imageCount,
}: FileUploadProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        if (files[i].name.endsWith(".csv")) {
          readCSV(files[i]);
          break;
        }
      }
    },
    [onFileLoaded]
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
        onImagesLoaded(files);
      }
    },
    [onImagesLoaded]
  );

  function readCSV(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
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
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
          hasCSV
            ? "border-green-600/50 bg-green-900/10"
            : "border-gray-700 hover:border-blue-500 hover:bg-gray-900/50"
        }`}
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
            {hasCSV ? "CSV loaded" : <>Drop your <code className="text-blue-400">trail_data.csv</code> here</>}
          </p>
          {!hasCSV && (
            <p className="text-sm text-gray-500 mt-2">or click to browse</p>
          )}
          {hasCSV && (
            <p className="text-sm text-green-400 mt-1">Click to replace</p>
          )}
        </label>
      </div>

      {/* Image Folder Upload */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          hasImages
            ? "border-green-600/50 bg-green-900/10"
            : "border-gray-700 hover:border-purple-500 hover:bg-gray-900/50"
        }`}
      >
        <input
          type="file"
          multiple
          /* @ts-expect-error webkitdirectory is not in React types */
          webkitdirectory=""
          onChange={handleImageChange}
          className="hidden"
          id="image-upload"
        />
        <label htmlFor="image-upload" className="cursor-pointer">
          <p className="text-base font-medium text-gray-300">
            {hasImages
              ? `${imageCount} images loaded`
              : <>Upload image folder <span className="text-gray-500">(optional)</span></>
            }
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {hasImages
              ? "Click to replace"
              : <>Select the folder with <code className="text-purple-400">img_0000</code>, <code className="text-purple-400">img_0001</code>, etc.</>
            }
          </p>
        </label>
      </div>

      {/* Launch button */}
      {hasCSV && (
        <button
          onClick={onReady}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl
                     hover:bg-blue-500 transition-colors text-lg"
        >
          View Dashboard
        </button>
      )}
    </div>
  );
}
