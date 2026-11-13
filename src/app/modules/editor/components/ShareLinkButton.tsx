import { FC, useState } from "react";
import { toast } from "react-toastify";
import {
  buildShareUrl,
  buildDbShareUrl,
  saveSharePayloadToDb,
  updateSharePayloadInDb,
  type SharePayload,
} from "../../../../services/shareLinkService";

interface ShareLinkButtonProps {
  payload: SharePayload;
  shareId?: string;
  onShareIdChange?: (id: string, options?: { skipLoad?: boolean }) => void;
  onSaveSuccess?: (payload: SharePayload, version?: number) => void;
}

const ShareLinkButton: FC<ShareLinkButtonProps> = ({ payload, shareId, onShareIdChange, onSaveSuccess }) => {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCopyNewLink = async () => {
    try {
      setIsSharing(true);
      // Attempt database save
      const id = await saveSharePayloadToDb(payload);
      const url = buildDbShareUrl(id);
      
      await navigator.clipboard.writeText(url);
      setCopied(true);
      
      if (onShareIdChange) {
        onShareIdChange(id, { skipLoad: true });
      }
      if (onSaveSuccess) {
        onSaveSuccess(payload, 1);
      }

      toast.success("Document shared! Link copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch (dbError) {
      console.error("Cloud document save failed:", dbError);
      
      // Fallback to offline URL compression
      const url = buildShareUrl(payload);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.info("Saved offline link to clipboard.");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Could not copy link");
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleUpdate = async () => {
    if (!shareId) return;
    try {
      setIsSaving(true);
      const result = await updateSharePayloadInDb(shareId, payload);
      if (onSaveSuccess) {
        onSaveSuccess(payload, result?.version);
      }
      toast.success("Changes saved! Others viewing this link will see updates shortly.");
    } catch (error) {
      toast.error("Failed to save changes to database.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyExistingLink = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  // If the document has already been shared and has a database ID
  if (shareId) {
    return (
      <div className="d-flex align-items-center gap-2">
        <button
          type="button"
          className="btn-icon save-changes-btn"
          onClick={handleUpdate}
          disabled={isSaving}
          title="Save changes to cloud"
          aria-label="Save changes to cloud"
        >
          {isSaving ? (
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden />
          ) : (
            <i className="bi bi-cloud-check-fill text-success" aria-hidden />
          )}
          <span className="share-link-label">
            {isSaving ? "Saving..." : "Save Changes"}
          </span>
        </button>

        <button
          type="button"
          className="btn-icon share-link-btn"
          onClick={handleCopyExistingLink}
          title="Copy share link"
          aria-label="Copy share link"
        >
          {copied ? (
            <i className="bi bi-check-lg text-success" aria-hidden />
          ) : (
            <i className="bi bi-link-45deg" aria-hidden />
          )}
          <span className="share-link-label">{copied ? "Copied" : "Copy link"}</span>
        </button>
      </div>
    );
  }

  // Fallback: original layout for creating a new share link
  return (
    <button
      type="button"
      className="btn-icon share-link-btn"
      onClick={handleCopyNewLink}
      disabled={isSharing}
      title="Copy share link"
      aria-label="Copy share link"
    >
      {isSharing ? (
        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
      ) : copied ? (
        <i className="bi bi-check-lg text-success" aria-hidden />
      ) : (
        <i className="bi bi-link-45deg" aria-hidden />
      )}
      <span className="share-link-label">
        {isSharing ? "Sharing..." : copied ? "Copied" : "Copy link"}
      </span>
    </button>
  );
};

export default ShareLinkButton;
