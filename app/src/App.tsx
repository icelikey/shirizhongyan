/**
 * 路由总表（design.md §11）
 * `/` 首页（叙事页，无 TopHUD）；其余应用页外层 = LoginGuard + AppShell（<Outlet/> 嵌套）。
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import AppShell from '@/components/AppShell'
import LoginGuard from '@/components/LoginGuard'
import CursorGlow from '@/components/CursorGlow'
import Home from '@/pages/Home'
import Lobby from '@/pages/Lobby'
import GameGuess from '@/pages/GameGuess'
import GameWerewolf from '@/pages/GameWerewolf'
import World from '@/pages/World'
import Agent from '@/pages/Agent'
import Lore from '@/pages/Lore'
import Leaderboard from '@/pages/Leaderboard'
import Codex from '@/pages/Codex'
import SpireHub from '@/pages/SpireHub'
import SpireMap from '@/pages/SpireMap'
import SpireCombat from '@/pages/SpireCombat'
import Login from '@/pages/Login'
import GuessOnline from '@/pages/GuessOnline'
import GuessMilleOnline from '@/pages/GuessMilleOnline'
import PollOnline from '@/pages/PollOnline'
import PirateGoldOnline from '@/pages/PirateGoldOnline'
import FlyOnline from '@/pages/FlyOnline'
import PokerTower from '@/pages/PokerTower'
import AgentPortal from '@/pages/AgentPortal'
import CharacterShowcase from '@/pages/CharacterShowcase'
import EntryWorld from '@/pages/EntryWorld'
import AgentReport from '@/pages/AgentReport'

export default function App() {
  return (
    <BrowserRouter>
      <CursorGlow />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#14101C',
            border: '1px solid rgba(227,194,124,.28)',
            color: '#F2EAD8',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Home />} />
        {/* WASD 入界试炼是独立玩法，不属于首页；旧地址保留兼容。 */}
        <Route path="/game/entry" element={<EntryWorld />} />
        <Route path="/entry" element={<Navigate to="/game/entry" replace />} />
        {/* 角色卡视觉试作：公开展示页，便于本机与评审直接查看 */}
        <Route path="/characters" element={<CharacterShowcase />} />
        {/* Agent 只读日报：凭注册时生成的 reportToken 访问，不要求网页登录。 */}
        <Route path="/agent-report/:agentId" element={<AgentReport />} />
        {/* 联机房间支持未登录观众；页面自身只在入座/动作时要求登录。 */}
        <Route element={<AppShell />}>
          <Route path="/game/online/:code" element={<GuessOnline />} />
          <Route path="/game/online-mille/:code" element={<GuessMilleOnline />} />
          <Route path="/game/online-poll/:code" element={<PollOnline />} />
          <Route path="/game/online-pirate/:code" element={<PirateGoldOnline />} />
          <Route path="/game/online-fly/:code" element={<FlyOnline />} />
          <Route path="/agent-portal" element={<AgentPortal />} />
        </Route>
        {/* 应用页：登录守卫 + 布局壳（TopHUD + Outlet） */}
        <Route
          element={
            <LoginGuard>
              <AppShell />
            </LoginGuard>
          }
        >
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game/guess/:roomId" element={<GameGuess />} />
          <Route path="/game/werewolf/:roomId" element={<GameWerewolf />} />
          <Route path="/world" element={<World />} />
          <Route path="/agent" element={<Agent />} />
          <Route path="/lore" element={<Lore />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/codex" element={<Codex />} />
          <Route path="/game/spire" element={<SpireHub />} />
          <Route path="/game/spire/map" element={<SpireMap />} />
          <Route path="/game/spire/combat" element={<SpireCombat />} />
          <Route path="/game/poker" element={<PokerTower />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
