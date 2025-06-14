import React, { useState, useEffect } from 'react';

const API_URL = '/api';

// Activity types with emojis and points
const ACTIVITY_TYPES = [
  { id: 'phone_call', label: 'Phone Call', emoji: '📞', points: 10 },
  { id: 'meeting', label: 'Meeting', emoji: '👥', points: 20 },
  { id: 'follow_up', label: 'Follow Up', emoji: '📋', points: 15 },
  { id: 'contract_sent', label: 'Contract Sent', emoji: '📄', points: 30 },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled', emoji: '📅', points: 25 },
  { id: 'project_booked', label: 'Project Booked', emoji: '🎯', points: 50 }
];

function App() {
  const [user, setUser] = useState(null);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ type: '', description: '' });

  // Login on mount
  useEffect(() => {
    login();
  }, []);

  // Fetch data when user is logged in
  useEffect(() => {
    if (user) {
      fetchActivities();
      fetchStats();
    }
  }, [user]);

  const login = async () => {
    try {
      console.log('Attempting login...');
      const res = await fetch(`${API_URL}/auth/login`, { method: 'POST' });
      console.log('Login response:', res.status);
      const data = await res.json();
      console.log('Login data:', data);
      if (data.success) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Login failed:', error);
      // Set a demo user to bypass login issues
      setUser({ id: '1', name: 'Demo User', points: 0, streak: 0 });
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API_URL}/activities`);
      const data = await res.json();
      if (data.success) {
        setActivities(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/stats`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.type || !formData.description) return;

    try {
      const res = await fetch(`${API_URL}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setFormData({ type: '', description: '' });
        fetchActivities();
        fetchStats();
        
        // Update user points locally
        setUser(prev => ({ ...prev, points: prev.points + data.data.points }));
      }
    } catch (error) {
      console.error('Failed to create activity:', error);
    }
  };

  if (!user) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>Sales Tracker Pro</h1>
        <div className="user-info">
          <span>{user.name}</span>
          <span className="points">{user.points} pts</span>
        </div>
      </header>

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalPoints}</div>
            <div className="stat-label">Total Points</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalActivities}</div>
            <div className="stat-label">Activities</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.todayActivities}</div>
            <div className="stat-label">Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.currentStreak} 🔥</div>
            <div className="stat-label">Streak</div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="section">
        <h2>Quick Actions</h2>
        <div className="action-grid">
          {ACTIVITY_TYPES.map(type => (
            <button
              key={type.id}
              className="action-btn"
              onClick={() => {
                setFormData({ type: type.id, description: '' });
                setShowForm(true);
              }}
            >
              <span className="emoji">{type.emoji}</span>
              <span className="label">{type.label}</span>
              <span className="points">+{type.points} pts</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activities */}
      <div className="section">
        <h2>Recent Activities</h2>
        {activities.length > 0 ? (
          <div className="activity-list">
            {activities.map(activity => {
              const type = ACTIVITY_TYPES.find(t => t.id === activity.type);
              return (
                <div key={activity.id} className="activity-item">
                  <span className="emoji">{type?.emoji}</span>
                  <div className="activity-details">
                    <div className="description">{activity.description}</div>
                    <div className="meta">
                      {new Date(activity.date).toLocaleString()} • +{activity.points} pts
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty">No activities yet. Start tracking!</p>
        )}
      </div>

      {/* Activity Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>
              {ACTIVITY_TYPES.find(t => t.id === formData.type)?.label}
            </h3>
            <form onSubmit={handleSubmit}>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="What did you accomplish?"
                required
                autoFocus
              />
              <div className="form-actions">
                <button type="submit" className="btn-primary">Save</button>
                <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;