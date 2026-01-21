> ⚠️ **DISCLAIMER: PORTFOLIO PROJECT**
> This repository contains proprietary code intended for demonstration purposes only.
> It requires private environment variables (.env) and specific API keys to function.
> **Copying or using this code for your own projects is strictly prohibited.**




# 📻 BAKU JUKEBOX V2.0




> *Powered by Vue 3, Node.js, and Google Gemini AI*



![License](https://img.shields.io/badge/license-MIT-green) ![Vue](https://img.shields.io/badge/frontend-Vue_3-42b883) ![Node](https://img.shields.io/badge/backend-Node.js-339933) ![AI](https://img.shields.io/badge/AI-Gemini_Flash-blue)



## 📡 OVERVIEW



**Baku Jukebox** — это экспериментальное веб-радио с интерфейсом, стилизованным под ЭЛТ-мониторы 80-90х годов (Teletext/BIOS).



Проект состоит из двух частей (Monorepo):

1.  **Frontend (`public_html`)**: Vue 3 + Vite. Рендеринг интерфейса, визуализация аудио (Web Audio API), CRT-эффекты.

2.  **Backend (`private`)**: Node.js + Socket.IO. Проксирование потока Shoutcast, управление чатом и генерация контента через AI (NANA BANANA).



## 🛠 TECH STACK



### Client (`/public_html`)

* **Framework:** Vue 3 (Composition API)

* **Build:** Vite

* **Styling:** Custom CSS Variables, CRT Overlay effects, VT323 Font

* **Audio:** Web Audio API (Canvas Visualizers: Neural Network, City Drive, Matrix Rain)

* **Comms:** Socket.IO Client



### Server (`/private`)

* **Runtime:** Node.js + Express

* **Live Updates:** Socket.IO Server

* **Radio Protocol:** Shoutcast V1/V2 Parser

* **AI Core:**

    * Google Gemini (Text generation)

    * Nano Banana (Image generation)



