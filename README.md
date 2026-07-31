# 🤖 Kirka Discord Bot

A Discord Bot for **Kirka.io** that renders player profile cards, multi-page canvas inventory grids with Bolt valuations, clan analytics, and side-by-side player comparisons.

---

## ⚡ Slash Commands

| Command | Description |
|---|---|
| `/profile <user>` | Renders a custom Kirka stats card image with level, XP progress, K/D, winrate, and coins. |
| `/inventory <user>` | Renders a 5x5 canvas grid of user inventory with Bolt item prices, rarity borders, and `◀` `▶` pagination. |
| `/clan <clanname>` | Displays clan rank, member count, total score, and top players. |
| `/compare <user1> <user2>` | Compares two players side-by-side on K/D, level, winrate, and inventory valuation. |

---

## 🚀 How to Host on Render.com

1. **Fork/Push** this repository to your GitHub account (`PatelShrey123/discordbot`).
2. Log into **[Render.com](https://render.com/)** $\rightarrow$ Click **New +** $\rightarrow$ **Background Worker**.
3. Select your `discordbot` repository.
4. Set Environment Variables in Render:
   - `DISCORD_TOKEN`: Your Discord bot token.
   - `KIRKA_API_KEY`: Your Kirka API key.
5. Click **Create Background Worker** — Render will automatically build and keep the bot running 24/7!
