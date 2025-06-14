import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: number;
  subtitle?: string;
}

export default function StatsCard({ title, value, icon, trend, subtitle }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      
      <div className="flex items-baseline">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend !== undefined && (
          <span className={`ml-2 text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      
      {subtitle && (
        <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}