import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { apiService } from '../services/api.service';
import { ActivityType } from '@shared/types';

const quickActions = [
  { type: ActivityType.PHONE_CALL, label: 'Log Call', icon: '📞', points: 10 },
  { type: ActivityType.MEETING, label: 'Log Meeting', icon: '👥', points: 20 },
  { type: ActivityType.FOLLOW_UP, label: 'Follow Up', icon: '📋', points: 15 },
  { type: ActivityType.CONTRACT_SENT, label: 'Contract Sent', icon: '📄', points: 30 },
  { type: ActivityType.MEETING_SCHEDULED, label: 'Schedule Meeting', icon: '📅', points: 25 },
  { type: ActivityType.PROJECT_BOOKED, label: 'Project Booked', icon: '🎯', points: 50 },
];

export default function QuickActions() {
  const [selectedAction, setSelectedAction] = useState<ActivityType | null>(null);
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const createActivityMutation = useMutation(
    (data: { type: ActivityType; description: string }) => 
      apiService.createActivity(data),
    {
      onSuccess: () => {
        // Invalidate and refetch activities
        queryClient.invalidateQueries(['activities']);
        queryClient.invalidateQueries(['team']);
        
        // Reset form
        setSelectedAction(null);
        setDescription('');
        setShowForm(false);
        
        // Show success toast (you'd implement this)
        console.log('Activity created successfully!');
      },
      onError: (error: Error) => {
        console.error('Failed to create activity:', error);
      }
    }
  );

  const handleQuickAction = (type: ActivityType) => {
    setSelectedAction(type);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAction && description.trim()) {
      createActivityMutation.mutate({
        type: selectedAction,
        description: description.trim()
      });
    }
  };

  return (
    <div>
      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.type}
            onClick={() => handleQuickAction(action.type)}
            className="flex flex-col items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={createActivityMutation.isLoading}
          >
            <span className="text-2xl mb-1">{action.icon}</span>
            <span className="text-sm font-medium">{action.label}</span>
            <span className="text-xs text-gray-500">+{action.points} pts</span>
          </button>
        ))}
      </div>

      {/* Activity Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {quickActions.find(a => a.type === selectedAction)?.label}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={3}
                  placeholder="What did you accomplish?"
                  required
                  autoFocus
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={createActivityMutation.isLoading}
                  className="flex-1 bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 disabled:opacity-50"
                >
                  {createActivityMutation.isLoading ? 'Saving...' : 'Save Activity'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}