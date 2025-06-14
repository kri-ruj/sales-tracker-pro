import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: '🏠' },
    { name: 'Activities', href: '/activities', icon: '📊' },
    { name: 'Leaderboard', href: '/leaderboard', icon: '🏆' },
    { name: 'Profile', href: '/profile', icon: '👤' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-orange-500">Sales Tracker Pro</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {user?.pictureUrl && (
                  <img
                    src={user.pictureUrl}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm font-medium">{user?.displayName}</span>
              </div>
              
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center px-3 py-4 text-sm font-medium border-b-2 ${
                    isActive
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                <span className="mr-2">{item.icon}</span>
                {item.name}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Version info */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-400">
        v2.0.0
      </div>
    </div>
  );
}