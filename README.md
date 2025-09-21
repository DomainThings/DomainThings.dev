<div align="center">

# 🌐 DomainThings

**A modern Progressive Web App for domain analysis and management**

[![MIT License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?style=for-the-badge&logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

*Professional domain search and tracking tool built with modern web technologies*

</div>

---

## 🎯 Overview

DomainThings is a Progressive Web Application that allows you to search for domain availability and track domains of interest. Built with modern web standards and focusing on client-side processing for privacy, it provides a fast and reliable domain analysis experience.

### 🏆 Key Benefits

- **🔒 Privacy-First**: No server-side data storage - everything stays in your browser
- **⚡ Fast Performance**: Quick domain lookups with intelligent caching
- **📱 Progressive Web App**: Installable as a native app with service worker support
- **🎨 Modern Design**: Clean, responsive interface with dark/light theme support
- **🔧 Developer-Friendly**: Built with TypeScript and modern tooling

---

## ✨ Features

### 🔍 **Domain Search**
- **DNS Analysis**: Domain availability checking using Cloudflare's DNS-over-HTTPS
- **RDAP Data**: Registry information via IANA's RDAP bootstrap services
- **Multi-TLD Search**: Search across all available top-level domains
- **Smart Results**: Intelligent domain availability assessment

### � **Domain Management**
- **Watch List**: Bookmark and track domains of interest
- **TLD Bookmarks**: Save favorite extensions for quick searching
- **Search History**: Navigate through your search queries
- **Local Storage**: All data stored locally for privacy

### 🛠️ **Technical Features**
- **Service Worker**: Background caching and PWA functionality
- **Smart Caching**: DNS and RDAP response caching for better performance
- **Error Handling**: Robust error recovery with user-friendly messages
- **Responsive Design**: Works seamlessly on desktop and mobile devices

---

## 🏗️ Architecture

### **Tech Stack**
```
Vue 3 + Composition API  →  Modern reactive framework with TypeScript
Pinia                    →  State management for search and app data
Vue Router               →  Client-side routing with query parameters
TailwindCSS              →  Utility-first CSS framework
IndexedDB (via idb)      →  Client-side data persistence
```

### **Build Tools**
```
Vite                     →  Fast development and optimized builds
TypeScript               →  Type safety and better developer experience
Workbox                  →  Service worker and PWA features
ESLint                   →  Code quality and consistency
```

### **External Services**
```
Cloudflare DNS           →  DNS-over-HTTPS for domain lookups
IANA RDAP               →  Official domain registry data
Cloudflare Pages        →  Static hosting and deployment
```

---

## 🚀 Quick Start

### **Prerequisites**
- Node.js 18+ and npm
- Modern web browser
- Git

### **Installation**

```bash
# Clone the repository
git clone https://github.com/DomainThings/DomainThings.dev.git
cd DomainThings.dev

# Install dependencies
npm install

# Start development server
npm run dev
```

### **Development Commands**

```bash
# Development server with hot reload
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview
```

### **Production Build**

```bash
# Build optimized bundle
npm run build

# Files will be generated in dist/ directory
```

---

## 📱 Progressive Web App

### **PWA Features**
- **Service Worker**: Automatic caching and background updates
- **Installable**: Add to home screen on mobile and desktop
- **Responsive**: Optimized for all screen sizes
- **Fast Loading**: Precached resources for instant loading

### **Installation**
- **Desktop**: Look for the install prompt in your browser
- **Mobile**: Use "Add to Home Screen" from your browser menu

---

## 🔧 Technical Details

### **Data Storage**
- **IndexedDB**: Local storage for bookmarked domains and TLDs
- **Browser Cache**: DNS and RDAP responses cached for performance
- **No Server Storage**: All data remains on your device

### **API Integration**
- **DNS Service**: Uses Cloudflare's 1.1.1.1 DNS-over-HTTPS
- **RDAP Service**: Connects to official registry providers via IANA bootstrap
- **Error Handling**: Comprehensive error recovery and user feedback

### **Performance**
- **Caching Strategy**: Intelligent caching of DNS and RDAP responses
- **Code Splitting**: Optimized bundle loading with vendor chunks
- **Lazy Loading**: Components and routes loaded on demand

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### **Development Workflow**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Make your changes with proper TypeScript types
4. Test your changes thoroughly
5. Commit with clear messages (`git commit -m 'Add: new feature'`)
6. Push to your branch (`git push origin feature/new-feature`)
7. Open a Pull Request

### **Code Standards**
- Follow existing TypeScript and Vue 3 patterns
- Use the Composition API for new components
- Maintain responsive design principles
- Add proper error handling and user feedback

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[Cloudflare](https://cloudflare.com)** - DNS-over-HTTPS services
- **[IANA](https://iana.org)** - RDAP bootstrap and registry data
- **[Vue.js Team](https://vuejs.org)** - The progressive JavaScript framework
- **[Vite Team](https://vitejs.dev)** - Next generation frontend tooling
- **[TailwindCSS](https://tailwindcss.com)** - Utility-first CSS framework

---

<div align="center">

**Built with ❤️ for the domain community**

</div>


