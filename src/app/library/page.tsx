'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderOpen,
  UploadCloud,
  Trash2,
  Image,
  Video,
  FileText,
  Search,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { MediaAsset } from '@/types';

export default function LibraryPage() {
  const router = useRouter();
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/media');
      if (res.ok) {
        const data = await res.json();
        setMedia(data.media || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const file = files[0];
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await fetchMedia();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this media asset?')) return;
    try {
      const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMedia((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredMedia = media.filter((m) =>
    m.file_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-500" />
            Content Library & Media
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Store and organize high-resolution images, videos, carousel PDFs, and brand collateral.
          </p>
        </div>

        {/* Upload Action */}
        <label className="cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all self-start">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          <span>Upload Asset</span>
          <input
            type="file"
            accept="image/*,video/*,application/pdf"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search media files by name..."
          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200"
        />
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-12 flex justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
            No media assets found in library. Upload images, PDFs, or videos to reuse in posts.
          </div>
        ) : (
          filteredMedia.map((asset) => {
            const isImg = asset.mime_type.startsWith('image/');
            const isVid = asset.mime_type.startsWith('video/');

            return (
              <div
                key={asset.id}
                className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden shadow-sm flex flex-col justify-between"
              >
                {/* Thumbnail */}
                <div className="h-36 bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden relative">
                  {isImg && asset.url ? (
                    <img
                      src={asset.url}
                      alt={asset.file_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : isVid ? (
                    <Video className="w-10 h-10 text-purple-400" />
                  ) : (
                    <FileText className="w-10 h-10 text-emerald-400" />
                  )}

                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Asset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Info & Use in Composer */}
                <div className="p-3 text-xs space-y-2">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={asset.file_name}>
                    {asset.file_name}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{(asset.file_size / 1024 / 1024).toFixed(2)} MB</span>
                    <span>{new Date(asset.created_at).toLocaleDateString()}</span>
                  </div>

                  <button
                    onClick={() => router.push(`/composer`)}
                    className="w-full mt-1 flex items-center justify-center gap-1 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-semibold text-blue-600 dark:text-blue-400 transition-colors"
                  >
                    Use in Post <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

