# Deploy Frontend V2 - Upgrade Guide

This guide will help you deploy the new upgraded frontend to your server.

## 🚀 Quick Deployment Steps

### Option 1: Using docker-compose-v2.yml (Recommended)

On your **server terminal**, run:

```bash
cd iKhwezi-Livestream-App
git pull origin master
docker-compose -f docker-compose-v2.yml down -v --remove-orphans
docker system prune -a -f
docker-compose -f docker-compose-v2.yml build --no-cache --pull
docker-compose -f docker-compose-v2.yml up -d
sleep 30
docker-compose -f docker-compose-v2.yml ps
```

Then refresh **https://ikhwezi.site** to see the new V2 interface!

### Option 2: Replace Current Frontend

If you want to replace the current frontend:

```bash
cd iKhwezi-Livestream-App
git pull origin master
docker-compose down -v
rm -rf storage/
docker system prune -a -f
docker-compose build --no-cache --pull frontend
docker-compose up -d
```

## 🎨 What's New in V2?

✅ Modern dark theme with gradient accents  
✅ Better UI/UX with smooth animations  
✅ Faster build with Vite  
✅ Responsive design (mobile-friendly)  
✅ Clean, professional splash screen  
✅ Feature highlights (Stream, Create, Earn)  

## 📋 Features

- **Login/Register Buttons**: Beautiful gradient buttons for guest users
- **Animated Background**: Subtle animated gradient elements
- **Modern Typography**: Clean, readable text hierarchy
- **Icons**: Visual feature indicators
- **Professional Look**: Looks like a completed product upgrade

## ⚡ Performance

- Vite build system (faster builds)
- Optimized assets with gzip compression
- Modern CSS with Tailwind
- React 18 with latest optimizations

## 🔄 Rollback to Original

If you need to go back to the original frontend:

```bash
cd iKhwezi-Livestream-App
docker-compose down -v
docker-compose up -d
```

---

**Enjoy your upgraded platform!** 🎉
