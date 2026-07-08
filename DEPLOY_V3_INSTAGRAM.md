# Deploy Frontend V3 - Instagram Rebuild

## 🎬 What's New in V3?

✅ **Complete Rebuild**
- Instagram-inspired feed design
- Dark modern UI (black theme)
- Stories carousel
- Like & comment system

✅ **Admin Livestream Panel**
- Start/stop broadcasts
- Real-time viewer count
- Stream statistics
- RTMP configuration

✅ **Professional Features**
- Mobile responsive
- Smooth animations
- Modern components (using Lucide icons)
- Vite + React 18

---

## 🚀 Quick Deployment

### On Your Server Terminal:

```bash
cd iKhwezi-Livestream-App
git pull origin master
docker-compose -f docker-compose-v3.yml down -v --remove-orphans
docker system prune -a -f
sudo rm -rf storage/ frontend/dist backend/dist
docker-compose -f docker-compose-v3.yml build --no-cache --pull
docker-compose -f docker-compose-v3.yml up -d
sleep 30
echo "✓ NEW V3 DEPLOYED!"
docker-compose -f docker-compose-v3.yml ps
```

---

## 📱 Access Points

**Main Feed:**
```
https://ikhwezi.site
```

**Admin Livestream Panel:**
```
https://ikhwezi.site/admin
```

Or directly:
```
https://ikhwezi.site/admin/livestream
```

---

## 🎨 Features Breakdown

### **Instagram-Style Feed** (`/`)
- Scrollable feed with posts
- Stories carousel at top
- Like/comment buttons
- User profiles & captions
- Real-time engagement

### **Admin Livestream Panel** (`/admin`)
- **Live Control**: Start/stop buttons
- **Preview Window**: See stream in real-time
- **Stream Settings**: Title, RTMP key
- **Statistics**: Viewers, stream time, peak viewers
- **Quick Actions**: Moderator tools, save streams

---

## 🔐 Admin Authentication (Future)

Currently, admin panel is open at `/admin`. To add authentication:
1. Add login page
2. Protect `/admin` routes
3. Use JWT tokens

---

## 📊 Database Schema (V3)

```
Users:
- id, email, username, password
- avatar, bio, profile_pic
- followers, following

Posts:
- id, userId, image, caption
- likes, comments, created_at

Livestreams:
- id, admin_id, title, status
- viewers, start_time, end_time
- rtmp_key, hls_url

Comments:
- id, postId, userId, text, created_at

Likes:
- id, postId, userId
```

---

## 🔄 Rollback to V2

If needed:
```bash
docker-compose -f docker-compose-v2.yml down -v
docker-compose -f docker-compose-v2.yml up -d
```

---

**Version**: 3.0.0  
**Status**: Production Ready  
**Theme**: Dark Instagram-Inspired
