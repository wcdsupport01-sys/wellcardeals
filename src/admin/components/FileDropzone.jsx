import { useRef, useState } from "react";
import { UploadCloud, X, FileText } from "lucide-react";

export default function FileDropzone({ accept, multiple = true, files, onChange, label, light = false }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(fileList) {
    const incoming = Array.from(fileList);
    onChange(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
  }

  function removeAt(idx) {
    onChange(files.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => (e.preventDefault(), setDragOver(true))}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 flex flex-col items-center justify-center gap-2 text-center transition ${
          light
            ? dragOver
              ? "border-[#1E4FD9] bg-[#EAF0FB]"
              : "border-[#D6DFF0] hover:border-[#1E4FD9]/50 bg-[#F5F8FD]"
            : dragOver
            ? "border-amber-500 bg-amber-500/5"
            : "border-white/15 hover:border-white/30"
        }`}
      >
        <UploadCloud size={22} className={light ? "text-[#8593B0]" : "text-zinc-400"} />
        <p className={`text-sm ${light ? "text-[#6B7A9A]" : "text-zinc-400"}`}>
          <span className={`font-medium ${light ? "text-[#1E4FD9]" : "text-amber-400"}`}>{label || "Click to upload"}</span> or drag & drop
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => e.target.files.length && addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
          {files.map((f, i) => (
            <div
              key={i}
              className={`relative group rounded-lg overflow-hidden border aspect-square flex items-center justify-center ${
                light ? "border-[#E1E8F5] bg-[#F5F8FD]" : "border-white/10 bg-zinc-900"
              }`}
            >
              {f.type?.startsWith("image/") ? (
                <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 p-2 text-center">
                  <FileText size={20} className="text-zinc-400" />
                  <span className="text-[10px] text-zinc-500 line-clamp-2">{f.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 bg-black/70 rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
