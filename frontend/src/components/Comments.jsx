import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Reply, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MAX_LEN = 280;

function CommentSkeleton() {
  return (
    <div className="space-y-4 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="h-9 w-9 flex-shrink-0 rounded-full bg-slate-800/90">
            <div className="h-full w-full animate-shimmer-slide rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 rounded-sm bg-slate-800/90">
              <div className="h-full w-full animate-shimmer-slide rounded-sm bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
            </div>
            <div className="h-3 w-full rounded-sm bg-slate-800/90">
              <div className="h-full w-full animate-shimmer-slide rounded-sm bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Comments({ videoId, onClose }) {
  const { fetchWithAuth, showToast, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadComments();
  }, [videoId]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);

  const loadComments = async () => {
    try {
      const res = await fetchWithAuth(`/videos/${videoId}/comments`);
      const data = await res.json();
      setComments(data);
    } catch (err) {
      showToast('Failed to load comments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    if (newComment.trim().length > MAX_LEN) {
      showToast(`Comment must be ${MAX_LEN} characters or less`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/videos/${videoId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: newComment.trim(),
          parentId: replyingTo?.id || null,
        }),
      });

      if (res.ok) {
        const comment = await res.json();
        if (replyingTo) {
          setComments(prev => prev.map(c => {
            if (c.id === replyingTo.id) {
              return { ...c, replies: [...(c.replies || []), comment] };
            }
            return c;
          }));
          setExpandedReplies(prev => ({ ...prev, [replyingTo.id]: true }));
        } else {
          setComments(prev => [comment, ...prev]);
        }
        setNewComment('');
        setReplyingTo(null);
        showToast('Comment posted!', 'success');
      }
    } catch (err) {
      showToast('Failed to post comment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = (comment) => {
    setReplyingTo(comment);
    inputRef.current?.focus();
  };

  const toggleReplies = (commentId) => {
    setExpandedReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[200] flex flex-col justify-end bg-black/75 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="Comments"
    >
      <div 
        onClick={onClose}
        className="flex-1"
      />
      
      <div
        className="flex max-h-[70vh] flex-col rounded-t-[1.75rem] border border-white/10 border-b-0 bg-[#0c1022]/95 shadow-glass backdrop-blur-3xl"
        style={{ animation: 'slide-up 0.3s ease' }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-white">
              {comments.length} Comments
            </h3>
            {typing && (
              <p className="mt-1 text-xs text-neon-cyan/90">Typing…</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <CommentSkeleton />
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#A0A0A0' }}>
              No comments yet. Be the first!
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: 14, flexShrink: 0 }}>
                    {comment.author?.avatar ? (
                      <img src={comment.author.avatar} alt="" />
                    ) : (
                      comment.author?.username?.charAt(0).toUpperCase() || '?'
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {comment.author?.displayName || comment.author?.username}
                      </span>
                      <span style={{ color: '#6B7280', fontSize: 12 }}>
                        {formatTime(comment.createdAt)}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, color: '#E0E0E0', lineHeight: 1.5 }}>
                      {comment.content}
                    </p>
                    <button
                      onClick={() => handleReply(comment)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 8,
                        color: '#6F4FFF',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      <Reply size={14} />
                      Reply
                    </button>

                    {comment.replies?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <button
                          onClick={() => toggleReplies(comment.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            color: '#6F4FFF',
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {expandedReplies[comment.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {comment.replies.length} replies
                        </button>

                        {expandedReplies[comment.id] && (
                          <div style={{ marginTop: 12, marginLeft: 20, borderLeft: '2px solid #252A40', paddingLeft: 12 }}>
                            {comment.replies.map((reply) => (
                              <div key={reply.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                                <div className="avatar" style={{ width: 28, height: 28, fontSize: 12, flexShrink: 0 }}>
                                  {reply.author?.avatar ? (
                                    <img src={reply.author.avatar} alt="" />
                                  ) : (
                                    reply.author?.username?.charAt(0).toUpperCase() || '?'
                                  )}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                                      {reply.author?.displayName || reply.author?.username}
                                    </span>
                                    <span style={{ color: '#6B7280', fontSize: 11 }}>
                                      {formatTime(reply.createdAt)}
                                    </span>
                                  </div>
                                  <p style={{ fontSize: 13, color: '#E0E0E0' }}>
                                    {reply.content}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form 
          onSubmit={handleSubmit}
          className="relative flex flex-nowrap items-center gap-3 border-t border-white/10 bg-[#0a0d18]/95 px-5 py-4 pb-6 backdrop-blur-xl"
        >
          {replyingTo && (
            <div style={{
              position: 'absolute',
              bottom: 70,
              left: 20,
              right: 20,
              padding: '8px 12px',
              background: '#252A40',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
            }}>
              <span style={{ color: '#A0A0A0' }}>
                Replying to <strong style={{ color: '#6F4FFF' }}>{replyingTo.author?.username}</strong>
              </span>
              <button onClick={() => setReplyingTo(null)} style={{ color: '#A0A0A0' }}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="avatar" style={{ width: 36, height: 36, fontSize: 14, flexShrink: 0 }}>
            {user?.username?.charAt(0).toUpperCase() || '?'}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => {
              const v = e.target.value.slice(0, MAX_LEN);
              setNewComment(v);
              setTyping(true);
              if (typingTimer.current) clearTimeout(typingTimer.current);
              typingTimer.current = window.setTimeout(() => setTyping(false), 1200);
            }}
            onBlur={() => setTyping(false)}
            placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
            className="input min-w-0 flex-1"
            maxLength={MAX_LEN}
            style={{ padding: '10px 16px' }}
          />
          <span className="min-w-[3rem] text-right text-[11px] tabular-nums text-white/40" aria-live="polite">
            {newComment.length}/{MAX_LEN}
          </span>
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: newComment.trim() ? 'linear-gradient(135deg, #6F4FFF, #4A2FCC)' : '#252A40',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: newComment.trim() ? 'white' : '#6B7280',
              transition: 'all 0.2s ease',
            }}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default Comments;
