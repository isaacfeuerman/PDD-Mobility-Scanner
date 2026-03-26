"use client";

import { useCallback } from "react";

interface FileUploadProps {
  onFileLoaded: (filename: string, content: string) => void;
}

export default function FileUpload({ onFileLoaded }: FileUploadProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    },
    [onFileLoaded]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) readFile(file);
    },
    [onFileLoaded]
  );

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onFileLoaded(file.name, text);
    };
    reader.readAsText(file);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center
                 hover:border-blue-500 hover:bg-gray-900/50 transition-colors cursor-pointer"
    >
      <input
        type="file"
        accept=".csv"
        onChange={handleChange}
        className="hidden"
        id="csv-upload"
      />
      <label htmlFor="csv-upload" className="cursor-pointer">
        <div className="text-4xl mb-4">📂</div>
        <p className="text-lg font-medium text-gray-300">
          Drop your <code className="text-blue-400">trail_data.csv</code> here
        </p>
        <p className="text-sm text-gray-500 mt-2">
          or click to browse
        </p>
      </label>
    </div>
  );
}
