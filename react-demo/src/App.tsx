import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Trophy, Target, TrendingUp, CheckCircle2, Users, Award, Star, Calendar, BarChart3, Activity, Zap, ChevronRight, Menu, X, Plus, Search, Filter } from "lucide-react"

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

const App = () => {
  const [activeView, setActiveView] = useState("dashboard")
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activities, setActivities] = useState([
    { id: 1, title: "Client Meeting", type: "meeting", points: 50, completed: true, time: "2h ago" },
    { id: 2, title: "Proposal Sent", type: "proposal", points: 30, completed: true, time: "4h ago" },
    { id: 3, title: "Follow-up Call", type: "call", points: 20, completed: false, time: "Due today" },
    { id: 4, title: "Contract Signed", type: "deal", points: 100, completed: true, time: "Yesterday" },
  ])

  const teamMembers = [
    { id: 1, name: "Sarah Chen", points: 1250, rank: 1, avatar: "SC", trend: "up" },
    { id: 2, name: "Mike Johnson", points: 1180, rank: 2, avatar: "MJ", trend: "up" },
    { id: 3, name: "Emily Davis", points: 950, rank: 3, avatar: "ED", trend: "down" },
    { id: 4, name: "Alex Kim", points: 880, rank: 4, avatar: "AK", trend: "up" },
  ]

  const stats = [
    { label: "Total Points", value: "3,250", icon: Trophy, change: "+12.5%", color: "from-amber-500 to-orange-500" },
    { label: "Current Streak", value: "15 days", icon: Zap, change: "+3 days", color: "from-blue-500 to-cyan-500" },
    { label: "Team Rank", value: "#2", icon: Award, change: "↑1", color: "from-purple-500 to-pink-500" },
    { label: "Completion Rate", value: "92%", icon: Target, change: "+5%", color: "from-green-500 to-emerald-500" },
  ]

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "activities", label: "Activities", icon: Activity },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
    { id: "achievements", label: "Achievements", icon: Award },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-gray-900 text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white/10 backdrop-blur-md"
      >
        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <AnimatePresence>
        {(isMenuOpen || window.innerWidth >= 1024) && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 25 }}
            className={cn(
              "fixed left-0 top-0 h-full w-64 z-40",
              "bg-gradient-to-b from-gray-900/95 to-gray-800/95",
              "backdrop-blur-xl border-r border-white/10",
              "lg:translate-x-0"
            )}
          >
            <div className="p-6">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Sales Tracker Pro
              </h1>
            </div>
            
            <nav className="px-4 space-y-2">
              {menuItems.map((item) => (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setActiveView(item.id)
                    setIsMenuOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                    activeView === item.id
                      ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/20"
                      : "hover:bg-white/5"
                  )}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                  {activeView === item.id && <ChevronRight className="ml-auto" size={16} />}
                </motion.button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={cn("min-h-screen", "lg:ml-64")}>
        <div className="p-4 lg:p-8 pt-16 lg:pt-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 p-6"
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-20", stat.color)}></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <stat.icon className="w-8 h-8" />
                    <span className="text-xs font-semibold text-green-400">{stat.change}</span>
                  </div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-gray-400">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Activities Section */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Recent Activities</h2>
                <button className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors">
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="space-y-3">
                {activities.map((activity) => (
                  <motion.div
                    key={activity.id}
                    whileHover={{ scale: 1.02 }}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg",
                      "bg-gradient-to-r from-white/5 to-white/0",
                      "border border-white/5 hover:border-white/10",
                      "transition-all cursor-pointer"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      activity.completed ? "bg-green-500/20" : "bg-gray-500/20"
                    )}>
                      <CheckCircle2 className={cn(
                        "w-5 h-5",
                        activity.completed ? "text-green-400" : "text-gray-400"
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{activity.title}</div>
                      <div className="text-sm text-gray-400">{activity.time}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-blue-400">+{activity.points}</div>
                      <div className="text-xs text-gray-500">points</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Leaderboard */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Team Leaderboard</h2>
                <span className="text-sm text-gray-400">This Week</span>
              </div>
              
              <div className="space-y-3">
                {teamMembers.map((member, index) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-white/5 to-white/0 border border-white/5"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                      member.rank === 1 && "bg-gradient-to-br from-yellow-400 to-amber-500",
                      member.rank === 2 && "bg-gradient-to-br from-gray-300 to-gray-400",
                      member.rank === 3 && "bg-gradient-to-br from-orange-400 to-orange-600",
                      member.rank > 3 && "bg-gradient-to-br from-blue-400 to-blue-600"
                    )}>
                      {member.rank}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center font-semibold text-sm">
                      {member.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-gray-400">{member.points} points</div>
                    </div>
                    <div className={cn(
                      "text-sm font-medium",
                      member.trend === "up" ? "text-green-400" : "text-red-400"
                    )}>
                      {member.trend === "up" ? "↑" : "↓"}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Achievement Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md border border-purple-400/20 p-8"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10 animate-pulse"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">Keep up the great work!</h3>
                <p className="text-gray-300">You're only 250 points away from your next achievement</p>
              </div>
              <Trophy className="w-16 h-16 text-yellow-400" />
            </div>
          </motion.div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}

export default App