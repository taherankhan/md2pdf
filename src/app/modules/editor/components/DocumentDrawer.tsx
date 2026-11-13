import React, { FC, useState, useEffect, useMemo, ChangeEvent } from 'react';
import {
  DocumentSummary,
  fetchUserDocuments,
  createDocument,
  deleteDocument,
} from '../../../../services/documentService';
import { toast } from 'react-toastify';
import './DocumentDrawer.css';

interface DocumentDrawerProps {
  isOpen: boolean;
  activeDocId: string | null;
  onClose: () => void;
  onSelectDocument: (docId: string) => void;
  onNewDocument: () => void;
}

export const DocumentDrawer: FC<DocumentDrawerProps> = ({
  isOpen,
  activeDocId,
  onClose,
  onSelectDocument,
  onNewDocument,
}) => {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const list = await fetchUserDocuments();
      setDocuments(list);
    } catch (err: any) {
      console.error('Failed to load user documents:', err);
      toast.error('Failed to load your documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDocs();
    }
  }, [isOpen]);

  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase().trim();
    return documents.filter((d) => (d.title || 'Untitled document').toLowerCase().includes(q));
  }, [documents, searchQuery]);

  const handleCreateNew = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const newDoc = await createDocument({
        title: 'Untitled document',
        content: '# Untitled Document\n\nStart typing...',
        theme: 'professional',
      });
      setDocuments((prev) => [newDoc, ...prev]);
      onSelectDocument(newDoc._id);
      onClose();
      toast.success('Created new document!');
    } catch (err: any) {
      console.error('Error creating document:', err);
      toast.error('Failed to create new document');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, docId: string, title: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${title || 'Untitled document'}"?`)) {
      return;
    }

    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
      toast.success('Document deleted');
      if (activeDocId === docId) {
        onNewDocument();
      }
    } catch (err: any) {
      console.error('Error deleting document:', err);
      toast.error('Failed to delete document');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="doc-drawer-backdrop" onClick={onClose} aria-hidden />
      <aside
        className="doc-drawer-panel"
        role="dialog"
        aria-label="My Files Library"
        aria-modal="true"
      >
        <div className="doc-drawer-header">
          <div className="doc-drawer-title-row">
            <div className="doc-drawer-title">
              <i className="bi bi-folder2-open"></i>
              <span>My Files</span>
              <span className="doc-drawer-badge">{documents.length}</span>
            </div>
            <button
              type="button"
              className="doc-drawer-close"
              onClick={onClose}
              aria-label="Close files drawer"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <div className="doc-drawer-actions">
            <button
              type="button"
              className="btn-new-doc"
              onClick={handleCreateNew}
              disabled={isCreating}
            >
              <i className="bi bi-plus-lg"></i>
              <span>{isCreating ? 'Creating...' : 'New File'}</span>
            </button>
          </div>

          <div className="doc-drawer-search">
            <i className="bi bi-search search-icon" aria-hidden />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="doc-drawer-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <i className="bi bi-x-circle-fill"></i>
              </button>
            )}
          </div>
        </div>

        <div className="doc-drawer-body">
          {isLoading && documents.length === 0 ? (
            <div className="doc-drawer-loading">
              <div className="drawer-spinner"></div>
              <span>Loading documents...</span>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="doc-drawer-empty">
              <i className="bi bi-journal-text empty-icon"></i>
              <p className="empty-title">
                {searchQuery ? 'No matching files found' : 'No saved files yet'}
              </p>
              <p className="empty-desc">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Click "+ New File" to start saving your markdown documents to the cloud.'}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  className="btn-empty-create"
                  onClick={handleCreateNew}
                  disabled={isCreating}
                >
                  <i className="bi bi-plus-lg"></i> Create First File
                </button>
              )}
            </div>
          ) : (
            <ul className="doc-list" role="list">
              {filteredDocs.map((doc) => {
                const isActive = activeDocId === doc._id;
                return (
                  <li
                    key={doc._id}
                    className={`doc-list-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onSelectDocument(doc._id);
                      onClose();
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="doc-item-icon">
                      <i className={`bi ${doc.shareId ? 'bi-share-fill' : 'bi-file-earmark-text'}`}></i>
                    </div>

                    <div className="doc-item-info">
                      <div className="doc-item-title-row">
                        <span className="doc-item-title">
                          {doc.title || 'Untitled document'}
                        </span>
                        {doc.shareId && (
                          <span className="doc-item-shared-badge" title="Public share link active">
                            Shared
                          </span>
                        )}
                      </div>
                      <div className="doc-item-meta">
                        <span className="doc-item-date">{formatDate(doc.updatedAt)}</span>
                        <span className="meta-dot">•</span>
                        <span className="doc-item-theme">{doc.theme || 'professional'}</span>
                      </div>
                    </div>

                    <div className="doc-item-actions">
                      <button
                        type="button"
                        className="btn-doc-delete"
                        onClick={(e) => handleDelete(e, doc._id, doc.title)}
                        title="Delete document"
                        aria-label="Delete document"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
};
