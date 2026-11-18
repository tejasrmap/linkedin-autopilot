'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader, ActionButton } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { MediaAsset } from '@/types';

export default function LibraryPage() {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!deleteAssetId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${deleteAssetId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete media asset');
      }
      toast.success('Asset deleted successfully');
      setDeleteAssetId(null);
      await fetchMedia();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredMedia = media.filter((m) =>
    (m.file_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const tones = ['blue', 'violet', 'mint', 'amber', 'rose'];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,application/pdf"
        onChange={handleUpload}
        style={{ display: 'none' }}
      />

      <PageHeader
        screen="library"
        action={uploading ? 'Uploading…' : 'Upload media'}
        onAction={() => fileInputRef.current?.click()}
      />

      <div className="library-tools">
        <div className="search-field">
          <Icon name="search" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your media"
          />
        </div>
        <button type="button" className="btn btn-secondary">
          <Icon name="filter" size={15} /> All media <Icon name="chevron" size={14} />
        </button>
        <div className="spacer" />
        <span className="muted-text">
          {filteredMedia.length} {filteredMedia.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
          Loading media library…
        </div>
      ) : filteredMedia.length > 0 ? (
        <div className="media-grid">
          {filteredMedia.map((item, i) => {
            const tone = tones[i % tones.length];
            const formattedDate = new Date(item.created_at).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            }).toUpperCase();

            return (
              <div
                className="media-card"
                key={item.id}
                onClick={() => {
                  router.push(`/composer?mediaId=${item.id}`);
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className={`media-art art-${tone}`}>
                  <span>{i % 3 === 0 ? '✳' : i % 3 === 1 ? '◌' : '▧'}</span>
                  <i>{formattedDate}</i>
                </div>
                <div className="media-meta">
                  <div>
                    <b>{item.file_name}</b>
                    <small>
                      {item.mime_type.split('/')[0]} · {(item.file_size / (1024 * 1024)).toFixed(1)} MB
                    </small>
                  </div>
                  <button
                    type="button"
                    className="plain-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteAssetId(item.id);
                    }}
                    aria-label="Delete media"
                    title="Delete media"
                  >
                    <Icon name="close" size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="folder" size={20} />
          </span>
          <h3>No media assets found</h3>
          <p>
            {search
              ? 'Try a different search query.'
              : 'Uploaded images and documents will appear here.'}
          </p>
          <ActionButton onClick={() => fileInputRef.current?.click()}>
            <Icon name="upload" size={15} /> Upload media
          </ActionButton>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteAssetId}
        onClose={() => setDeleteAssetId(null)}
        onConfirm={handleDelete}
        title="Delete Media File"
        message="Are you sure you want to permanently delete this media file?"
        confirmText={deleting ? 'Deleting…' : 'Delete'}
        variant="danger"
      />
    </>
  );
}
