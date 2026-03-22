import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Reply, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Comments({ videoId, onClose }) {
  const { fetchWithAuth, showToast, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    loadComments();
  }, [videoId]);

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
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    }}>
      <div 
        onClick={onClose}
        style={{ flex: 1 }}
      />
      
      <div style={{
        background: '#1E2235',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slide-up 0.3s ease',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>
            {comments.length} Comments
          </h3>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 20px',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#A0A0A0' }}>
              Loading comments...
            </div>
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
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 20px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: '#161828',
          }}
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
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
            className="input"
            style={{ flex: 1, padding: '10px 16px' }}
          />
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
