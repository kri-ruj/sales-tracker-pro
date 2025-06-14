import React from 'react';

interface ErrorMessageProps {
  error: Error | string;
  onRetry?: () => void;
}

export default function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  const message = typeof error === 'string' ? error : error.message;

  return (
    <div className="rounded-md bg-red-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <span className="text-2xl">❌</span>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Oops! Something went wrong
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{message}</p>
          </div>
          {onRetry && (
            <div className="mt-4">
              <button
                onClick={onRetry}
                className="text-sm font-medium text-red-600 hover:text-red-500"
              >
                Try again →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}