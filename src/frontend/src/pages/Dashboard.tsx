import React from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api.service';
import { Activity } from '@shared/types';
import ActivityCard from '../components/ActivityCard';
import StatsCard from '../components/StatsCard';
import QuickActions from '../components/QuickActions';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function Dashboard() {
  const { user } = useAuth();

  // Fetch recent activities
  const { data: activities, isLoading: activitiesLoading, error: activitiesError } = useQuery(
    ['activities', 'recent'],
    () => apiService.getActivities({ limit: 5 }),
    { refetchInterval: 30000 } // Refresh every 30 seconds
  );

  // Fetch user stats
  const { data: stats, isLoading: statsLoading } = useQuery(
    ['activities', 'stats'],
    () => apiService.getActivityStats()
  );

  // Fetch team stats
  const { data: teamStats } = useQuery(
    ['team', 'stats', 'daily'],
    () => apiService.getTeamStats('daily')
  );

  if (activitiesLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  if (activitiesError) {
    return <ErrorMessage error={activitiesError as Error} />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.displayName}! 👋
        </h1>
        <p className="opacity-90">
          You're on a {user?.currentStreak || 0} day streak! Keep it up! 🔥
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Points"
          value={user?.totalPoints || 0}
          icon="🏆"
          trend={+15}
        />
        <StatsCard
          title="Current Level"
          value={`Level ${user?.level || 1}`}
          icon="⭐"
          subtitle={`${(user?.totalPoints || 0) % 1000}/1000 to next level`}
        />
        <StatsCard
          title="Activities Today"
          value={stats?.dailyActivities || 0}
          icon="📊"
          trend={+5}
        />
        <StatsCard
          title="Team Rank"
          value={`#${teamStats?.userRank || '-'}`}
          icon="🥇"
          subtitle="Daily leaderboard"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <QuickActions />
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Recent Activities</h2>
          <a href="/activities" className="text-orange-500 hover:text-orange-600 text-sm">
            View all →
          </a>
        </div>
        
        {activities && activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity: Activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No activities yet. Start tracking your sales activities!
          </p>
        )}
      </div>

      {/* Team Performance */}
      {teamStats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Team Performance Today</h2>
          <div className="space-y-2">
            {teamStats.leaderboard?.slice(0, 3).map((entry: any, index: number) => (
              <div key={entry.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                  <div>
                    <p className="font-medium">{entry.displayName}</p>
                    <p className="text-sm text-gray-600">{entry.activities} activities</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-orange-500">{entry.points} pts</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}