'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  FolderOpen,
  UploadCloud,
  Trash2,
  Image as ImageIcon,
  Video,
  FileText,
  Search,
  ArrowRight,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { MediaAsset } from '@/types';

export default function LibraryPage() {
  const router = useRouter();
  const toast = useToast();

  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/media');
      if (res.ok) {
        const data = await res.json();
        setMedia(data.media || []);
      }
    } catch (e: any) {
      toast.error('Failed to load media: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

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

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      toast.success(`Uploaded ${file.name}`);
      await fetchMedia();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteAssetId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${deleteAssetId}`, { method: 'DELETE' });
      if (res.ok) {
        setMedia((prev) => prev.filter((m) => m.id !== deleteAssetId));
        toast.success('Media asset removed');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Delete failed');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
      setDeleteAssetId(null);
    }
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.info('Asset URL copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredMedia = media.filter((m) =>
    m.file_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-500" />
            Media &amp; Asset Library
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Store and organize high-resolution images, videos, carousel PDFs, and brand collateral.
          </p>
        </div>

        {/* Upload Action */}
        <label className="cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] self-start">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
          <span>{uploading ? 'Uploading...' : 'Upload Asset'}</span>
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
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
        />
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span>Loading assets...</span>
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0f172a]/50 text-xs text-slate-400 space-y-2">
            <FolderOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
            <div className="font-semibold text-slate-700 dark:text-slate-300">No media assets found</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Upload images, PDFs, or videos to reuse across scheduled posts.
            </p>
          </div>
        ) : (
          filteredMedia.map((asset) => {
            const isImg = asset.mime_type.startsWith('image/');
            const isVid = asset.mime_type.startsWith('video/');
            const isCopied = copiedId === asset.id;

            return (
              <div
                key={asset.id}
                className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Thumbnail */}
                <div className="h-36 bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden relative">
                  {isImg && asset.url ? (
                    <Image
                      src={asset.url}
                      alt={asset.file_name}
                      width={300}
                      height={200}
                      unoptimized
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : isVid ? (
                    <Video className="w-10 h-10 text-purple-400" />
                  ) : (
                    <FileText className="w-10 h-10 text-emerald-400" />
                  )}

                  {/* Hover Actions */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {asset.url && (
                      <button
                        onClick={() => handleCopyUrl(asset.url!, asset.id)}
                        className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
                        title="Copy Asset URL"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteAssetId(asset.id)}
                      className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white transition-colors"
                      title="Delete Asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Info & Use in Composer */}
                <div className="p-3.5 text-xs space-y-2">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={asset.file_name}>
                    {asset.file_name}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{(asset.file_size / 1024 / 1024).toFixed(2)} MB</span>
                    <span>{new Date(asset.created_at).toLocaleDateString()}</span>
                  </div>

                  <button
                    onClick={() => router.push(`/composer`)}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/80 text-[11px] font-semibold text-blue-600 dark:text-blue-400 transition-colors"
                  >
                    <span>Use in Composer</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteAssetId}
        onClose={() => setDeleteAssetId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Media Asset"
        message="Are you sure you want to delete this media asset? This file will be permanently removed from storage."
        confirmText="Delete Asset"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
