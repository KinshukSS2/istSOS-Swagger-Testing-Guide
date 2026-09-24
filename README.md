<div align="center">

# 🧪 istSOS4 Auth Testing Guide

### Every authentication, RBAC and row-level-security feature —<br/>tested against a live deployment and traced to the code that implements it.

<br/>

[![Live Guide](https://img.shields.io/badge/🚀_LIVE_GUIDE-Open_Now-8aa9ff?style=for-the-badge&labelColor=0a0c10)](https://kinshukss2.github.io/istSOS-Swagger-Testing-Guide/)

<br/>

![Tests](https://img.shields.io/badge/tests-32%2F32_passing-3ecf8e?style=flat-square&labelColor=11151c)
![Pass rate](https://img.shields.io/badge/pass_rate-100%25-3ecf8e?style=flat-square&labelColor=11151c)
![Source files traced](https://img.shields.io/badge/source_files_traced-50-8aa9ff?style=flat-square&labelColor=11151c)
![Standard](https://img.shields.io/badge/OGC-SensorThings_API-f0b449?style=flat-square&labelColor=11151c)
![GSoC](https://img.shields.io/badge/GSoC-2026-ff7a7a?style=flat-square&labelColor=11151c)
![Hosted on](https://img.shields.io/badge/hosted_on-GitHub_Pages-181717?style=flat-square&logo=github&labelColor=11151c)

</div>

---

## ✨ What is this?

An interactive, single-page test report for the **authentication & authorization layer of [istSOS4](https://github.com/istSOS/istSOS4)**, the OGC SensorThings API server.

Each test in the guide shows:

| | |
|---|---|
| 🎯 **What it checks** | The behaviour under test, in plain language |
| 📋 **Expected vs. actual** | What should happen, and what really happened |
| 🧵 **The implementation** | The exact source locations that make it work, with line numbers |
| 🔬 **The test logic** | The code that performs the assertion |
| 📡 **Recorded HTTP exchanges** | Real requests and responses from the live run |
| ▶️ **Run in Swagger** | A jump-off point to reproduce the test yourself |

## 🗺️ What's covered

| Part | Focus | Tests |
|:---:|---|:---:|
| **Setup** | Ground truth: Networks, Datastreams, Observations, feature flags | `S0` |
| **A** | 🔐 **Local account lifecycle**: register → approve → login → RBAC boundary → refresh → role change → password change → logout → reject / deactivate | `A1 – A12` |
| **B** | 🌐 **External (OIDC) authentication**: start login, provider consent, identity activation, provider availability | `B1 – B4` |
| **C** | 👁️ **Data visibility & Network scoping**: access matrix, anonymous denial, viewer/editor isolation, reference tables, observation counts, admin-only policies | `C1 – C10` |
| **D** | 🛠️ **The custom role**: mixed read/write grants, proving the split, revoking, external custom identities | `D1 – D5` |

> **32 tests · 32 passed · 0 failed · 0 manual**, run against a live deployment with
> `AUTHORIZATION=1` `NETWORK=1` `ANONYMOUS_VIEWER=0` `VERSIONING=1` `REDIS=0`.

## 🎛️ Features of the page

- 🔍 **Live filter**: search across all tests instantly
- 📂 **Expand / collapse all**: skim the summary or dive into every detail
- 🔢 **Line numbers toggle**: for code excerpts
- 🌙 **Dark, readable design**: IBM Plex Sans + JetBrains Mono
- 📱 **Responsive**: works on desktop, tablet and phone
- ⚡ **Zero build step**: one self-contained `index.html`

## 🚀 Run it locally

No install, no build.

```bash
git clone https://github.com/KinshukSS2/istSOS-Swagger-Testing-Guide.git
cd istSOS-Swagger-Testing-Guide

# option 1: just open it
xdg-open index.html

# option 2: serve it
python3 -m http.server 8000   # → http://localhost:8000
```

## 📁 Repository layout

```
.
├── index.html    # the complete guide (self-contained)
├── .nojekyll     # serve files as-is on GitHub Pages
└── README.md
```

## 🌍 Deployment

Hosted with **GitHub Pages**, served straight from the `main` branch.
Every push to `main` republishes the site automatically.

**🔗 https://kinshukss2.github.io/istSOS-Swagger-Testing-Guide/**

## 🔗 Related

- 🛰️ [istSOS4](https://github.com/istSOS/istSOS4): the SensorThings API server under test
- 📖 [OGC SensorThings API](https://www.ogc.org/standards/sensorthings/): the standard

---

<div align="center">

Made with ☕ for **Google Summer of Code** · by [@KinshukSS2](https://github.com/KinshukSS2)

</div>
