> ⚠️ **DISCLAIMER: PORTFOLIO PROJECT**
> This repository contains proprietary code intended exclusively for demonstration purposes.
> It relies on private environment variables (.env) and specific API keys to function.
> **Unauthorized copying or redistribution of this codebase is strictly prohibited.**

# 📻 BAKU JUKEBOX V2.0

> *Powered by Vue 3, Node.js, and Google Gemini AI*

![License](https://img.shields.io/badge/license-MIT-green) ![Vue](https://img.shields.io/badge/frontend-Vue_3-42b883) ![Node](https://img.shields.io/badge/backend-Node.js-339933) ![AI](https://img.shields.io/badge/AI-Gemini_Flash-blue)

## 📡 OVERVIEW

**Baku Jukebox** is an experimental web radio platform featuring a retro-industrial user interface inspired by the CRT aesthetics of the 1980s and 90s (Teletext/BIOS motifs).

The project is architected as a **Monorepo** comprising two primary modules:

1.  **Frontend (`public_html`)**: Built with **Vue 3** and **Vite**. Handles reactive interface rendering, real-time audio signal processing (Web Audio API), and CSS/Canvas-based CRT visual simulation.
2.  **Backend (`private`)**: Built with **Node.js** and **Socket.IO**. Manages Shoutcast stream proxying, real-time chat orchestration, and autonomous content generation via AI pipelines (NANA BANANA).

## 🛠 TECH STACK

### Client (`/public_html`)

* **Core Framework:** Vue 3 (Composition API)
* **Build Toolchain:** Vite
* **Styling & FX:** CSS Custom Properties, hardware-accelerated CRT overlay effects, VT323 Typography
* **Audio Engine:** Web Audio API (Custom Canvas Visualizers: Neural Network, City Drive, Matrix Rain)
* **Communication:** Socket.IO Client

### Server (`/private`)

* **Runtime:** Node.js + Express
* **Real-time Infrastructure:** Socket.IO Server
* **Streaming Protocol:** Shoutcast V1/V2 Parser / Proxy
* **AI Integration:**
    * **Google Gemini:** LLM-based text generation and context management.
    * **Nano Banana:** Generative imagery pipeline.
