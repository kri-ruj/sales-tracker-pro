import React from 'react';
import { Activity, ActivityType } from '@shared/types';
import { formatDistanceToNow } from 'date-fns';

const activityIcons: Record<ActivityType, string> = {
  [ActivityType.PHONE_CALL]: '📞',
  [ActivityType.MEETING]: '👥',
  [ActivityType.FOLLOW_UP]: '📋',
  [ActivityType.CONTRACT_SENT]: '📄',
  [ActivityType.MEETING_SCHEDULED]: '📅',
  [ActivityType.PROJECT_BOOKED]: '🎯',
  [ActivityType.OTHER]: '✨'
};

interface ActivityCardProps {
  activity: Activity;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activity: Activity) => void;
}

export default function ActivityCard({ activity, onEdit, onDelete }: ActivityCardProps) {
  const icon = activityIcons[activity.type] || '✨';
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center space-x-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <p className="font-medium text-gray-900">{activity.description}</p>
          <p className="text-sm text-gray-500">
            {activity.date} at {activity.time} • {timeAgo}
          </p>
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        <span className="text-sm font-semibold text-orange-500">
          +{activity.points} pts
        </span>
        
        {(onEdit || onDelete) && (
          <div className="flex space-x-1">
            {onEdit && (
              <button
                onClick={() => onEdit(activity)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Edit"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(activity)}
                className="p-1 text-gray-400 hover:text-red-600"
                title="Delete"
              >
                🗑️
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}